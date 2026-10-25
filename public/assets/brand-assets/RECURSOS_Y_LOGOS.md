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

## 🛠️ Logos Oficiales de las Herramientas GSM (URLs de Alta Resolución)

| Herramienta | Web Oficial | URL Directa de Logo / Icono |
| :--- | :--- | :--- |
| **UnlockTool** | [unlocktool.net](https://unlocktool.net/) | `https://unlocktool.net/images/logo.png` |
| **TSM Tool Pro** | [tsm-tool.com](https://tsm-tool.com/) | `https://tsm-tool.com/assets/img/logo.png` |
| **Pandora Box / Tool** | [pandora-box.org](https://pandora-box.org/) | `https://gsmserver.com/nfs/product/889240/image/large/889240-pandora-box.jpg` |
| **Octoplus / Octopus** | [octoplusbox.com](https://octoplusbox.com/) | `https://octoplusbox.com/wp-content/themes/octoplus/images/logo.png` |
| **Pandonymus MDM** | Pandonymus Server | Icono de Panda cibernético con escudo de seguridad |

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
