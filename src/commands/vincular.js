const path = require('path');
const { readDB, writeDB } = require('../../src/db');

const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const WHATSAPP_USERS_FILE = path.join(DATA_DIR, 'whatsapp_users.json');

async function vincular(context) {
    const { sock, remoteJid, firstWord, text, sessionManager, wusers, isGroup } = context;

    const lowerWord = firstWord.toLowerCase();
    const isLinked = !!(wusers[remoteJid] || (remoteJid && Object.keys(wusers).some(k => k.split('@')[0].replace(/\D/g, '') === remoteJid.split('@')[0].replace(/\D/g, ''))));

    const vincularTriggers = ['/vincular', '!vincular', 'vincular'];
    const greetingTriggers = ['hola', 'buenas', 'buenos', 'saludos', 'inicio', 'start', '/start', 'vincularme', 'conectar'];

    // Si escribe vincular directamente, O si NO está vinculado y manda un saludo/inicio en privado:
    if (vincularTriggers.includes(lowerWord) || (!isLinked && !isGroup && greetingTriggers.includes(lowerWord))) {
        sessionManager.loginSessions = sessionManager.loginSessions || {};
        sessionManager.loginSessions[remoteJid] = { step: 1 };
        await sock.sendMessage(remoteJid, { text: '👋 ¡Hola! Para comenzar y activar tu cuenta en WhatsApp:\n\n🔗 *Vincular Cuenta de MegaUnlockPhone*\nPor favor, responde con tu *nombre de usuario* (username) de la plataforma:' });
        return true;
    }

    sessionManager.loginSessions = sessionManager.loginSessions || {};
    if (sessionManager.loginSessions[remoteJid]) {
        const session = sessionManager.loginSessions[remoteJid];
        
        if (text.toLowerCase() === 'cancelar') {
            delete sessionManager.loginSessions[remoteJid];
            await sock.sendMessage(remoteJid, { text: '🚫 Vinculación cancelada.' });
            return true;
        }

        if (session.step === 1) {
            session.username = text.trim();
            session.step = 2;
            await sock.sendMessage(remoteJid, { text: '🔑 Ahora ingresa tu *contraseña*:' });
            return true;
        } else if (session.step === 2) {
            const password = text.trim();
            const username = session.username;
            
            const users = readDB(USERS_FILE) || [];
            const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

            if (!user) {
                await sock.sendMessage(remoteJid, { text: '❌ Usuario no encontrado. Por favor revisa y vuelve a iniciar con /vincular' });
                delete sessionManager.loginSessions[remoteJid];
                return true;
            }

            if (user.password !== password) {
                await sock.sendMessage(remoteJid, { text: '❌ Contraseña incorrecta. Por favor vuelve a iniciar con /vincular' });
                delete sessionManager.loginSessions[remoteJid];
                return true;
            }

            // Unlink any old numbers associated with this user
            Object.keys(wusers).forEach(jid => {
                if (wusers[jid] === user.id) {
                    delete wusers[jid];
                }
            });

            // Success, link new account
            wusers[remoteJid] = user.id;
            writeDB(WHATSAPP_USERS_FILE, wusers);
            
            delete sessionManager.loginSessions[remoteJid];
            await sock.sendMessage(remoteJid, { text: `✅ ¡Cuenta vinculada exitosamente!\n\nBienvenido, *${user.username}*.\nAhora puedes usar comandos como /saldo, /recargar, /pedir, etc.` });
            return true;
        }
    }
    
    return false;
}

module.exports = vincular;
