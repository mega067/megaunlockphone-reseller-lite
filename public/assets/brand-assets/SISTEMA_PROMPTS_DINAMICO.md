# 🤖 SISTEMA DINÁMICO DE CREACIÓN DE FLYERS (PLANTILLA UNIVERSAL PARA GEMINI)

> **Instrucciones para el usuario:**  
> Copia y pega esta plantilla en el chat de **Google Gemini**. Puedes adjuntarle las imágenes de los logos o cajas de la carpeta `/home/angel/MegaUnlockPhone_Flyers_Assets/` y simplemente **rellenar o dictarle las herramientas y precios que quieras promocionar**.

---

## 📋 PROMPT MAESTRO DINÁMICO (Copia y Pega en Gemini)

```text
Actúa como un Diseñador Gráfico Publicitario Senior especializado en tecnología y telefonía móvil.
Tu tarea es diseñar un cartel publicitario comercial para redes sociales (formato vertical 3:4 o 9:16) con estética Cyberpunk Premium para la marca "MegaUnlockPhone México".

=========================
REGLAS DE IDENTIDAD Y MARCA (INVARIABLES):
=========================
1. Encabezado: Título principal en tipografía moderna "MEGAUNLOCKPHONE MÉXICO".
2. Logotipo de Marca: En la esquina superior izquierda, coloca el logotipo circular tecnológico de "MegaUnlockPhone Tuxpan Veracruz" con borde neón rosa y azul (basándote en el logo adjunto).
3. Pie de Página Obligatorio:
   - Icono oficial verde de WhatsApp con el número: "+52 221 693 6720"
   - Métodos de pago oficiales: Iconos y texto de "Transferencia Bancaria / SPEI (México)", "Binance (Todo el Mundo)", "PayPal (Todo el Mundo)".
4. Espacio para QR Web:
   - En la parte inferior izquierda, incluye un MARCO CUADRADO VACÍO con borde neón cian brillante iluminado (FONDO OSCURO TOTALMENTE LIMPIO Y VACÍO, SIN DIBUJAR NINGÚN CÓDIGO NI PATRONES DENTRO).
   - Justo al lado del marco, el texto tipográfico:
     "¡MEJORES PRECIOS Y ENTREGA AUTOMÁTICA 24/7 EN NUESTRA WEB!"
     "¡ESCANEA AQUÍ! ▶"
5. Estética Visual:
   - Fondo oscuro de placa de circuito impreso cibernético con luces neón azul cobalto (#0055ff), cian neón (#00ffff) y magenta (#ff007f).
   - Calidad publicitaria hiperrealista Octane Render 8K, composición limpia y simétrica, sin faltas ortográficas.

=========================
SERVICIOS Y PRODUCTOS A PROMOCIONAR (VARIABLES):
=========================
[INSTRUCCIÓN: Aquí puedes cambiar las herramientas, rentas o precios que quieras dictarle a Gemini]

• HERRAMIENTA(S) PRINCIPAL(ES):
  [Ejemplo 1: UnlockTool y TSM Tool]
  [Ejemplo 2: Pandora Box y Octoplus FRP]
  [Ejemplo 3: Chimera Tool y Cheetah Tool]
  -> Muestra en el centro las cajas 3D oficiales de los productos adjuntos sobre un pedestal tecnológico flotante.

• TABLA DE PRECIOS Y TARJETAS NEÓN:
  Organiza en tarjetas de cristal translúcido (Glassmorphism) con bordes neón los precios de los productos seleccionados:
  
  [PRODUCTO 1]:
  - Título: [Nombre del producto]
  - Rentas cortas (si aplica): [Ej: Renta 6H: $50 MXN]
  - Planes / Licencias: [Ej: 3 Meses: $399 MXN | 6 Meses: $666 MXN | 12 Meses: $1,050 MXN]

  [PRODUCTO 2]:
  - Título: [Nombre del producto]
  - Rentas cortas (si aplica): [Ej: Renta 3H: $50 MXN | Renta 6H: $70 MXN]
  - Planes / Licencias: [Ej: 3 Meses: $680 MXN | 6 Meses: $975 MXN | 12 Meses: $1,289 MXN]

• CARACTERÍSTICAS TÉCNICAS (Opcional, en iconos lineales):
  - Eliminación de FRP / Cuenta Google
  - Desbloqueo de Red (Network Unlock)
  - Reparación y Lectura de IMEI
  - Soporte y Actualizaciones Incluidas
```

---

## 💡 Ejemplos de Dictado Rápido que puedes enviarle a Gemini:

### Ejemplo A: Para Pandora Box + Octoplus
> *"Usa la estructura de MegaUnlockPhone Tuxpan Veracruz pero en productos pon:  
> 1) **Pandora Box**: Renta 48H: $295 MXN | Licencia 1 Año Digital: $1,590 MXN | Renovación: $1,550 MXN.  
> 2) **Octoplus FRP**: 3 Meses: $690 MXN | 6 Meses: $1,190 MXN | 1 Año Digital: $1,490 MXN."*

### Ejemplo B: Para Chimera Tool + Server Box
> *"Usa la estructura de MegaUnlockPhone Tuxpan Veracruz pero en productos pon:  
> 1) **Chimera Tool**: Créditos desde $22 MXN | Licencia Basic: $2,185 MXN | Licencia Pro: $3,279 MXN.  
> 2) **Server Box Multi-Dongle**: Renta 24 Horas: $99 MXN | Renta 1 Mes Completo: $299 MXN."*

---

## 🛠️ Comando para colocar el QR real con 1 clic
Cuando Gemini te entregue cualquier flyer generado, para estampar tu QR real centrado en el recuadro vacío, solo corre en tu terminal:

```bash
magick flyer_gemini.jpg /home/angel/MegaUnlockPhone_Flyers_Assets/qr_web_megaunlockphone.png -geometry +86+766 -composite flyer_terminado.jpg
```
*(El QR siempre abrirá `https://megaunlockphone-panel.alwaysdata.net/` de forma instantánea y garantizada).*
