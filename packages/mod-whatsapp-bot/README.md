# 🤖 Módulo WhatsApp Bot & Notificaciones (mod-whatsapp-bot)

> **Repositorio:** `mod-whatsapp-bot`  
> **Rol:** Demonio Socket de Baileys para atención de clientes, consulta de saldo, tickets y alertas automáticas.

---

## 📌 1. Descripción
Módulo desacoplado encargado de establecer el socket con WhatsApp Web vía Baileys, gestionar comandos interactivos (`/saldo`, `/pedidos`, `/ticket`, `/ayuda`) y procesar la cola de mensajes salientes con algoritmos anti-baneo (delays humanizados y simulación de escritura).

---

## ⚙️ 2. Comunicación con el Núcleo (Core)
El bot **no accede directamente a la base de datos de producción**, sino que se comunica vía HTTP con `mup-core` enviando la cabecera de autenticación secreta:
```http
X-Bot-Secret: MEGA_BOT_SECRET_2026
```

---

## 🚀 3. Instalación e Inicio

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Iniciar el demonio del bot:
   ```bash
   npm start
   # O en segundo plano:
   ./start_bot.sh
   ```
3. Escanea el código QR que aparecerá en la terminal para autenticar tu sesión de WhatsApp.

---

## 🔧 4. Configuración (`config.json`)
```json
{
  "coreApiUrl": "http://localhost:3000",
  "botSecret": "MEGA_BOT_SECRET_2026",
  "adminPhone": "52221xxxxxxx@s.whatsapp.net",
  "antiBan": {
    "minDelaySeconds": 3.5,
    "maxDelaySeconds": 7.0,
    "batchPauseEvery": 5
  }
}
```
