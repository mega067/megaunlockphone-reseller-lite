const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const http = require('http');
const https = require('https');

// Single-Instance File Lock (Process-aware + Heartbeat)
const lockFile = path.join(__dirname, 'bot.lock');
try {
    if (fs.existsSync(lockFile)) {
        let isAlive = false;
        try {
            const oldPid = parseInt(fs.readFileSync(lockFile, 'utf8').trim(), 10);
            if (!isNaN(oldPid) && oldPid > 0) {
                // Check if process is actually running
                process.kill(oldPid, 0);
                isAlive = true;
            }
        } catch (e) {
            // process.kill throws if PID doesn't exist (ESRCH), meaning old process is dead
            isAlive = false;
        }

        const stats = fs.statSync(lockFile);
        if (isAlive && (Date.now() - stats.mtimeMs < 60000)) {
            console.error('⚠️ Otra instancia del bot ya está corriendo (PID activo). Saliendo para evitar corrupción de BD.');
            process.exit(0);
        } else {
            // Stale lock file from killed/crashed process
            try { fs.unlinkSync(lockFile); } catch (e) {}
        }
    }
    fs.writeFileSync(lockFile, process.pid.toString());
    setInterval(() => {
        try { fs.utimesSync(lockFile, new Date(), new Date()); } catch (e) {}
    }, 15000);

    const cleanupLock = () => {
        try {
            if (fs.existsSync(lockFile)) {
                const curPid = parseInt(fs.readFileSync(lockFile, 'utf8').trim(), 10);
                if (curPid === process.pid) fs.unlinkSync(lockFile);
            }
        } catch (e) {}
    };
    process.on('exit', cleanupLock);
    process.on('SIGINT', () => { cleanupLock(); process.exit(0); });
    process.on('SIGTERM', () => { cleanupLock(); process.exit(0); });
} catch (e) {
    console.error('Lock system error', e);
}

axios.defaults.httpAgent = new http.Agent({ family: 4 });
axios.defaults.httpsAgent = new https.Agent({ family: 4 });

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err.message);
    if (err.message === 'Timed Out' || err.message.includes('socket') || err.message.includes('connection')) {
        process.exit(1);
    }
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    if (reason && reason.message === 'Timed Out') {
        process.exit(1);
    }
});

const DATA_DIR = path.join(__dirname, 'data');
const WHATSAPP_USERS_FILE = path.join(DATA_DIR, 'whatsapp_users.json');
const WHATSAPP_SETTINGS_FILE = path.join(DATA_DIR, 'whatsapp_settings.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const { readDB, writeDB } = require('./src/db');

let wusers = readDB(WHATSAPP_USERS_FILE) || {};
let wsettings = readDB(WHATSAPP_SETTINGS_FILE) || { adminGroupId: null };
let loginSessions = {};
let orderSessions = {};
let addMoneySessions = {};
let ticketSessions = {};
let autoFundSessions = {};
let msgGrupSessions = {};
let busSessions = {};
let msgUserSessions = {};
let setPriceSessions = {};
let sock = null;
let isReady = false;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'baileys_auth'));
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ["Mega Unlock Panel", "Chrome", "10.0.0"],
        markOnlineOnConnect: true,
        connectTimeoutMs: 300000,
        defaultQueryTimeoutMs: 300000,
        keepAliveIntervalMs: 10000
    });

    const originalSendMessage = sock.sendMessage;
    
    // Message Queue System to prevent "Esperando mensaje" due to rate limiting
    let isSending = false;
    const messageQueue = [];
    
    const processQueue = async () => {
        if (isSending || messageQueue.length === 0) return;
        isSending = true;
        
        while (messageQueue.length > 0) {
            const { jid, content, options, resolve, reject } = messageQueue.shift();
            try {
                // Presence update helps sync encryption keys and prevents the "waiting for message" bug
                try {
                    await sock.sendPresenceUpdate('composing', jid);
                } catch (e) {}

                // Throttle: wait 1.5 - 2.5 seconds between messages
                await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000)); 
                
                if (content && typeof content.text === 'string' && content.text.includes('❌')) {
                    if (!content.text.includes('Soporte: https://wa.me/')) {
                        content.text += '\n\n🎧 Soporte: https://wa.me/522216936720';
                    }
                }
                const result = await Promise.race([
                    originalSendMessage.call(sock, jid, content, options),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de WhatsApp')), 15000))
                ]);
                resolve(result);
            } catch (err) {
                console.error('Error enviando mensaje encolado:', err);
                reject(err);
            }
        }
        isSending = false;
    };

    sock.sendMessage = function(jid, content, options) {
        return new Promise((resolve, reject) => {
            messageQueue.push({ jid, content, options, resolve, reject });
            processQueue();
        });
    };

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('\n----------------------------------------------------');
            console.log('📱 ¡ESCANEA ESTE CÓDIGO QR CON EL WHATSAPP DEL BOT!');
            console.log('----------------------------------------------------\n');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada. Reconectando:', shouldReconnect);
            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 2000);
            } else {
                console.log('Sesión cerrada manualmente. Borra la carpeta baileys_auth para escanear de nuevo.');
                isReady = false;
            }
        } else if (connection === 'open') {
            console.log('✅ Bot de WhatsApp (Baileys) conectado y listo!');
            isReady = true;
        }
    });



    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || msg.message.documentMessage?.caption || '';
        const hasMedia = !!(msg.message.imageMessage || msg.message.videoMessage || msg.message.documentMessage || msg.message.audioMessage || msg.message.stickerMessage);
        
        if (!text && !hasMedia) return;
        
        try {
        const isGroup = remoteJid.endsWith('@g.us');

        const lowerText = text.toLowerCase().trim();
        const textParts = text.trim().split(/\s+/);
        const firstWord = lowerText.split(/\s+/)[0];
        
        // RELOAD DATABASES FOR FRESH DATA
        wusers = readDB(WHATSAPP_USERS_FILE) || {};
        wsettings = readDB(WHATSAPP_SETTINGS_FILE) || { adminGroupId: null };
        
        const sessionManager = require('./src/sessionManager');
        const commands = require('./src/commands/index');

        const context = {
            sock,
            remoteJid,
            text,
            lowerText,
            textParts,
            firstWord,
            args: textParts,
            msg,
            isGroup,
            wusers,
            wsettings,
            sessionManager,
            hasMedia
        };

        const handled = await commands.handleCommand(context);

        if (!handled && !isGroup && firstWord.length < 30) {
            if (!wusers[remoteJid]) {
                await sock.sendMessage(remoteJid, { text: '🤖 ¡Hola! Soy el bot automático de Mega Unlock Phone.\nPara interactuar por este medio, necesitas vincular tu cuenta.\n\nPor favor, responde escribiendo la palabra */vincular* para empezar paso a paso.' });
            } else {
                await sock.sendMessage(remoteJid, { text: '🤖 ¡Hola! Soy un bot automatizado y no entendí tu mensaje.\n\nPor favor, escribe */comandos* para ver la lista de acciones disponibles o contacta a un humano para soporte.' });
            }
        }

        } catch (err) {
            console.error('WhatsApp Bot Error:', err);
            require('fs').appendFileSync('bot_error.log', new Date().toISOString() + '\\n' + err.stack + '\\n\\n');
            try {
                const errMsg = err.message || '';
                if (errMsg.toLowerCase().includes('network error') || errMsg.includes('502') || errMsg.includes('503') || errMsg.includes('econnrefused') || errMsg.includes('500') || errMsg.toLowerCase().includes('timeout')) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ *¡Atención!* El servidor principal está en mantenimiento o bajo revisión. 🛠️\\n\\nPor favor, *CÁMBIATE A OMEGA SERVER* (Servidor 2 o Servidor 3) para continuar enviando tus pedidos sin interrupciones.' });
                } else {
                    await sock.sendMessage(remoteJid, { text: '❌ Ocurrió un error inesperado al procesar tu mensaje. El equipo de soporte ha sido notificado.' });
                }
            } catch (e) {
                console.error('Error enviando mensaje de fallo:', e);
            }
        }
    });
}
connectToWhatsApp().catch(err => console.error("Error iniciando Baileys:", err));

const QUEUE_FILE = path.join(__dirname, 'queue.json');

let isProcessingQueue = false;
setInterval(async () => {
    if (!isReady || !sock || isProcessingQueue) return;
    if (!fs.existsSync(QUEUE_FILE)) return;
    
    try {
        isProcessingQueue = true;
        let queue = JSON.parse(fs.readFileSync(QUEUE_FILE));
        if (queue.length > 0) {
            console.log(`[QUEUE] Found item:`, queue[0]);
            const item = queue.shift();
            fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
            
            if (item.type === 'group') {
                if (wsettings.adminGroupId) {
                    await sock.sendMessage(wsettings.adminGroupId, { text: item.message });
                    await new Promise(r => setTimeout(r, 1500));
                }
            } else if (item.type === 'private') {
                let wusersLocal = readDB(WHATSAPP_USERS_FILE) || {};
                const phoneIds = Object.keys(wusersLocal).filter(key => wusersLocal[key] === item.userId);
                for (const phoneId of phoneIds) {
                    try {
                        await sock.sendMessage(phoneId, { text: item.message });
                        await new Promise(r => setTimeout(r, 1500));
                    } catch (e) {
                        console.error(`[QUEUE] Error sending private message to ${phoneId}:`, e);
                    }
                }
            } else if (item.type === 'direct') {
                console.log(`[QUEUE] Processing direct message to: ${item.phoneId}`);
                if (item.phoneId) {
                    let targetJid = item.phoneId;
                    
                    try {
                        const [result] = await sock.onWhatsApp(targetJid) || [];
                        console.log(`[QUEUE] onWhatsApp(${targetJid}) result:`, result);
                        
                        let sent = false;
                        if (result && result.exists) {
                            await sock.sendMessage(targetJid, { text: item.message });
                            console.log(`[QUEUE] Message sent to primary ${targetJid}`);
                            sent = true;
                        }
                        
                        if (!sent && targetJid.startsWith('52') && targetJid.length === 27) { 
                            const fallbackJid = targetJid.replace(/^52/, '521');
                            const [fallbackResult] = await sock.onWhatsApp(fallbackJid) || [];
                            if (fallbackResult && fallbackResult.exists) {
                                await sock.sendMessage(fallbackJid, { text: item.message });
                                console.log(`[QUEUE] Message sent to fallback ${fallbackJid}`);
                            }
                        } else if (!sent) {
                            // If neither exists or we couldn't verify, just try sending to the original
                            await sock.sendMessage(targetJid, { text: item.message });
                        }
                        await new Promise(r => setTimeout(r, 1500));
                    } catch (err) {
                        console.log(`[QUEUE] Send failed:`, err);
                    }
                }
            }
        }
    } catch (e) {
        console.error("Error procesando cola:", e);
    } finally {
        isProcessingQueue = false;
    }
}, 3000);

// Ping the main server every 3 minutes to trigger the background order sync
// This ensures that even if the web panel is inactive, the bot keeps the sync alive.
setInterval(async () => {
    try {
        const axios = require('axios');
        // Usamos IPv4 agent por precaución
        await axios.get('https://megaunlockphone-panel.alwaysdata.net/api/cron/sync', { 
            timeout: 10000,
            httpAgent: new http.Agent({ family: 4 })
        });
        console.log('✅ Auto-Sync trigger sent to Web Panel');
    } catch (e) {
        console.log('⚠️ Failed to trigger Auto-Sync:', e.message);
    }
}, 3 * 60 * 1000);
