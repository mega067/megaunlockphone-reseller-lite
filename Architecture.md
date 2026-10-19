# 🗺️ Arquitectura Integral y Mapa del Proyecto: MegaUnlockPhone & DigitalPass

Este documento describe la **arquitectura técnica completa, estructura de carpetas, dependencias, flujos de conectividad, orquestación de bots, guías de administración de servidores/APIKEYS y principios de modularidad y reutilización de código** de la plataforma.

---

## 📑 Tabla de Contenidos
1. [Visión General del Sistema](#1-visión-general-del-sistema)
2. [Estructura del Proyecto y Mapa de Archivos](#2-estructura-del-proyecto-y-mapa-de-archivos)
3. [Paradigma de Modularidad y Reutilización de Código](#3-paradigma-de-modularidad-y-reutilización-de-código)
4. [Flujos de Conectividad e Integración](#4-flujos-de-conectividad-e-integración)
5. [Guía: Configurar y Cambiar Servidores, Endpoints y APIKEYS](#5-guía-configurar-y-cambiar-servidores-endpoints-y-apikeys)
6. [El Fork DigitalPass (Streaming & AI)](#6-el-fork-digitalpass-streaming--ai)
7. [Bot de WhatsApp (Baileys) y Colas de Notificaciones](#7-bot-de-whatsapp-baileys-y-colas-de-notificaciones)
8. [Persistencia y Base de Datos (SQLite + JSON Cache)](#8-persistencia-y-base-de-datos-sqlite--json-cache)
9. [Despliegue y Mantenimiento en AlwaysData](#9-despliegue-y-mantenimiento-en-alwaysdata)

---

## 1. Visión General del Sistema

El ecosistema está construido como una solución integral cliente-servidor para comercialización de servicios de telecomunicaciones (IMEI/Server Unlock, herramientas CPID/FRP/Bypass) y servicios digitales (Cuentas Streaming, Inteligencia Artificial, Licencias y Gaming):

```
                   ┌──────────────────────────────────────────────┐
                   │               USUARIOS / CLIENTES            │
                   └───────┬──────────────────────────────┬───────┘
                           │                              │
         https://.../ (Portal Principal)     https://.../digital-pass (Portal Streaming/IA)
                           │                              │
                           └──────────────┬───────────────┘
                                          ▼
                   ┌──────────────────────────────────────────────┐
                   │             EXPRESS HTTP SERVER              │
                   │        (server.js - AlwaysData/Passenger)    │
                   └───────┬──────────────────────────────┬───────┘
                           │                              │
                 REST API Interna                  Webhooks Seguros
                           │                     (Token: MEGA_BOT_SECRET)
                           ▼                              ▼
            ┌────────────────────────────┐  ┌───────────────────────────┐
            │       CONTROLADORES        │  │     WHATSAPP BOT ENGINE   │
            │  Catalog / Orders / Admin  │  │ (whatsappBot.js - Baileys)│
            └──────────────┬─────────────┘  └─────────────┬─────────────┘
                           │                              │
              ┌────────────┴─────────────┐                │
              ▼                          ▼                ▼
   ┌──────────────────────┐   ┌──────────────────────┐ ┌───────────────────┐
   │ SQLite / JSON DBs    │   │ PROVEEDORES DHRU/GSM │ │ Cliente WhatsApp  │
   │ Wallets, Orders, Log │   │ Server 1, 2 y 3      │ │ (Grupos & Direct) │
   └──────────────────────┘   └──────────────────────┘ └───────────────────┘
```

---

## 2. Estructura del Proyecto y Mapa de Archivos

```plaintext
dhru-client-web/
├── server.js                     # Servidor Express central, middleware, rutas y lifecycle
├── whatsappBot.js                # Demonio independiente Baileys para WhatsApp
├── start_bot.sh                  # Lanzador monitoreado del bot para AlwaysData / PM2
├── deploy.sh                     # Script de sincronización rsync hacia AlwaysData
│
├── src/                          # Backend modular
│   ├── auth.js                   # Middleware JWT y validación de sesiones/roles
│   ├── cacheManager.js           # Caché en memoria para catálogos con TTL
│   ├── database.js               # Conexión principal SQLite (better-sqlite3)
│   ├── db.js                     # Capa de abstracción para lectura/escritura JSON atómica
│   ├── helpers.js                # Cálculo de márgenes, markups, llamadas DHRU GSM
│   ├── history.js                # Sincronizador de historial y pedidos SQLite
│   ├── payments.js               # Enrutador de pagos, saldo y transferencias
│   ├── poller.js                 # Polling en segundo plano para verificar pedidos DHRU
│   ├── syncService.js            # Servicio de sincronización programada con proveedores
│   ├── whatsappQueue.js          # Cola de salida persistente para WhatsApp (anti-spam)
│   │
│   ├── controllers/              # Controladores de lógica de negocio
│   │   ├── accountController.js  # Perfil de usuario, balances y detalles
│   │   ├── adminController.js    # CRUD de usuarios, asignación de precios, reinicio de bot
│   │   ├── botController.js      # Endpoints consumidos por whatsappBot.js
│   │   ├── catalogController.js  # Obtención y filtrado de productos (Mega y DigitalPass)
│   │   ├── orderController.js    # Creación, verificación y deducción de órdenes
│   │   └── serviceController.js  # Búsqueda rápida de servicios
│   │
│   ├── routes/                   # Definición modular de endpoints Express
│   │   ├── accountRoutes.js      # /api/account/*
│   │   ├── adminRoutes.js        # /api/admin/*
│   │   ├── apiBridgeRoutes.js    # /api/v1/*, /api/v1/s1/*, /api/v1/s3/*, /api/v1/sX/dhru (DHRU Passthrough & IP Whitelist)
│   │   ├── authRoutes.js         # /api/login, /api/register, /api/logout
│   │   ├── botRoutes.js          # /api/bot/* (seguridad con BOT_SECRET)
│   │   ├── catalogRoutes.js      # /api/products, /api/categories
│   │   ├── orderRoutes.js        # /api/orders, /api/place-order
│   │   ├── serviceRoutes.js      # /api/services/*
│   │   └── ticketConfigRoutes.js # /api/ticket_config/*
│   │
│   └── commands/                 # Sub-comandos ejecutados por el bot de WhatsApp
│       ├── admin.js              # Comandos para administradores (/addsaldo, etc.)
│       ├── buscar.js             # Búsqueda interactiva de servicios por texto
│       ├── configticket.js       # Configuración de entrega de tickets y credenciales
│       ├── index.js              # Router central de comandos WhatsApp
│       ├── otros.js              # Comandos de ayuda, soporte y utilidades
│       ├── pedir.js              # Creación de pedidos mediante WhatsApp
│       ├── recargar.js           # Flujo de recarga de créditos
│       ├── saldo.js              # Consulta de billetera del usuario
│       ├── setprice.js           # Modificación rápida de precios desde el bot
│       └── vincular.js           # Enlace entre número de WhatsApp y usuario Web
│
├── public/                       # Frontend SPA (Vanilla JS + Modern CSS)
│   ├── index.html                # Interfaz principal de MegaUnlockPhone
│   ├── index.css                 # Diseño oscuro moderno con efectos glassmorphism
│   ├── index.js                  # Orquestador del frontend general
│   ├── js/                       # Módulos frontend desacoplados
│   │   ├── admin.js              # Panel de administración, tabla de usuarios y precios
│   │   ├── api.js                # Wrapper de llamadas HTTP fetch centralizado
│   │   ├── notifications.js      # Notificaciones flotantes tipo Toast
│   │   ├── orders.js             # Modal de compra, historial y estado de órdenes
│   │   ├── products.js           # Renderizado de categorías y tarjetas de productos
│   │   ├── recharge.js           # Modal y validación de recarga de saldo
│   │   ├── searchEngine.js       # Buscador en tiempo real
│   │   ├── state.js              # Estado reactivo global en el cliente
│   │   ├── ticket.js             # Generador visual de comprobantes imprimibles
│   │   ├── utils.js              # Formateadores de moneda, fechas y texto
│   │   └── warnings.js           # Avisos y alertas del sistema
│   │
│   └── digitalpass/              # Fork Exclusivo DigitalPass
│       ├── index.html            # Portal adaptado exclusivamente a Streaming & IA
│       ├── digitalpass.css       # Paleta azul cielo suave del logo + toggle dark mode
│       ├── digitalpass.js        # Interceptor de fetch (?digitalPass=true) y branding
│       ├── logo.png              # Logo vectorizado oficial DigitalPass
│       └── brands/               # Logos SVG oficiales (Netflix, Gemini, ChatGPT, Disney+, etc.)
│
└── data/                         # Almacenamiento local persistente
    ├── database.sqlite           # Base de datos relacional (Usuarios, Pedidos, Billeteras)
    ├── settings.json             # Configuración central de servidores, credenciales y tasas
    ├── custom_groups.json        # Categorías y grupos personalizados por el admin
    ├── prices_1.json             # Caché de precios para Server 1
    ├── prices_3.json             # Caché de precios para Server 3
    └── whatsapp_users.json       # Relación de números de WhatsApp con IDs de usuario
```

---

## 3. Paradigma de Modularidad y Reutilización de Código

El proyecto sigue una arquitectura **Layered / Shared-Core**:

1. **Separación de Responsabilidades (SoC):**
   - **Rutas (`src/routes/`):** Solo definen rutas, métodos y validaciones previas (guards).
   - **Controladores (`src/controllers/`):** Contienen toda la lógica de negocio; nunca manejan conexión directa con la capa de transporte más allá de responder JSON.
   - **Capa de Abstracción de Datos (`src/db.js` y `src/database.js`):** Todos los módulos leen y escriben a través de utilidades atómicas, garantizando que si se migra de SQLite a PostgreSQL o MySQL, no se debe alterar ningún controlador.
   - **Comandos Desacoplados del Bot (`src/commands/`):** Cada comando de WhatsApp es un archivo aislado que exporta su lógica. Si se agrega un nuevo comando (ejemplo: `/sorteo.js`), solo se añade el archivo sin modificar el motor principal de Baileys.

2. **Frontend Modular:**
   - La carpeta `public/js/` separa el renderizado de productos (`products.js`), el historial (`orders.js`) y las llamadas API (`api.js`).
   - El archivo `public/digitalpass/digitalpass.js` funciona como un **Decorador / Interceptor**. No duplica el código de lógica comercial ni la base de datos; solo intercepta las peticiones HTTP agregando `X-Digital-Pass: true` y modifica las capas visuales.

---

## 4. Flujos de Conectividad e Integración

### A. Flujo de Consulta de Productos
```
Cliente Web / Móvil ──► GET /api/products?serverId=3&digitalPass=true
                                  │
                                  ▼
                    catalogController.getProducts()
                                  │
       ┌──────────────────────────┴──────────────────────────┐
       ▼ (Si está en memoria)                                ▼ (Si expiró caché)
Retornar catalogCache                               Llamada cURL a Proveedor DHRU
       │                                            (action=imeiservicelist)
       │                                                     │
       ▼                                                     ▼
Filtrar por Keywords & Custom Groups ◄────────── Guardar en disco y memoria
       │
       ▼
Retornar JSON con Precios Calculados (Exchange Rate + Markups)
```

### B. Flujo de Creación de Pedidos
```
Cliente (Web o WhatsApp) ──► POST /api/place-order
                                    │
                                    ▼
                      orderController.processOrder()
                                    │
    1. Validar fondos suficientes en wallet del usuario (SQLite)
    2. Deducir saldo preventivamente (Transacción ACID)
    3. Enviar orden a la API DHRU correspondiente (Server 1 o 3)
       ├─ ÉXITO: Guardar en OrdersHistory con ID de proveedor
       └─ ERROR: Revertir saldo inmediatamente a la wallet
    4. Encolar notificación en whatsappQueue.js
    5. Bot envía mensaje a WhatsApp del cliente y al grupo Admin
```

### C. Flujo de API Bridge & DHRU Passthrough Gateway (`/api/v1/sX/dhru`)
```
Cliente Externo / Fork / Bot ──► POST /api/v1/s1/dhru (o /api/v1/s3/dhru)
                                          │
                                          ▼
                             requireApiKey Middleware
     1. Comprobar header X-API-Key o campo apiaccesskey (SHA-256 hash match)
     2. Validar que la cuenta tenga acceso API activo (isApiEnabled)
     3. Auto-Binding de IP: si allowedIps está vacío, registrar clientIp automáticamente
     4. Validar que clientIp pertenezca a allowedIps (si está configurada)
                                          │
                                          ▼
                             handleDhruAction Gateway
     ├─ action=accountinfo    ──► Retorna saldo independiente (credits_1 o credits_3) en MXN
     ├─ action=*servicelist   ──► Retorna catálogo con PRECIOS CALCULADOS transparentes
     ├─ action=place*order    ──► Ejecuta deducción atómica y despacho upstream
     └─ action=get*order      ──► Retorna estado actual de la orden en tiempo real
```

---

## 5. Guía: Configurar y Cambiar Servidores, Endpoints y APIKEYS

Toda la comunicación externa con los paneles proveedores (DHRU Fusion / GSM API) se centraliza en un único archivo de configuración:

📍 **Ruta del archivo:** `data/settings.json`

### Estructura del Archivo:
```json
{
  "server1": {
    "name": "MEGA-SERVER",
    "endpoint": "https://latamgsm.com/dhru/",
    "username": "tu_correo@gmail.com",
    "apiaccesskey": "TU_API_KEY_AQUI",
    "resellerMarkup": 2.4,
    "clientMarkup": 0,
    "enabled": true
  },
  "server2": {
    "name": "POPI-GSM",
    "endpoint": "https://popi-gsm.com/public/",
    "username": "tu_correo@gmail.com",
    "apiaccesskey": "OTRA_API_KEY",
    "resellerMarkup": 2.4,
    "clientMarkup": 0,
    "enabled": false
  },
  "server3": {
    "name": "OMEGA-SERVER",
    "endpoint": "https://www.unlockerfast.com.mx/",
    "username": "MegaUnlockPhone",
    "apiaccesskey": "QXU-2HD-MAR-PKM-PAD-RFP-XK5-5ME",
    "resellerMarkup": 0,
    "clientMarkup": 0,
    "enabled": true
  },
  "exchangeRate": 17.6,
  "adminProfitBalance": 10
}
```

### Parámetros Explicados:
| Campo | Tipo | Descripción |
|---|---|---|
| `endpoint` | String | URL base del proveedor DHRU. Debe terminar en `/` (el sistema añade `api/index.php`). |
| `username` | String | Usuario o email registrado en la plataforma del proveedor. |
| `apiaccesskey` | String | Clave de API generada en la cuenta del proveedor DHRU. |
| `resellerMarkup` | Número | Ganancia fija o porcentaje añadido sobre el costo base para resellers. |
| `clientMarkup` | Número | Ganancia añadida para clientes finales. |
| `enabled` | Booleano | `true` para activar el servidor en el switch del panel; `false` para ocultarlo. |
| `exchangeRate` | Número | Tasa de cambio de USD a MXN (Pesos Mexicanos). |

> [!TIP]
> **¿Cómo cambiarlo desde el Panel Web sin editar el archivo a mano?**
> Inicia sesión como **Admin**, haz clic en el botón superior **Admin** ➔ pestaña **Servidores / Settings**. Puedes modificar los campos y guardar directamente. Los cambios aplican de inmediato en caliente.

---

## 6. El Fork DigitalPass (Streaming & AI)

DigitalPass es un portal especializado que convive en el mismo backend sin requerir una base de datos o servidor duplicado:

- **Ruta de Acceso:** `https://megaunlockphone-panel.alwaysdata.net/digital-pass`
- **Frontend Propio:** `public/digitalpass/`
  - Utiliza la paleta oficial del logo: fondo azul cielo suave (`#7cbfe8`), tarjetas azul hielo translúcidas y textos en azul marino de alta legibilidad (`#0f2a42`).
  - **Modo Oscuro Integrado:** El botón en la barra superior permite alternar instantáneamente entre el tema claro original y el modo noche (`body.dark-mode`), recordando la elección en `localStorage`.
  - **Carrusel de Marcas Oficiales:** Muestra logos SVG de Netflix, Disney+, Prime Video, ChatGPT, Gemini, Claude, Spotify, Canva, Steam, Xbox y PlayStation, sustituyendo las herramientas de desbloqueo tradicionales.
- **Filtro del Catálogo (`catalogController.js`):**
  - Identifica peticiones con el parámetro `?digitalPass=true` o encabezado `X-Digital-Pass: true`.
  - Aplica un filtro de lista blanca por expresiones regulares sobre nombres de servicios (`streaming`, `netflix`, `chatgpt`, `canva`, `iptv`, etc.) y descarta automáticamente categorías de telefonía (`bypass`, `icloud`, `carriers`, `frp`, etc.).
  - **Grupos Personalizados:** Si el administrador asigna un servicio a un grupo que incluya palabras como `Streaming`, `Digital`, `IA` o `Pass` en el panel admin, este aparecerá automáticamente en DigitalPass.

---

## 7. Motor de WhatsApp y Cola Centralizada (`whatsappEngine.js` & `whatsappBot.js`)

El subsistema de WhatsApp opera como un motor autónomo con endpoints API protegidos y control estricto de ritmos y tiempos:

1. **Gestión de Candado de Instancia Única (`bot.lock` Process-Aware):**
   - Para evitar que múltiples procesos compitan por las credenciales de sesión en `baileys_auth/` (lo que causaría desconexión inmediata), el bot registra su PID en `bot.lock`.
   - Utiliza detección activa (`process.kill(pid, 0)`). Si el proceso previo se cerró forzosamente, el candado se recicla automáticamente sin requerir intervención manual.

2. **Motor Central de Delays y Rate Limiting (`src/whatsappEngine.js`):**
   - Centraliza el control de pausas (`minDelayMs: 1200`, `maxDelayMs: 2000`) para evitar bloqueos por spam o sobrecarga de sockets.
   - Sincroniza la zona horaria unificada (`America/Mexico_City`) mediante `getEngineTimestamp()`, asegurando que las alertas de pedidos y comprobantes bancarios reflejen la hora real de México.
   - Reintentos exponenciales automáticos (hasta 3 intentos) para paquetes caídos o timeouts de red.

3. **Endpoints de Monitoreo y Sincronización del Motor (`/api/bot/*`):**
   - **`GET /api/bot/time`**: Retorna la hora del servidor en formato ISO y la hora oficial formateada en Ciudad de México para sincronización de clientes y logs.
   - **`POST /api/bot/queue-status`**: Verifica el número de mensajes pendientes en cola de despacho (protegido por `BOT_SECRET`).
   - **`POST /api/bot/search`**, **`/catalog`**, **`/order`**: Endpoints para ejecución remota de pedidos y consultas desde el bot sin código disperso.

4. **Prevención del fallo "Esperando mensaje" (Waiting for this message):**
   - Emite actualizaciones de presencia (`sendPresenceUpdate('available')` y `sendPresenceUpdate('composing')`) antes de transmitir datos para asegurar el intercambio previo de llaves de cifrado en Baileys.

---

## 8. Persistencia y Base de Datos (SQLite + JSON Cache)

El sistema combina el rendimiento de archivos JSON para configuraciones dinámicas con la robustez de SQLite para operaciones transaccionales:

### 1. `data/database.sqlite` (Transaccional)
- **`Users`:** Cuentas registradas, contraseñas con hash, rol (`admin`, `reseller`, `client`), balance disponible y créditos cedidos.
- **`OrdersHistory`:** Historial de todas las órdenes, ID interno, ID de proveedor, detalles (IMEI, usuario, cuenta), costo real, precio cobrado, estado (`Pending`, `In Process`, `Completed`, `Rejected`) y respuesta del servidor.
- **`BankTransactions`:** Registro de comprobantes de pago y recargas bancarias.

### 2. Archivos JSON en `data/`
- **`settings.json`:** Parámetros de conexión a APIs DHRU y tasas de cambio.
- **`custom_groups.json`:** Mapeo de reclasificación de categorías creado por el admin.
- **`prices_*.json`:** Caché de precios para acelerar el renderizado sin recalcular fórmulas en cada vista.
- **`audit_blackbox.log`:** Caja negra criptográfica de auditoría inalterable (*Append-Only* con Hash Chaining).

---

## 8.1. Motor de Respaldos, Resiliencia y Caja Negra Inalterable (`src/backupEngine.js`)

Para asegurar la **total portabilidad agnóstica entre servidores, VPS o Clouds** (AlwaysData, Hetzner, AWS, Docker, Fly.io) y garantizar la recuperación ante cualquier desastre o contingencia:

1. **Respaldos Automáticos por Evento Financiero (`autobackup_*.json`):**
   - Se activan inmediatamente ante creación de usuarios, recargas de saldo, transferencias o creación de pedidos.
   - Capturan el estado íntegro de SQLite y todos los archivos JSON de reglas, precios y credenciales.
   - Se almacenan en `data/backups/instant/` con rotación automática de los últimos 30 eventos.

2. **Respaldos Programados cada 24 Horas (`daily_backup_*.json`):**
   - El servidor Express mantiene un temporizador continuo en memoria (`initBackupScheduler()`) y un endpoint cron invocable externamente (`GET /api/cron/backup-24h`).
   - Genera un archivo consolidado con sello de tiempo diario en `data/backups/daily/` con retención de 30 días.

3. **Caja Negra Criptográfica Inalterable (`audit_blackbox.log`):**
   - Cada evento administrativo, financiero o de respaldo se escribe en un registro *Append-Only* estructurado.
   - **Hash Chaining (Tipo Blockchain Ligero)**: Cada línea calcula su hash SHA-256 enlazándose al `entryHash` de la línea anterior comenzando desde `GENESIS_BLOCK`. Cualquier alteración manual o borrado intermedio rompe la cadena criptográfica de verificación de integridad.

4. **Herramienta CLI de Migración y Recuperación ante Desastres (`scripts/migrationTool.js`):**
   - Permite migrar todo el sistema entre hosts en segundos sin depender de la UI:
     ```bash
     # 1. En el host de origen: Exportar paquete universal completo
     node scripts/migrationTool.js export backup_migracion.json

     # 2. En el nuevo host: Importar y reconstruir base de datos y JSONs
     node scripts/migrationTool.js import backup_migracion.json

     # 3. Verificar estado de respaldos e integridad de la caja negra
     node scripts/migrationTool.js verify
     ```

## 9. Despliegue y Mantenimiento en AlwaysData

### Despliegue Automatizado
El script `./deploy.sh` sincroniza los cambios locales hacia el servidor de producción excluyendo carpetas de autenticación y bases de datos vivas:
```bash
./deploy.sh
```

### Reinicio del Servidor Web (Passenger)
Para reiniciar el servidor Express y cargar cambios de rutas o controladores:
```bash
curl -s -H "Authorization: Bearer 1" -H "X-Bot-Secret: MEGA_BOT_SECRET_2026" https://megaunlockphone-panel.alwaysdata.net/api/kill
```

### Reinicio o Chequeo del Bot de WhatsApp
Si necesitas verificar el estado del bot directamente por terminal SSH:
```bash
# Ver proceso activo
ps aux | grep -E 'node|whatsappBot'

# Ver últimos logs del bot
tail -n 50 ~/www/bot_logs.txt

# Iniciar bot en segundo plano si fue detenido
cd ~/www && nohup bash start_bot.sh > bot_logs.txt 2>&1 &
```
