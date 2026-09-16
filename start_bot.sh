#!/bin/bash
cd $HOME/www
# Para que funcione como "Service", debe correr de frente (sin el símbolo '&' al final)
# Usamos exec para que reemplace el proceso bash y AlwaysData pueda monitorearlo bien
exec node whatsappBot.js
