# 🌐 Arquitectura Modular & Ecosistema de Repositorios (Master Blueprint)
**MegaUnlockPhone Platform - Ecosistema Modular 2026**

Este documento define la estructura de repositorios desacoplados, los contratos de comunicación entre el **Núcleo (Core)** y cada uno de los **Módulos Independientes**, así como las guías de inicio para desarrolladores y revendedores.

---

## 🏛️ 1. Mapa de Repositorios y Roles

| Repositorio / Paquete | Rol | Tipo | Dependencia |
|---|---|---|---|
| **`mup-core`** | **NÚCLEO PRINCIPAL (Core)** | Servidor Base + Gateway API Bridge | Ninguna (Es el host autoritativo) |
| **`mod-whatsapp-bot`** | Demonio de Mensajería & Notificaciones WhatsApp | Módulo Desacoplado | Conecta a `mup-core` vía HTTP REST (`BOT_SECRET`) |
| **`mod-finanzas`** | Motor Contable, Deudas y Ganancias Netas | Módulo Desacoplado | Conecta a `mup-core` vía SQLite / Internal API |
| **`mod-recharge-spei`** | Motor Bancario, Validación CEP Banxico & SPEI | Módulo Desacoplado | Conecta a `mup-core` vía Webhooks & API de Recargas |
| **`mod-digitalpass`** | Portal y Catálogo de Streaming & Herramientas IA | Módulo Desacoplado | Conecta a `mup-core` vía Endpoints de Servidor 3 |
| **`reseller-lite`** | Motor Web Ofuscado para Clientes Resellers | Cliente Distribuible | Conecta a `mup-core` vía HMAC SHA-256 inmutable |

---

## 🔑 2. El Núcleo: `mup-core` (¿Qué es y cómo se configura?)

El **Core** es el cerebro autoritativo de todo el sistema. Es el encargado de:
1. Gestionar usuarios, roles (`admin`, `reseller`, `customer`), billeteras y transacciones atómicas.
2. Servir el API Gateway DHRU Fusion compatible (`/api/v1/s1/dhru` y `/api/v1/s3/dhru`).
3. Registrar eventos en la **Caja Negra Criptográfica** (`audit_blackbox.log`).
4. Proveer la API interna protegida por token secreto para que los módulos se comuniquen.

### ⚙️ Variables de Entorno del Core (`.env`):
```ini
PORT=3000
NODE_ENV=production

# Secreto para autenticar módulos internos (Bot, Recargas, etc.)
BOT_SECRET=MEGA_BOT_SECRET_2026

# Llave de cifrado de sesiones y JWT
JWT_SECRET=super_secret_jwt_megaunlockphone_2026

# Rutas de base de datos
DB_FILE=data/database.sqlite
```

---

## 🧩 3. Guía de Inicio Rápido de Cada Módulo

Cada módulo se encuentra en su propia carpeta bajo `packages/` listo para ser versionado como repositorio Git independiente:

1. **[packages/mup-core/README.md](file:///home/angel/Projects/REPOS/dhru-client-web/packages/mup-core/README.md):** Manual del servidor principal y APIs de orquestación.
2. **[packages/mod-whatsapp-bot/README.md](file:///home/angel/Projects/REPOS/dhru-client-web/packages/mod-whatsapp-bot/README.md):** Demonio socket con Baileys, reconexión industrial y despacho anti-baneo.
3. **[packages/mod-finanzas/README.md](file:///home/angel/Projects/REPOS/dhru-client-web/packages/mod-finanzas/README.md):** Métricas de caja, gráficos de torta/balance y cálculo de márgenes.
4. **[packages/mod-recharge-spei/README.md](file:///home/angel/Projects/REPOS/dhru-client-web/packages/mod-recharge-spei/README.md):** Enlace con Banxico CEP y conciliación bancaria.
5. **[packages/mod-digitalpass/README.md](file:///home/angel/Projects/REPOS/dhru-client-web/packages/mod-digitalpass/README.md):** Portal independiente de streaming, licencias y software.
