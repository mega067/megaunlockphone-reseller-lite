# 🚀 Monta tu Propia Tienda de Desbloqueos, Streaming & Licencias en Minutos
### **MegaUnlockPhone Reseller Lite Engine (v1.0.0)**

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-success.svg)]()
[![API Protocol](https://img.shields.io/badge/Protocol-DHRU%20Fusion%20%7C%20REST-cyan.svg)](https://megaunlockphone-panel.alwaysdata.net/api/v1/docs)

> **¿Quieres iniciar tu propio negocio de servicios digitales, liberaciones de telefonía y cuentas premium?**  
> **MegaUnlockPhone Reseller Lite** es una plataforma web completa, rápida y moderna diseñada para que montes tu propia página de ventas en tu propio servidor (VPS, cPanel, AlwaysData, Docker, etc.) con conexión directa al proveedor mayorista.

---

## 📸 Vista Previa de la Plataforma

```
┌────────────────────────────────────────────────────────────────────────┐
│ ⚡ MiTienda Digital | Panel Reseller                         [Enlace Activo] │
├──────────────┬─────────────────────────────────────────────────────────┤
│ 📱 Catálogo   │  [ 📱 Servidor 1: IMEI ]  [ 🎬 Servidor 2: Streaming ]  │
│ 📦 Mis Pedidos│                                                         │
│ 💳 Recargas   │  ┌─────────────────────────┐  ┌──────────────────────┐  │
│ 🧩 Módulos    │  │ Desbloqueo Red Motorola │  │ Netflix 1 Pantalla   │  │
│ ⚙️ Branding   │  │ Precio: $180.00 MXN     │  │ Precio: $65.00 MXN   │  │
│              │  │ [ Ordenar Servicio ]    │  │ [ Ordenar Cuenta ]   │  │
│              │  └─────────────────────────┘  └──────────────────────┘  │
│              │  📊 Estadísticas: 120 Servicios Activos | 450 Pedidos   │
└──────────────┴─────────────────────────────────────────────────────────┘
```

---

## ✨ Características Principales

- ⚡ **Despliegue Instantáneo:** Instala dependencias y corre en menos de 2 minutos.
- 📱 **Catálogo Dual en Vivo:**
  - **Servidor 1 (IMEI / Liberaciones):** Desbloqueos de red, bypass, reparaciones remotas y licencias GSM.
  - **Servidor 2 (DigitalPass / Streaming):** Netflix, Max, Disney+, YouTube Premium, ChatGPT Plus y software.
- 💵 **Margen de Ganancia 100% Configurable:** Tú decides cuánto ganarle a cada servicio (ej. 15%, 25%, 35%). El sistema calcula los precios automáticamente.
- 💳 **Módulo de Recargas SPEI para tus Clientes:** Tus clientes te transfieren directamente a tu banco personal (CLABE, Tarjeta o SPEI) y tú acreditas sus saldos.
- 🤖 **Gestor Gráfico de Módulos (Sin tocar código):**
  - Activa o desactiva con un switch el **Bot de WhatsApp**, **Motor Financiero** o **Portal DigitalPass**.
  - Configura tu número de WhatsApp y nombre de tienda visualmente.
- 👑 **Control de Administradores & Clientes:**
  - **SuperAdmin Preferente:** El creador del panel es el dueño absoluto intocable.
  - **Admins secundarios:** Crea operadores o colaboradores con accesos específicos.

---

## 🔑 ¿Cómo Obtener tu API Key de Proveedor?

Para que tu tienda tenga catálogo en tiempo real y procese los pedidos automáticamente:

1. Regístrate o inicia sesión en la plataforma mayorista oficial:  
   👉 **[https://megaunlockphone-panel.alwaysdata.net](https://megaunlockphone-panel.alwaysdata.net)**
2. Ve a la sección **Mi Perfil** o haz clic en **API Bridge / Developers**.
3. Presiona el botón verde **"Generar API Key"**.
4. Copia tu llave criptográfica (formato `mup_live_...`).
5. Listo. Esa llave es la que ingresarás en tu panel de Reseller Lite en la pestaña **Ajustes & Branding**.

> 💡 **LLAVE DE PRUEBA INMEDIATA (SANDBOX DEMO KEY):**  
> Si quieres probar el funcionamiento y catálogo de inmediato sin registrarte aún, usa esta credencial activa de pruebas con saldo cargado:
> - **Usuario Demo:** `demo_reseller`
> - **API Key:** `mup_live_demo777888999aaaabbbbccccdd`
> - **Saldo Demo:** `$250.00 MXN` (Servidor 1) / `$250.00 MXN` (Servidor 2)

---

## 🚀 Instalación Paso a Paso

### 1. Clonar el Repositorio
\`\`\`bash
git clone https://github.com/mega067/megaunlockphone-reseller-lite.git
cd megaunlockphone-reseller-lite
\`\`\`

### 2. Instalar Dependencias
\`\`\`bash
npm install
\`\`\`

### 3. Iniciar tu Tienda Web
\`\`\`bash
npm start
\`\`\`

Abre tu navegador web en:  
👉 **`http://localhost:4000`**

---

## 🛠️ Configuración Inicial en 3 Clics

1. Abre el panel en tu navegador y ve a la pestaña **"Ajustes & Branding"**.
2. **Personaliza tu Marca:**
   - Nombre de tu tienda (ej. *GSM Desbloqueos México*).
   - Ícono o logo (ej. ⚡, 📱, 💎).
   - Tu número de WhatsApp de soporte con código de país (ej. `52221xxxxxxx`).
   - Tu margen de ganancia deseado (ej. `20%`).
3. **Conecta tu API:** Pega tu **API Key** obtenida en MegaUnlockPhone y tu usuario.
4. ¡Tu tienda ya está lista para recibir clientes y tomar órdenes!

---

## 💰 ¿Cómo Funciona el Flujo de Dinero?

```
[ Tu Cliente ]  ---> (Te paga a tu Banco / SPEI) --->  [ Tu Tienda Reseller Lite ]
                                                              │
                                            (Deduce costo mayorista vía API)
                                                              ▼
                                               [ MegaUnlockPhone (Proveedor) ]
```

- **Tú recibes el dinero del cliente al 100% en tu cuenta bancaria.**
- Tu panel se conecta por API con tu balance de MegaUnlockPhone y descuenta el costo mayorista.
- **Tu ganancia neta queda en tu bolsillo inmediatamente.**

---

## 🌐 Despliegue en Servidores de Producción

### En AlwaysData / Phusion Passenger:
1. Sube los archivos a tu carpeta raíz o subdominio.
2. Configura tu comando de inicio como: `node server.js`
3. Define el puerto proporcionado en el entorno.

### Con PM2 (Cualquier VPS Linux / Ubuntu):
\`\`\`bash
npm install -g pm2
pm2 start server.js --name "mi-tienda-reseller"
pm2 save
pm2 startup
\`\`\`

---

## 🛡️ Seguridad & Responsabilidad
- **El Proveedor (MegaUnlockPhone):** Garantiza la entrega de los códigos, licencias, estabilidad de la API y reembolsos automáticos en caso de pedidos rechazados por servidores externos.
- **El Reseller:** Es responsable de custodiar su API Key, comprobar las transferencias que sus clientes dicen haber realizado y brindar atención de soporte directo a sus compradores.

---

## 🤝 Soporte Oficial
¿Necesitas ayuda para activar tu API Key o integrar módulos especiales?  
- **Soporte Mayorista:** [WhatsApp Oficial](https://wa.me/522216936720?text=Hola%2C%20solicito%20asistencia%20con%20mi%20tienda%20Reseller%20Lite)  
- **Documentación de la API:** [API_DHRU_DOCUMENTATION.md](https://github.com/mega067/MegaUnlockPhone/blob/main/API_DHRU_DOCUMENTATION.md)

© 2026 MegaUnlockPhone. Plataforma y motor distribuido para revendedores independientes.
