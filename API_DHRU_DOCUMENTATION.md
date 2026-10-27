# 📖 Documentación Oficial de API Bridge & DHRU Fusion Gateway
**MegaUnlockPhone Platform - Arquitectura Oficial de Proveedor**

> Esta documentación describe el funcionamiento técnico para revendedores, desarrolladores y clientes que deseen conectar sus propios sistemas (WordPress, WHMCS, DHRU Fusion, bots de mensajería o desarrollos a medida en Python, Node.js, PHP, etc.) a la API de **MegaUnlockPhone**.

---

## 🏗️ 1. Triangulación de Saldo y Fondos: ¿Cómo Funciona el Flujo de Dinero?

Cuando operas como revendedor de MegaUnlockPhone, existen **dos niveles de transacciones completamente independientes**:

```
[ Cliente Final ]  ---> (Paga SPEI / Banco) --->  [ Tu Panel Reseller Lite ]
                                                               |
                                                   (Deduce saldo de tu Billetera)
                                                               v
                                                [ MegaUnlockPhone (Tu Proveedor) ]
                                                               |
                                                   (Procesa el IMEI / Cuenta)
                                                               v
                                                    [ Servidores de Red ]
```

### El Proceso Paso a Paso:
1. **Cobro a tu Cliente:** Tu cliente entra a tu web, solicita un servicio (ej. Desbloqueo de Red $350 MXN) y te deposita a **tu cuenta bancaria personal** (SPEI / Nu / BBVA). Tú te quedas con el dinero del cliente al 100%.
2. **Tu Saldo con MegaUnlockPhone:** Para que la orden se envíe a procesar, tu cuenta de Reseller en MegaUnlockPhone debe contar con saldo suficiente (ej. Tu costo de revendedor es de $250 MXN).
3. **Ganancia Neta Instantánea:**
   - Cobrado al cliente: `$350 MXN`
   - Pagado a MegaUnlockPhone por API: `$250 MXN`
   - **Tu ganancia neta:** `$100 MXN` (disponible directamente en tu cuenta bancaria).
4. **Reembolsos Automáticos:** Si una orden es rechazada por el servidor (ej. IMEI reportado o no soportado), MegaUnlockPhone devuelve el 100% del saldo cobrado a tu billetera de revendedor en segundos. Tu sistema luego le devuelve el saldo al cliente en su cuenta local.

---

## 🔒 2. Seguridad & Responsabilidad Compartida
- **MegaUnlockPhone se hace cargo de:** La estabilidad de la API, la entrega de los códigos de desbloqueo, cuentas de streaming y reposición de saldos en caso de rechazos del servidor.
- **El Reseller se hace cargo de:** La custodia de su `API Key`, la seguridad de sus servidores locales, la validación de sus clientes y la confirmación de pagos SPEI recibidos en su cuenta bancaria.

---

## ⚡ 3. Endpoints Disponibles de la API

MegaUnlockPhone ofrece **dos protocolos simultáneos**:

### A. Protocolo Estándar DHRU Fusion (Compatible con plugins DHRU oficiales)
- **Servidor 1 (MEGA-SERVER - IMEI & Red):**
  - **URL Gateway:** `https://megaunlockphone-panel.alwaysdata.net/api/v1/s1/dhru`
  - **Método:** `POST`
- **Servidor 3 (OMEGA-SERVER - Streaming & DigitalPass):**
  - **URL Gateway:** `https://megaunlockphone-panel.alwaysdata.net/api/v1/s3/dhru`
  - **Método:** `POST`

#### Acciones soportadas por el DHRU Gateway:
- `accountinfo`: Devuelve el balance actual del revendedor en MXN.
- `imeiservicelist`: Catálogo completo de servicios IMEI con tus precios de revendedor.
- `serverservicelist`: Catálogo de servicios de servidor, licencias y streaming.
- `placeimeiorder`: Envía una orden de liberación de IMEI (`ID`, `IMEI`).
- `placeserverorder`: Envía una orden de servidor (`ID`, `param`).
- `getimeiorder` / `getserverorder`: Consulta el estado en tiempo real (`Pending`, `Inprocess`, `Success`, `Rejected`).

### B. Protocolo REST JSON Moderno
- **Consultar Saldo:** `GET /api/v1/s1/account`
- **Consultar Catálogo:** `GET /api/v1/s1/catalog`
- **Enviar Pedido:** `POST /api/v1/s1/order`
  ```json
  {
    "serviceid": "105",
    "imei": "358741098234567"
  }
  ```
- **Historial de Pedidos:** `GET /api/v1/s1/history`

---

## 🔑 4. Autenticación Criptográfica
Todas las peticiones deben incluir la cabecera:
\`\`\`http
X-API-Key: mup_live_tu_llave_aqui
\`\`\`
O enviarse mediante el parámetro estándar de DHRU `apiaccesskey` y `username`.

---

## 🌐 5. ¿Open Source vs. Código Protegido? Nuestro Enfoque Híbrido

Para responder a tu duda estratégica sobre el código:

1. **La API es Abierta y Estándar (DHRU Fusion):** Si tu cliente es un programador o ya tiene su propia web en WordPress/WHMCS/PHP, **puede usar la API libremente**. Esto te hace ganar clientes de gran volumen que ya tienen sus plataformas.
2. **La UI de Reseller Lite es Protegida y Ofuscada:**
   - La interfaz web y el motor preconstruido que les entregas está **ofuscado y blindado contra manipulación de host**.
   - No pueden cambiar la URL del servidor principal en el código porque rompería la firma criptográfica SHA-256.
   - De esta manera, **disfrutan de una web completa gratis para ellos, pero todo su tráfico y ventas pasan obligatoriamente por tu negocio.**
