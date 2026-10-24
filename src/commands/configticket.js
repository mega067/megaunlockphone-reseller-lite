const path = require('path');
const fs = require('fs');
const { readDB, writeDB } = require('../../src/db');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function configticket(context) {
    const { sock, msg, remoteJid, firstWord, args, text, sessionManager, wusers, hasMedia } = context;
    const cmd = firstWord.toLowerCase();
    
    // Check if it's an ongoing session
    if (sessionManager.configTicketSessions[remoteJid]) {
        const session = sessionManager.configTicketSessions[remoteJid];
        const linkedUserId = wusers[remoteJid];
        
        if (text && text.toLowerCase() === 'cancelar') {
            sessionManager.clearSession(remoteJid);
            await sock.sendMessage(remoteJid, { text: '🚫 Configuración de ticket cancelada.' });
            return true;
        }

        if (session.step === 'ask_whatsapp') {
            const input = text.trim();
            if (!input) {
                await sock.sendMessage(remoteJid, { text: '❌ Por favor escribe un número válido (ej. +521234567890) o "ninguno".' });
                return true;
            }
            session.whatsapp = input.toLowerCase() === 'ninguno' || input.toLowerCase() === 'saltar' ? '' : input;
            session.step = 'ask_facebook';
            
            await sock.sendMessage(remoteJid, { text: '✅ Número guardado.\n\n2️⃣ Ahora, envía el *enlace de tu página de Facebook*.\nSi no tienes, escribe "ninguno" o "saltar".' });
            return true;
        } else if (session.step === 'ask_facebook') {
            const input = text.trim();
            session.facebook = (input.toLowerCase() === 'ninguno' || input.toLowerCase() === 'saltar') ? '' : input;
            session.step = 'ask_logo';
            
            await sock.sendMessage(remoteJid, { text: '✅ Facebook guardado.\n\n3️⃣ Finalmente, *envía la imagen de tu Logo* en este chat.\nSi no deseas logo, escribe "ninguno" o "saltar".' });
            return true;
        } else if (session.step === 'ask_logo') {
            let logoSaved = false;
            let logoExt = '';
            if (hasMedia && msg.message && (msg.message.imageMessage || msg.message.documentMessage)) {
                try {
                    const mediaBuffer = await downloadMediaMessage(msg, 'buffer', { }, { reuploadRequest: sock.updateMediaMessage });
                    logoExt = msg.message.imageMessage ? '.jpg' : '.png'; // Fallback
                    const logoDir = path.join(__dirname, '../../data/logos');
                    if (!fs.existsSync(logoDir)) {
                        fs.mkdirSync(logoDir, { recursive: true });
                    }
                    const logoPath = path.join(logoDir, `${linkedUserId}${logoExt}`);
                    fs.writeFileSync(logoPath, mediaBuffer);
                    logoSaved = true;
                } catch (e) {
                    await sock.sendMessage(remoteJid, { text: '❌ Ocurrió un error al procesar la imagen. Intenta enviarla de nuevo o escribe "ninguno".' });
                    return true;
                }
            } else if (text && (text.trim().toLowerCase() === 'ninguno' || text.trim().toLowerCase() === 'saltar')) {
                // No logo
                logoExt = '';
            } else {
                await sock.sendMessage(remoteJid, { text: '❌ Por favor, adjunta una imagen o escribe "ninguno".' });
                return true;
            }
            
            // Save settings to db
            const configDb = readDB('ticket_configs.json') || {};
            configDb[linkedUserId] = {
                whatsapp: session.whatsapp,
                facebook: session.facebook,
                logoExt: logoExt
            };
            writeDB('ticket_configs.json', configDb);
            
            await sock.sendMessage(remoteJid, { text: '🎉 *¡Configuración guardada exitosamente!*\n\nA partir de ahora, cuando generes recibos con `/ticket`, se incluirán tus datos de contacto y tu logo.' });
            sessionManager.clearSession(remoteJid);
            return true;
        }
    }

    if (['/configticket', '!configticket', 'configticket'].includes(cmd)) {
        sessionManager.configTicketSessions[remoteJid] = { step: 'ask_whatsapp' };
        await sock.sendMessage(remoteJid, { text: '🛠️ *Configuración de Ticket Personalizado*\n\nVamos a personalizar tus recibos paso a paso.\n\n1️⃣ Por favor, escribe tu *número de WhatsApp* de contacto (ej. +521234567890).\nSi no quieres mostrar WhatsApp, escribe "ninguno".\n\n(Escribe *cancelar* para salir en cualquier momento)' });
        return true;
    }
    
    return false;
}

module.exports = configticket;
