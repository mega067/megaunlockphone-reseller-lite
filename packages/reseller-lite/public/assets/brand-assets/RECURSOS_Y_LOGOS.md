# 🎯 Assets & Recursos Oficiales: MegaUnlockPhone

Este directorio contiene las referencias, URLs públicas e identidades visuales para creación de publicidad, artes promocionales y branding.

---

## 💎 Identidad de Marca: MegaUnlockPhone
- **Nombre:** MegaUnlockPhone
- **Logo Local:** `public/logo.png` y `public/assets/brand-assets/megaunlockphone-logo.png`
- **Logo URL Producción:** `https://megaunlockphone-panel.alwaysdata.net/logo.png`
- **Facebook Oficial:** [https://www.facebook.com/share/1DjDKeofvo/](https://www.facebook.com/share/1DjDKeofvo/)
- **WhatsApp Oficial / Soporte:** `+52 221 693 6720`
- **Paleta de Colores de Marca:**
  - Primario Neón: Cian Neón `#38bdf8` / Azul Eléctrico `#2563eb`
  - Acento: Violeta / Magenta Neón `#ec4899` / `#a855f7`
  - Éxito / WhatsApp: Verde WhatsApp `#22c55e` / `#25D366`
  - Fondos: Slate Ultra Oscuro `#0b0f19` / Fondo Glassmorphism `rgba(15, 23, 42, 0.75)`
  - Tipografías: Outfit / Inter / Roboto Mono (para códigos/precios)

---

## 🛠️ Logos y Cajas 3D Oficiales de las Herramientas GSM

| Herramienta | Web Oficial | Asset Local de Alta Resolución / 3D Box |
| :--- | :--- | :--- |
| **UnlockTool (3D Retail Box)** | [unlocktool.net](https://unlocktool.net/) | `public/assets/brand-assets/official-boxes/unlocktool_box_3d.png` |
| **TSM Tool (3D Box & Software)** | [tsm-tool.com](https://tsm-tool.com/) | `public/assets/brand-assets/official-boxes/tsm_box_and_software.png` |
| **Pandora Box / Tool** | [pandora-box.org](https://pandora-box.org/) | `https://gsmserver.com/nfs/product/889240/image/large/889240-pandora-box.jpg` |
| **Octoplus / Octopus** | [octoplusbox.com](https://octoplusbox.com/) | `https://octoplusbox.com/wp-content/themes/octoplus/images/logo.png` |
| **Pandonymus MDM** | Pandonymus Server | Icono de Panda cibernético con escudo de seguridad |

---

## 🖼️ Flyers Maestros Oficiales Generados

- **Flyer Master 3D Boxes + QR Verificado:**
  - Archivo Local: `public/assets/brand-assets/flyers/flyer_ultra_pro_boxes_qr_master.jpg`
  - Carpeta PC: `/home/angel/MegaUnlockPhone_Flyers_Assets/flyer_ultra_pro_boxes_qr_master.jpg`
  - URL Producción: `https://megaunlockphone-panel.alwaysdata.net/assets/brand-assets/flyers/flyer_ultra_pro_boxes_qr_master.jpg`


---

## 📡 Endpoints de API para Gestión de Precios Custom & Rentas

- **Listar Precios Custom Activos:**
  - `GET /api/services/admin/custom-prices` (Header: `X-Server-Id: 1`, `Authorization: Bearer <TOKEN>`)
- **Obtener Sugerencias de Mercado Minorista (FB/GSM):**
  - `GET /api/services/admin/market-suggestions` (Header: `X-Server-Id: 1`, `Authorization: Bearer <TOKEN>`)
- **Establecer Precio Manual (Individual o Bulk):**
  - `POST /api/admin/product-price` (Body: `{ serviceid, resellerPrice, clientPrice }` o `{ bulk: [...] }`)
- **Restablecer Precio (Volver a cálculo automático):**
  - `DELETE /api/admin/product-price/:serviceid`
