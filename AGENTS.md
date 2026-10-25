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
4. **Respaldos Automáticos Financieros & Ciclo 24h ([src/backupEngine.js](file:///home/angel/Projects/REPOS/dhru-client-web/src/backupEngine.js)):**
   - Cada creación de usuario, recarga o pedido genera un snapshot instantáneo inmutable (`data/backups/instant/`).
   - Se ejecuta un ciclo programado continuo cada 24 horas (`data/backups/daily/`) con rotación de 30 días.
5. **Caja Negra Criptográfica Inalterable (`audit_blackbox.log`):**
   - Registro *Append-Only* con Hash Chaining SHA-256 (estilo blockchain ligero). Cada acción queda ligada criptográficamente al hash del bloque anterior. La alteración o borrado de eventos rompe la firma matemática.
6. **Portabilidad Total de Migración ([scripts/migrationTool.js](file:///home/angel/Projects/REPOS/dhru-client-web/scripts/migrationTool.js)):**
   - Paquete agnóstico que incluye SQLite + todos los JSONs de configuración, precios, llaves API e historiales para restaurar el sistema en cualquier VPS, Docker o Cloud en segundos ante fallas de host.

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
## ⚡ 4. Robustez del Bot de WhatsApp (Anti-Fail / Anti-Esperando Mensaje)

El archivo [whatsappBot.js](file:///home/angel/Projects/REPOS/dhru-client-web/whatsappBot.js) ha sido endurecido con los siguientes mecanismos industriales:

1. **Gestión de Bloqueo por Instancia (`bot.lock` Process-Aware):**
   - Comprueba si el proceso con el PID registrado en el candado sigue existiendo en el sistema operativo mediante `process.kill(pid, 0)`.
   - Si el proceso anterior se cerró o se detuvo forzosamente, el archivo se auto-elimina de forma segura y permite el inicio inmediato.
   - Cuenta con manejadores automáticos para `SIGINT`, `SIGTERM` y `exit`.
2. **Prevención del Bug "Esperando el mensaje" / "Waiting for this message":**
   - Antes de despachar cada mensaje, el bot envía un `presenceUpdate('available')` y `presenceUpdate('composing', jid)`. Esto fuerza a WhatsApp a intercambiar las llaves públicas de cifrado de la sesión de Signal antes del payload.
   - Tras el envío, emite `presenceUpdate('paused', jid)`.
3. **Difusión Masiva Segura Anti-Baneo (`msgall` / Transmisión Masiva):**
   - **Delays Humanizados y Jitter Dinámico:** En lugar de ráfagas automáticas, entre cada destinatario se aplica un retardo aleatorio de `3.5s` a `7.0s` (`randomBroadcastDelay` en [src/whatsappEngine.js](file:///home/angel/Projects/REPOS/dhru-client-web/src/whatsappEngine.js)).
   - **Simulación de Escritura Real (`composing`):** Antes de enviar a cada cliente, el bot simula entre `1.0s` y `2.5s` de escritura real en el chat individual y luego pausa la presencia.
   - **Pausas de Descanso por Lotes:** Cada 5 mensajes enviados de forma continua, el bot toma una pausa de enfriamiento adicional aleatoria de `4.0s` a `8.0s`.
4. **Resolución Híbrida de Identidad de Administrador (`cleanId`):**
   - Soporta identificadores WhatsApp tanto `@s.whatsapp.net` como los modernos `@lid`.
   - Normaliza automáticamente representaciones flotantes (`'1.0'` -> `'1'`) generadas por parsers JSON o bases heredadas.
   - Si un usuario no existe en `users.json`, consulta automáticamente la tabla `Users` en SQLite para garantizar que los permisos de administrador no se pierdan.
5. **Timeouts Extendidos para Redes Inestables:**
   - `connectTimeoutMs: 300000` (5 minutos)
   - `defaultQueryTimeoutMs: 300000`
   - `keepAliveIntervalMs: 10000` (pings cada 10 segundos para mantener el túnel TCP activo).

---

## 💰 5. Módulo Contable & Finanzas Independiente (`/finanzas`)
- **Portal Dedicado:** Accesible directamente desde `https://megaunlockphone-panel.alwaysdata.net/finanzas`.
- **Cero Ganancia en Traspasos:** Las transferencias entre cuentas propias (`transfer`) tienen estrictamente `grossProfit = 0`, `reinvestAmount = 0` y `netProfit = 0`.
- **Navegación Intuitiva:** Cuenta con botón destacado **"Volver al Panel Admin"** con enrutamiento inteligente por hash (`/#admin`, `/#finanzas`, `/#history`).
- **Control de Meses Sin Intereses (Nu/Tarjetas):** Cálculo automático de mensualidades indicando únicamente monto total y plazos.

---

## 📂 6. Limpieza y Reorganización de Archivos

Se retiraron todos los scripts de prueba, parches y migraciones temporales obsoletas de la raíz del proyecto y se almacenaron en:
📁 [scripts/archive/](file:///home/angel/Projects/REPOS/dhru-client-web/scripts/archive/)

La raíz del proyecto ahora permanece exclusivamente con archivos operativos esenciales:
- `server.js` (Express Server)
- `whatsappBot.js` (WhatsApp Socket)
- `start_bot.sh` (Demonio AlwaysData)
- `deploy.sh` (Despliegue rsync)
- `Architecture.md` y `AGENTS.md` (Documentación centralizada)

---

## 🤖 7. Protocolo de Relevo para Nuevos Agentes IA (Continuity & Context)
Cuando retomes este proyecto o continúes una sesión:
1. **Comprobar Sintaxis Primero:** Ejecuta siempre `node --check` sobre cualquier archivo JS antes de hacer commit o deploy.
2. **Evitar Sobreescribir `data/` en Producción:** `deploy.sh` tiene `--exclude 'data'` para no borrar la base de datos real de clientes ni historiales SQLite.
3. **Manejo de Procesos del Bot:**
   - AlwaysData corre el bot a través de su pestaña **Web > Services** usando `./start_bot.sh`.
   - Nunca dejes un proceso `node whatsappBot.js` corriendo por SSH si el servicio de AlwaysData está activo, o habrá colisión de sesión (Status 440 Replaced).
4. **Validación de Usuarios y Admin:**
   - Compara siempre usando `String(u.id).replace(/\.0+$/, '') === cleanId`.
   - Consulta [src/database.js](file:///home/angel/Projects/REPOS/dhru-client-web/src/database.js) como fuente autoritativa ante dudas entre SQLite y JSON.

---

## 📜 8. Historial de Commits y Enlaces de Git

Historial reciente de versiones desplegadas en producción:

| Commit Hash | Tipo | Descripción | Enlace en GitHub |
|---|---|---|---|
| `65bac07` | `fix` | Normalizar cleanId para float-strings '1.0' en linkedUserId de admin | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/65bac07) |
| `57b757b` | `fix` | Vincular y comparar admin por SQLite/JSON con soporte de IDs mixtos | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/57b757b) |
| `aacea42` | `feat` | Robustecer resolución de admin en lid/jid y detallar opciones en /comandos | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/aacea42) |
| `ac0d29f` | `fix` | Restaurar llave de cierre en checkSession para ejecución de login y botones | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/ac0d29f) |
| `6ebc7bf` | `feat` | Separar finanzas en portal limpio con botón para volver al admin y v88 móvil | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/6ebc7bf) |
| `6450e6a` | `fix` | Botón X de cierre en esquina superior y toggle ocultar IMEI discreto | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/6450e6a) |
| `babab4c` | `fix` | Mostrar nombre de grupo real del proveedor en modal de compra | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/babab4c) |
| `21f33c6` | `refactor` | Tarjetas limpias sin insignias redundantes y lógica de precio atada al grupo | [Ver Commit](https://github.com/mega067/MegaUnlockPhone/commit/21f33c6) |

---

## 🛠️ 9. Guía Rápida para el Agente (Comandos de Referencia)

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
