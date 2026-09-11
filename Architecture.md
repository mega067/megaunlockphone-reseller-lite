# 🏗️ Arquitectura y Notas para Desarrolladores

## Estructura General
Este proyecto es el cliente web para la API de Dhru Fusion y otros servicios de desbloqueo (GSM).

- `server.js`: El corazón del sistema. Contiene los endpoints HTTP (Express), las llamadas a la base de datos, las validaciones de pagos SPEI (Banxico) y los webhooks.
- `public/`: Carpeta con todo el frontend (HTML, CSS, JS).
  - `public/index.html`: La vista principal (SPA) que agrupa Perfil, Catálogo, Historial de Órdenes, y ahora Historial de Recargas.
  - `public/index.js`: Contiene toda la lógica del frontend, consumo de las APIs, renderizado dinámico de las tablas y apertura de modales (incluyendo los tickets y devoluciones).
- `data/`: Almacena las "bases de datos" en formato JSON.
  - `users.json`: Usuarios, roles (admin, reseller, colaborador), balances y configuraciones de crédito.
  - `history.json`: Historial de pedidos realizados a la API.
  - `recharges.json`: (NUEVO) Registro inmutable de cada recarga de saldo que se aplica a un usuario.
  - `refund_logs.json`: (NUEVO) Registro interno de los reembolsos procesados (Automáticos o Manuales).
  - `settings.json`: Configuración global, tipo de cambio, balance de ganancias del admin, etc.

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
