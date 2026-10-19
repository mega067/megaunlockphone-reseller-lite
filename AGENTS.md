# 🤖 AI & DEVELOPER MASTER BLUEPRINT (ONBOARDING & SYSTEM MAP)

> **ATENCIÓN PARA AGENTES DE IA Y DESARROLLADORES:**  
> Este es el documento rector principal del repositorio. Léelo antes de realizar cualquier cambio, depuración o reescritura. Contiene la correlación de archivos, el modelo de datos, la seguridad contra inyecciones SQL, la protección de montos y las medidas de contingencia.

---

## 📌 1. Información General del Repositorio
- **Repositorio Oficial:** [GitHub - mega067/MegaUnlockPhone](https://github.com/mega067/MegaUnlockPhone.git)
- **Branch Principal:** `main`
- **Ambiente de Producción:** [AlwaysData Platform](https://megaunlockphone-panel.alwaysdata.net/)
- **Portal DigitalPass:** [https://megaunlockphone-panel.alwaysdata.net/digital-pass](https://megaunlockphone-panel.alwaysdata.net/digital-pass)
- **Servidor Web:** Node.js Express bajo Phusion Passenger.
- **Demonio de Mensajería:** Node.js Baileys Socket (`whatsappBot.js`).
- **Skills de UI/UX Pro Max Integradas:** [`.agents/skills/`](file:///home/angel/Projects/REPOS/dhru-client-web/.agents/skills/) (ui-ux-pro-max, ui-styling, design-system, brand, design, banner-design, slides).

---

## 🎨 1.1. Skills de Diseño & UI/UX Pro Max Integradas
El repositorio cuenta con la suite oficial de habilidades de diseño de [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill):
- **Ubicación en el Workspace:** `.agents/skills/` (versionado en Git para todos los desarrolladores y agentes).
- **Ubicación Global:** `~/.gemini/config/skills/` (disponible permanentemente para el entorno de Antigravity).
- **Skills disponibles:**
  1. `ui-ux-pro-max`: Inteligencia de diseño con 79 estilos (50 activos), 192 paletas de producto, 119 reglas de UX y 74 combinaciones de fuentes.
  2. `ui-styling`: Directrices de maquetación, Tailwind, componentes y accesibilidad.
  3. `design-system`: Arquitectura de tokens, variables y estados de componentes.
  4. `brand`: Identidad visual, tipografía y coherencia de marca.
  5. `design`: Diseño de banners, logos y composición de interfaces.
  6. `slides`: Presentaciones y estructuras visuales.
  7. `banner-design`: Especificaciones de formatos publicitarios y banners.

---

## 🔒 2. Seguridad Crítica y Protección de Montos Financieros

### A. Almacenamiento y Protección de Billeteras (`credits`)
1. **Transacciones Atómicas:**
   - La deducción de saldos ocurre **antes** de enviar la orden a los proveedores (`latamgsm.com` o `unlockerfast.com.mx`) en [orderController.js](file:///home/angel/Projects/REPOS/dhru-client-web/src/controllers/orderController.js).
   - Si la API del proveedor responde con error (`HTTP 4xx/5xx` o `ERROR` en cuerpo JSON), el importe se restituye inmediatamente a la cuenta del usuario sin discrepancias (`rollback`).
2. **Auto-Reembolso de Órdenes Rechazadas (`processRefund`):**
   - En [helpers.js](file:///home/angel/Projects/REPOS/dhru-client-web/src/helpers.js), la función `processRefund(order)` valida la bandera `order.isRefunded`.
   - Si una orden pasa a estado `Rejected` o `Failed` mediante el poller o actualización manual, el monto exacto cobrado (`costCharged`) es devuelto al balance del usuario y se marca `isRefunded = true` para evitar reembolsos dobles.
3. **Protección contra Corrupción (`NaN` / Números Negativos):**
   - Todos los cálculos monetarios utilizan `parseFloat(val) || 0` y validaciones estrictas `if (cost <= 0 || isNaN(cost))`.
   - Las recargas bancarias por SPEI o comprobante pasan por validaciones de duplicidad de clave de rastreo en SQLite (`BankTransactions`).

### B. Prevención de Inyecciones SQL (SQL Injection)
- **Driver:** [better-sqlite3](file:///home/angel/Projects/REPOS/dhru-client-web/src/database.js)
- **Regla Estricta:** Ninguna consulta SQL debe concatenar strings de entrada del usuario (`'SELECT ... WHERE id = ' + req.body.id` está terminantemente prohibido).
- **Prepared Statements Obligatorios:**
  ```javascript
  // Correcto:
  const stmt = db.prepare('SELECT * FROM OrdersHistory WHERE orderId = ? AND userId = ?');
  const order = stmt.get(orderId, userId);
  ```

### C. Protección de Conexiones y Webhooks No Autorizados
- **Rutas del Bot (`/api/bot/*`):**
  - Protegidas por el middleware `requireBotSecret` en [botRoutes.js](file:///home/angel/Projects/REPOS/dhru-client-web/src/routes/botRoutes.js). Requieren el token `BOT_SECRET` (`MEGA_BOT_SECRET_2026`). Peticiones externas sin este secreto reciben `403 Forbidden`.
- **Rutas de Administración (`/api/admin/*`):**
  - Requieren doble middleware: `requireAuth` (validación de token JWT firmado) + `requireAdmin` (verificación de rol `admin` en la base de datos).
- **Protección contra Fuerza Bruta (Brute Force):**
  - Los endpoints de `/api/login`, `/api/register` y `/api/verify-account` tienen limitadores de tasa activos (`express-rate-limit`: 10 intentos por ventana de 15 minutos por IP).

---

## 🛟 3. Método de Verificación y Rescate de Cuentas (Fallback sin Bot)

Si el bot de WhatsApp se encuentra en mantenimiento, bloqueado o sin conexión a internet, los usuarios **no quedan incomunicados ni bloqueados**.

### Endpoint de Contingencia: `POST /api/verify-account`
Permite verificar la existencia y estado de una cuenta y rescatar el acceso sin depender de mensajes SMS/WhatsApp:
- **Ruta:** `/api/verify-account`
- **Controlador:** [authRoutes.js](file:///home/angel/Projects/REPOS/dhru-client-web/src/routes/authRoutes.js)
- **Payload Requerido:**
  ```json
  {
    "username": "usuario123",
    "email": "correo@ejemplo.com", // o "phone": "52221xxxxxxx"
  }
  ```
- **Respuesta Segura (Datos Sensibles Enmascarados):**
  ```json
  {
    "success": true,
    "accountStatus": "active",
    "username": "usuario123",
    "role": "reseller",
    "credits": 250.50,
    "isLinkedToWhatsapp": true,
    "phoneMasked": "522****20",
    "emailMasked": "us***@ejemplo.com"
  }
  ```
- **Panel Administrativo Web:** El Administrador puede gestionar, cambiar contraseñas, resetear número de WhatsApp o asignar créditos manualmente desde el botón superior **Admin** en cualquier momento, independientemente del bot.

---

## ⚡ 4. Robustez del Bot de WhatsApp (Anti-Fail / Anti-Esperando Mensaje)

El archivo [whatsappBot.js](file:///home/angel/Projects/REPOS/dhru-client-web/whatsappBot.js) ha sido endurecido con los siguientes mecanismos industriales:

1. **Gestión de Bloqueo por Instancia (`bot.lock` Process-Aware):**
   - Comprueba si el proceso con el PID registrado en el candado sigue existiendo en el sistema operativo mediante `process.kill(pid, 0)`.
   - Si el proceso anterior se cerró o se detuvo forzosamente, el archivo se auto-elimina de forma segura y permite el inicio inmediato.
   - Cuenta con manejadores automáticos para `SIGINT`, `SIGTERM` y `exit`.
2. **Prevención del Bug "Esperando el mensaje" / "Waiting for this message":**
   - Antes de despachar cada mensaje, el bot envía un `presenceUpdate('available')` y `presenceUpdate('composing', jid)`. Esto fuerza a WhatsApp a intercambiar las llaves públicas de cifrado de la sesión de Signal antes del payload.
   - Tras el envío, emite `presenceUpdate('paused', jid)`.
3. **Cola de Despacho con Throttling y Reintentos Automáticos:**
   - Introduce una pausa aleatoria de seguridad de `1.2s` a `2.0s` entre envíos.
   - Si una entrega sufre de `Timeout` o error transitorio de socket, se aplica un mecanismo de **reintento exponencial (hasta 3 intentos)** volviendo a encolar el mensaje sin descartarlo.
4. **Timeouts Extendidos para Redes Inestables:**
   - `connectTimeoutMs: 300000` (5 minutos)
   - `defaultQueryTimeoutMs: 300000`
   - `keepAliveIntervalMs: 10000` (pings cada 10 segundos para mantener el túnel TCP activo).

---

## 📂 5. Limpieza y Reorganización de Archivos

Se retiraron todos los scripts de prueba, parches y migraciones temporales obsoletas de la raíz del proyecto y se almacenaron en:
📁 [scripts/archive/](file:///home/angel/Projects/REPOS/dhru-client-web/scripts/archive/)

La raíz del proyecto ahora permanece exclusivamente con archivos operativos esenciales:
- `server.js` (Express Server)
- `whatsappBot.js` (WhatsApp Socket)
- `start_bot.sh` (Demonio AlwaysData)
- `deploy.sh` (Despliegue rsync)
- `Architecture.md` y `AGENTS.md` (Documentación centralizada)

---

## 📜 6. Historial de Commits y Enlaces de Git

Historial reciente de versiones desplegadas en producción:

| Commit Hash | Tipo | Descripción | Enlace en GitHub |
|---|---|---|---|
| `6450e6a` | `fix` | Botón X de cierre en esquina superior y toggle ocultar IMEI discreto | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/6450e6a) |
| `babab4c` | `fix` | Mostrar nombre de grupo real del proveedor en modal de compra | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/babab4c) |
| `21f33c6` | `refactor` | Tarjetas limpias sin insignias redundantes y lógica de precio atada al grupo real | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/21f33c6) |
| `6496b5f` | `feat` | Aislamiento estricto: comisiones basadas en grupo real, custom solo visual | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/6496b5f) |
| `ab0e38d` | `feat` | IP Whitelist con auto-binding en primera conexión y controles en Perfil | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/ab0e38d) |
| `e5f009f` | `feat` | Documentación interactiva DHRU Fusion en Perfil y fix de solapamiento | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/e5f009f) |
| `0889c72` | `docs` | Mapa de arquitectura completa, gestión de APIKEYS y modularidad | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/0889c72) |
| `c6ad8e9` | `fix` | Bloqueo de bot process-aware con auto-limpieza en salida | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/c6ad8e9) |
| `3b6572c` | `fix` | Optimización completa de vista móvil (cards, cuadrículas y botones) | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/3b6572c) |
| `d2e0660` | `fix` | Paleta azul cielo suave del logo y presentación pulida en login | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/d2e0660) |
| `ae07051` | `feat` | Tema claro por defecto idéntico al logo con switch a modo oscuro | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/ae07051) |
| `072ea65` | `feat` | Carrusel con logos SVG oficiales de Streaming e Inteligencia Artificial | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/072ea65) |
| `528904b` | `feat` | Implementación de ruta y portal dedicado `/digital-pass` | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/528904b) |
| `a0f8ff0` | `feat` | Sincronización automática de órdenes en tiempo real y reembolsos | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/a0f8ff0) |
| `9511b8d` | `fix` | Mostrar 0.00 créditos en interfaz cuando no hay sesión activa | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/9511b8d) |

---

## 🛠️ 7. Guía Rápida para el Agente (Comandos de Referencia)

1. **Para sincronizar cambios con AlwaysData:**
   ```bash
   ./deploy.sh
   ```
2. **Para reiniciar el backend en caliente:**
   ```bash
   curl -s -H "Authorization: Bearer 1" -H "X-Bot-Secret: MEGA_BOT_SECRET_2026" https://megaunlockphone-panel.alwaysdata.net/api/kill
   ```
3. **Para revisar el proceso del bot:**
   ```bash
   ps aux | grep -E 'node|whatsappBot'
   tail -n 40 bot_logs.txt
   ```
