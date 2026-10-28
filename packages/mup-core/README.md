# 🏛️ MegaUnlockPhone - Núcleo Maestro (mup-core)

> **Repositorio:** `mup-core`  
> **Rol:** Servidor Backend Central, Motor de Autenticación, Billeteras y API Gateway DHRU Fusion.

---

## 📌 1. Descripción
El **Core** es el corazón del ecosistema. Provee la base de datos central en SQLite, el control de concurrencia y los endpoints autoritativos a los que todos los módulos externos e internos se conectan.

---

## 🛠️ 2. Requisitos & Dependencias
- Node.js versión 18 o superior.
- Compilador de C++ para SQLite (`better-sqlite3`).

---

## 🚀 3. Instalación e Inicio Rápido

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/mega067/mup-core.git
   cd mup-core
   ```
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Configurar el archivo `.env`:
   ```bash
   cp .env.example .env
   ```
4. Iniciar el servidor:
   ```bash
   npm start
   ```
   El servidor responderá en `http://localhost:3000`.

---

## 🔐 4. Parámetros de Configuración (`.env`)

| Variable | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| `PORT` | Número | Puerto de escucha HTTP | `3000` |
| `BOT_SECRET` | String | Token maestro para autorizar módulos (WhatsApp, Recargas) | `MEGA_BOT_SECRET_2026` |
| `JWT_SECRET` | String | Llave de firma de tokens de sesión de usuarios web | `mup_jwt_key_99` |
| `DB_PATH` | Ruta | Archivo SQLite de base de datos | `data/database.sqlite` |

---

## 📡 5. APIs Expuestas para Módulos

- **Autenticación Interna de Módulos:**  
  Todos los módulos deben enviar la cabecera:
  ```http
  X-Bot-Secret: MEGA_BOT_SECRET_2026
  ```
- **Rutas del Gateway:**
  - `POST /api/v1/s1/dhru`: Protocolo DHRU para Servidor 1 (IMEI / Red).
  - `POST /api/v1/s3/dhru`: Protocolo DHRU para Servidor 3 (DigitalPass / Streaming).
  - `GET /api/v1/s1/catalog`: Catálogo de servicios REST.
  - `POST /api/bot/notify`: Despacho de notificaciones a través del bot.
