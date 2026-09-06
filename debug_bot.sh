#!/bin/bash
echo "=== MATANDO PROCESOS ==="
pkill -f "whatsappBot.js"
sleep 2

echo "=== CARGANDO NODE ==="
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
node -v

echo "=== INICIANDO BOT ==="
cd $HOME/www
node whatsappBot.js
