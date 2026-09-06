# MegaUnlockPhone - Panel Cliente Dhru

Panel web para la gestión de desbloqueos, recargas y servicios digitales integrado con múltiples proveedores a través de la API de Dhru Fusion.

## Servidores de Proveedores Integrados
El panel soporta múltiples servidores Dhru configurables desde `settings.json`:
- **Servidor 1:** LatamGSM (Endpoints principales para recargas como Free Fire).
- **Servidor 2:** POPI-GSM.
- **Servidor 3:** UnlockerFast.

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
