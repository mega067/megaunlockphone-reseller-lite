# 🚀 GUÍA MAESTRA DE PROMPTS Y RECURSOS PARA GEMINI (SIN ALUCINACIONES)

Esta guía explica **exactamente cómo pedirle a Gemini que genere los flyers**, qué imágenes adjuntarle como referencia y cómo evitar que altere URLs o dibuje códigos QR falsos.

---

## ⚠️ La Regla de Oro de los Códigos QR con IA (Gemini / Midjourney / DALL-E)

> **IMPORTANTE:** Ningún modelo de IA generativa (Gemini Imagen, DALL-E o Midjourney) es capaz de dibujar los píxeles matemáticos de un código QR real.  
> Si le pides a la IA: *"dibuja un código QR con mi URL"*, la IA dibujará un patrón aleatorio que parece un QR pero **NO abre ningún enlace o abre sitios rotos**.

### ✅ La Solución Profesional: "El Recuadro o Pedestal Vacío"
Le pedimos a Gemini que cree el flyer publicitario completo y que deje un **"recuadro neón translúcido vacío de color oscuro"** listo para colocar el código QR. Luego tú (o el script) montas el archivo `qr_web_megaunlockphone.png` en ese recuadro con nitidez 4K.

---

## 📁 Recursos que debes tener listos (en tu PC o subir a Gemini)

Ubicación en tu computadora: `/home/angel/MegaUnlockPhone_Flyers_Assets/`

1. **`megaunlockphone-logo.png`**: Tu logo circular de Tuxpan Veracruz.
2. **`official-boxes/unlocktool_box_3d.png`**: La caja 3D negra oficial de UnlockTool.
3. **`official-boxes/tsm_box_and_software.png`**: La caja blanca 3D y ventana de TSM Tool.
4. **`qr_web_megaunlockphone.png`**: El código QR real verificado que abre `https://megaunlockphone-panel.alwaysdata.net/`.

---

## 📋 PROMPT MAESTRO #1: Flyer Dúo (UnlockTool + TSM Tool)

Copia y pega este texto tal cual en Google Gemini (adjunta las imágenes de las dos cajas de tu carpeta):

```text
Actúa como un diseñador gráfico senior de publicidad comercial tecnológica. Crea un cartel publicitario de alta gama para redes sociales (formato vertical 3:4 o 9:16).

MARCA Y ENCABEZADO:
- En la parte superior: Título con tipografía moderna "MEGAUNLOCKPHONE MÉXICO".
- En la esquina superior izquierda: Logotipo circular tecnológico de "MegaUnlockPhone Tuxpan Veracruz" con borde neón rosa y azul, con icono de smartphone y candado.

CENTRO - ESCAPARATE DE PRODUCTOS 3D:
- Monta sobre una plataforma holográfica cibernética las 2 cajas oficiales de software (basándote en las imágenes adjuntas):
  1. Caja 1 (Izquierda): Caja 3D negra mate de "UNLOCKTOOL", con el radar circular amarillo-naranja y el candado central naranja brillante.
  2. Caja 2 (Derecha): Caja 3D blanca de "TSM TOOL" con polígonos triangulares azules, el logotipo de engranaje con llave "TSM Turbo Service Mobile" y una ventana semitransparente de la interfaz del software detrás.

SECCIÓN DE PRECIOS (2 Cuadros flotantes de cristal con bordes neón):
- Caja Izquierda con borde amarillo/naranja (UNLOCKTOOL):
  * Título: UNLOCKTOOL
  * Renta 6H: $50 MXN
  * 3M: $399 MXN
  * 6M: $666 MXN
  * 12M: $1,050 MXN
- Caja Derecha con borde cian neón (TSM TOOL):
  * Título: TSM TOOL
  * Renta 3H: $50 MXN
  * Renta 6H: $70 MXN
  * 3M: $680 MXN
  * 6M: $975 MXN
  * 12M: $1,289 MXN

ZONA INFERIOR - LLAMADO A LA ACCIÓN:
- En la parte izquierda inferior: Un recuadro o marco cuadrado vacío con borde neón cian brillante iluminado (ESPACIO VACÍO RESERVADO DE FONDO OSCURO, SIN DIBUJAR NINGÚN CÓDIGO NI PATRONES DENTRO).
- Justo al lado del recuadro, texto tipográfico llamativo:
  "¡MEJORES PRECIOS Y ENTREGA AUTOMÁTICA 24/7 EN NUESTRA WEB!"
  "¡ESCANEA AQUÍ! ▶"

PIE DE PÁGINA (Barra oscura con iconos de contacto y pagos):
- Icono oficial de WhatsApp verde con el número: "+52 221 693 6720".
- Iconos oficiales y texto: "TRANSFERENCIA BANCARIA / SPEI (MÉXICO)", "BINANCE", "PAYPAL".

ESTILO VISUAL:
Fondo oscuro de circuito integrado cibernético con luces de neón en tonos azul cobalto (#0055ff), cian neón (#00ffff) y magenta (#ff007f). Composición limpia, simétrica, profesional, estilo Octane Render 8K, sin errores ortográficos.
```

---

## 📋 PROMPT MAESTRO #2: Flyer Individual de Solo UNLOCKTOOL

```text
Diseña un póster publicitario publicitario premium para redes sociales (formato vertical 9:16).
Marca: MegaUnlockPhone Tuxpan Veracruz.
Producto: Licencias y Rentas Oficiales de UNLOCKTOOL.

ELEMENTOS PRINCIPALES:
- En el centro: Una caja 3D negra oficial de UnlockTool de pie con el logotipo del radar concéntrico naranja brillante y candado central.
- Insignia destacada en neón magenta: "SOLO PARA TRABAJOS RÁPIDOS - RENTA DE 6 HORAS: $50 MXN".
- Tabla de precios en tarjetas translúcidas:
  * 3 MESES: $399 MXN
  * 6 MESES: $666 MXN
  * 12 MESES: $1,050 MXN
- Características destacadas: Eliminación de FRP, Desbloqueo de Red, Lectura/Escritura IMEI, Flash Firmware, Soporte Oficial.
- Espacio para QR: Un marco cuadrado neón cian completamente vacío con la indicación "MEJORES PRECIOS EN NUESTRA WEB - ESCANEA AQUÍ".
- Pie de contacto: WhatsApp "+52 221 693 6720", Binance, PayPal, Transferencia SPEI.
- Estética: Cyberpunk futurista, azul eléctrico y fucsia, calidad publicitaria 8K.
```

---

## 📋 PROMPT MAESTRO #3: Flyer Individual de Solo TSM TOOL

```text
Diseña un póster publicitario comercial de alta definición (formato vertical 9:16).
Marca: MegaUnlockPhone Tuxpan Veracruz.
Producto: TSM TOOL PRO (Turbo Service Mobile) - La herramienta todo en uno.

ELEMENTOS PRINCIPALES:
- En el centro: Caja de software 3D blanca con detalles geométricos azules y logotipo de engranaje/llave TSM Tool, con ventana de software abierta mostrando pestañas de marcas (Samsung, Xiaomi, Oppo, etc.).
- Sección "RENTAS POR TIEMPO":
  * 3H: $50 MXN
  * 6H: $70 MXN
- Sección "PLANES DE ACTIVACIÓN":
  * 3 MESES: $680.00 MXN
  * 6 MESES: $975.00 MXN
  * 1 AÑO: $1,289.00 MXN
- Slogan: "Más que una herramienta, es tu aliado".
- Marco neón vacío reservado para código QR con texto: "REGÍSTRATE EN NUESTRA WEB PARA PRECIOS RESELLER".
- Contacto: WhatsApp "+52 221 693 6720", métodos de pago SPEI, Binance, PayPal.
- Acabado: Alta tecnología, tonos azul noche, cian y magenta neón.
```

---

## 🛠️ Cómo fusionar el QR real con 1 solo comando (100% Automático)

Una vez que Gemini te entregue la imagen generada, puedes colocar el QR real perfectamente alineado ejecutando este script en tu terminal:

```bash
# Ejemplo: colocar el QR real en tu flyer generado
magick tu_flyer_gemini.jpg public/assets/brand-assets/qr_web_megaunlockphone.png -geometry +86+766 -composite flyer_final_listo.jpg
```
Esto garantiza que el QR sea **100% nítido, sin deformaciones y probado para que cualquier teléfono abra tu web de inmediato**.
