#!/bin/bash
echo "🚀 Iniciando despliegue hacia AlwaysData..."

# Se suben los archivos sincronizando la carpeta actual pero EXCLUYENDO carpetas sensibles
# para no sobreescribir la base de datos real (data) ni la de node_modules.
rsync -avzc --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'data' \
  --exclude 'baileys_auth' \
  --exclude '.wwebjs_auth' \
  --exclude 'package-lock.json' \
  ./ megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net:~/www/

echo "✅ ¡Subida completada! Recuerda reiniciar tu servidor si hiciste cambios."
