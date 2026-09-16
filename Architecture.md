# 🏗️ Arquitectura y Notas para Desarrolladores

## Estructura General
Este proyecto es el cliente web para la API de Dhru Fusion y otros servicios de desbloqueo (GSM).

- `server.js`: Archivo de orquestación principal (Express). Inicializa middlewares globales, pero la lógica de enrutamiento y negocio se está trasladando a la carpeta `src/`.
- `src/`: Lógica centralizada.
  - `db.js`: Caché en memoria y lectura/escritura (I/O) síncrona a archivos JSON.
  - `utils.js`: Helpers globales compartidos.
  - `middleware.js`: Capa de seguridad y autenticación (requireAuth).
  - `payments.js`: Controlador de depósitos y validaciones Banxico/SPEI.
  - `history.js`: Controlador de historial de órdenes.
- `paymentRouter.js`: (NUEVO) Enrutador inteligente para transferencias SPEI. Contiene la lógica del **Colchón de Créditos** para decidir si los fondos se depositan a la cuenta del Admin o del Proveedor.
- `bankConfig.js`: Catálogo de cuentas CLABE del admin y de los distintos proveedores GSM.
- `whatsappBot.js`: Script externo (Baileys) para manejar la comunicación de WhatsApp (Búsquedas, Ordenar IMEI, Recargas automáticas).
- `public/`: Carpeta con todo el frontend (HTML, CSS, JS).
  - `public/index.html`: La vista principal (SPA) que agrupa Perfil, Catálogo, Historial de Órdenes, y ahora Historial de Recargas.
  - `public/index.js`: Contiene toda la lógica del frontend, consumo de las APIs, renderizado dinámico de las tablas y apertura de modales (incluyendo los tickets y devoluciones).
- `data/`: Almacena las "bases de datos" en formato JSON.
  - `users.json`: Usuarios, roles (admin, reseller, colaborador), balances y configuraciones de crédito.
  - `custom_prices.json`: (NUEVO) Configuración de precios manuales y precios exclusivos por revendedor.
  - `history.json`: Historial de pedidos realizados a la API.
  - `recharges.json`: (NUEVO) Registro inmutable de cada recarga de saldo que se aplica a un usuario.
  - `refund_logs.json`: (NUEVO) Registro interno de los reembolsos procesados (Automáticos o Manuales).
  - `settings.json`: Configuración global, tipo de cambio, **colchón de retención SPEI**, balance de ganancias del admin, etc.

## 🤖 Integración del Bot de WhatsApp
El bot (`whatsappBot.js`) interactúa directamente con `server.js` a través de webhooks internos (`/api/bot/*`). El bot respeta la misma lógica de "Precios Especiales" y márgenes definidos en el Panel Web. Cuenta con protecciones contra errores matemáticos si hay valores corruptos (`NaN`) en los precios.

## 🔀 Sistema SPEI Inteligente (paymentRouter)
Cuando un cliente solicita una recarga SPEI, el sistema calcula la **liquidez neta del servidor**:
`Liquidez Neta = (Total Créditos en Servidor - Suma Créditos Cedidos a Revendedores) - Colchón de Retención`
- Si la solicitud del cliente es **menor o igual** a la liquidez neta, se le asigna la CLABE del Administrador.
- Si la solicitud es **mayor**, se le asigna la CLABE directa del Proveedor para fondear la cuenta raíz.

## 💸 Sistema de Reembolsos
El sistema incluye una función unificada `processRefund()` en `server.js`.
1. **Reembolsos Automáticos:** Cuando la función `pollPendingOrders` (ejecutada mediante el cron en `/api/cron/sync`) detecta que el estatus cambió de "pending" a "rejected", llama a `processRefund()`, el cual devuelve los créditos al usuario y resta el profit al administrador.
2. **Reembolsos Manuales:** El admin puede forzar el reembolso de cualquier orden que no esté `success` directamente desde el panel de órdenes.

## 📊 Historial de Recargas
Cualquier modificación positiva del saldo llama a la función `logRecharge()`:
- Desde el bot de WhatsApp (`/api/bot/add_money`).
- Desde la edición manual del admin (`/api/users/:id`).
- Desde los depósitos SPEI (vía Banxico).

## 🪟 Modales y UI
La interfaz SPA oculta/muestra secciones usando `classList.remove('hidden')`. 
Las vistas principales son: `productsSection` (Catálogo), `historySection` (Pedidos), `adminSection` (Gestión) y `rechargesSection` (Recargas).
