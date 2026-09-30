# MegaUnlockPhone - Panel Cliente Dhru

Panel web para la gestión de desbloqueos, recargas y servicios digitales integrado con múltiples proveedores a través de la API de Dhru Fusion.

## Servidores de Proveedores Integrados
El panel soporta múltiples servidores Dhru configurables desde `settings.json`:
- **Servidor 1:** LatamGSM (Endpoints principales para recargas como Free Fire).
- **Servidor 2:** POPI-GSM.
- **Servidor 3:** UnlockerFast.

## 🚀 Nuevas Funcionalidades
- **Rediseño UI Premium Dark Mode**: Interfaz completamente renovada utilizando Glassmorphism, degradados modernos, banderas de servidores (México) integradas orgánicamente y alertas flotantes para Notificaciones.
- **Historial de Recargas Unificado**: Fusión de botones de recarga en una única pestaña. Registro inmutable de cada ingreso de saldo (vía SPEI, Bot o Panel Admin) con visualización de nombre de usuario en vista Admin.
- **Sistema Inteligente de Reembolsos**: Automáticos (cuando Dhru rechaza) y Manuales (desde el panel Admin).
- **Soporte Directo Bot WhatsApp**: Integración con un bot para procesar comandos de búsqueda, cotización y gestión de saldo.
- **Sistema SPEI Inteligente con Colchón**: Triangulación automatizada de pagos SPEI (Banxico CEP) donde el sistema elige a qué cuenta depositar (NU o STP) dependiendo de un "Colchón de Retención" (configurable por el admin).
- **Rastreo Completo en Historial de Recargas**: El panel de recargas ahora guarda y muestra en tiempo real la Clave de Rastreo de la transferencia SPEI, el nombre del Banco de Origen y el Banco de Destino (NU/STP/Proveedor). Notificaciones enriquecidas por WhatsApp con nombre del usuario y rastreo.
- **Precios Personalizados (Globales y Especiales)**: Gestión independiente del margen de ganancia a nivel Servidor, Servicio (Personalizado) o Usuario Específico.

## 🏗️ Nueva Arquitectura Modular
El servidor se está refactorizando en la carpeta `src/` para separar la lógica masiva de `server.js` y facilitar su mantenimiento:
- `src/db.js`: Manejo de la caché y persistencia JSON.
- `src/payments.js`: Lógica unificada de liquidez SPEI.
- `src/history.js`: Controlador del historial y devoluciones.
- `src/syncService.js`: Motor central unificado de sincronización y peticiones (bulk order status) a servidores Dhru/GSM.
- `paymentRouter.js`: Enrutador avanzado SPEI basado en la liquidez y reglas de los proveedores.

### Modularización del Frontend (Vanilla JS)
Para evitar mantener un archivo gigante monolítico y al mismo tiempo no romper los _closures_ y variables globales en el sistema de eventos actual en `index.js`, se implementó una estrategia de extracción progresiva usando Inyección de Dependencias (Namespace Pattern `window.MegaApp`):
- **`public/js/state.js`**: Nuevo gestor de estado global (`window.MegaApp.State`) encargado de centralizar variables críticas como Tokens, Sesión y Configuraciones compartidas, evitando la colisión de variables globales.
- **`public/js/utils.js`**: Funciones puras extraídas para el formateo de precios (MXN), sanitización XSS (`escapeHtml`) y coloreado inteligente de strings del servidor (`colorizeServerResponse`).
- **`public/js/api.js`**: Envoltorio asíncrono para llamadas `fetch`.
- **`public/js/notifications.js`**: Sistema híbrido (Dual) para sobrescribir `window.alert` con modales bloqueantes o notificaciones *Toast*.
- **`public/js/recharges.js`**: Lógica extraída de las interfaces y procesos de recargas manuales.
- **`public/js/ticket.js`**: Controlador inyectado para la gestión de logotipos y configuración del ticket de WhatsApp, completamente aislado del monolito.

### Optimizaciones de Rendimiento UI
- **Reducción de Lag/Tirones**: Se ajustó la frecuencia del `setInterval` de sincronización en segundo plano de 15 a 60 segundos para evitar bloqueos del DOM mientras el administrador navega.
- **Yielding (Sincronización Asíncrona)**: Los procesos pesados de renderizado masivo (cientos de componentes en catálogo y grupos) ahora ceden tiempo al *Event Loop* (usando `setTimeout` o Promesas), permitiendo que el navegador pinte los `spinners` de *"Sincronizando..."* o *"Cargando grupos..."* en lugar de congelar la pestaña.
- **Búsqueda Avanzada**: El motor de búsqueda (`public/js/searchEngine.js`) ahora soporta búsqueda multi-palabras (lógica AND en lugar de coincidencia exacta) y ordena los resultados priorizando siempre las coincidencias exactas en la parte superior.

## 🤖 Sistema de Bot de WhatsApp como Demonio
El bot de WhatsApp (`whatsappBot.js`) ahora funciona como un demonio continuo (User Service) en AlwaysData, a través del script corregido `start_bot.sh`.
Para evitar que el servidor web se duerma y deje de chequear el estado de los pedidos:
- El bot ejecuta un ping (`GET /api/cron/sync`) de manera ininterrumpida cada 3 minutos.
- Este ping despierta a `server.js`, el cual usa `syncService.js` para iterar sobre las órdenes `pending`.
- Si alguna orden cambió su estado en el proveedor, el servidor lo detecta, escribe el cambio en `queue.json`, y el bot procesa inmediatamente el mensaje de WhatsApp.

## Cambios Recientes y Correcciones Críticas

### Solución al Error "Faltan Varios Campos" en Servicios Free Fire (Servicio 154 - LatamGSM)
Se identificó que ciertas actualizaciones en la API de Dhru Fusion (v2025.03) generaron un comportamiento estricto en la recepción de campos personalizados (`CUSTOMFIELD`). 

**El problema:** 
Al enviar solicitudes mediante XML, el servidor respondía constantemente con el error `Faltan Varios Campos` en el servicio 154 (Free Fire - Direct Topup 210 Diamonds), a pesar de que el `PlayerID` se estaba enviando correctamente dentro de sub-etiquetas XML (`<CUSTOMFIELD><PlayerID>...</PlayerID></CUSTOMFIELD>`).

**La solución:**
Se implementó un parche en el código (`server.js`) para formatear el campo `CUSTOMFIELD` según el estándar estricto esperado por las versiones más recientes de Dhru Fusion API. En lugar de usar XML anidado, **el objeto JSON de los campos personalizados se codifica en Base64** y se envía dentro de la etiqueta `<CUSTOMFIELD>`.

*Ejemplo del XML generado ahora (Servidor 1):*
```xml
<PARAMETERS>
  <ID>154</ID>
  <IMEI>11975173546</IMEI>
  <QNT>1</QNT>
  <CUSTOMFIELD>eyJQbGF5ZXJJRCI6IjExOTc1MTczNTQ2In0=</CUSTOMFIELD>
</PARAMETERS>
```
*(Donde la cadena en Base64 corresponde a `{"PlayerID":"11975173546"}`)*

**Protección a otros servidores:**
Dado que otros servidores (como UnlockerFast - Servidor 3) pueden estar corriendo versiones antiguas de la API que aún requieren XML clásico, el parche de Base64 se aplicó **únicamente para el Servidor 1**, manteniendo compatibilidad total con el resto de los proveedores.

## Despliegue
Para aplicar cambios al panel en producción:
1. Subir los cambios a la rama `main`.
2. Ejecutar el script `deploy_server.py` para transferir los cambios vía SSH.
3. El panel se reiniciará automáticamente.

### Sistema Anti-Ban y Prevención de "Esperando el mensaje" (Baileys)
Se implementó un parche en el núcleo del bot (`whatsappBot.js`) para evitar que la aplicación sature a los destinatarios con ráfagas de mensajes:
- **Cola de Mensajes (Queueing)**: Los mensajes salientes se colocan en una cola secuencial en lugar de enviarse en paralelo.
- **Retraso Dinámico**: El bot inyecta un retraso aleatorio de **1.5 a 2.5 segundos** entre cada mensaje, simulando un comportamiento humano.
- **Sincronización de Presencia**: Antes de disparar el mensaje, el bot envía el estado `composing` (Escribiendo...), lo que obliga al cliente de WhatsApp destino a sincronizar las llaves de cifrado E2E de Baileys, erradicando el bug visual de "Esperando el mensaje".
