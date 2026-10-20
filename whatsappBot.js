const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, DisconnectReason, Browsers, proto } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const http = require('http');
const https = require('https');

// Single-Instance File Lock (Process & Host-Aware + Persistent Heartbeat)
// Avoids concurrent instances fighting across different AlwaysData processes/containers
const os = require('os');
const lockFile = path.join(__dirname, 'bot.lock');
const myHost = os.hostname();
const myPid = process.pid;

try {
    if (fs.existsSync(lockFile)) {
        let isAlive = false;
        try {
            const rawLock = fs.readFileSync(lockFile, 'utf8').trim();
            let lockData = { pid: 0, host: myHost, time: 0 };
            if (rawLock.startsWith('{')) {
                lockData = JSON.parse(rawLock);
            } else {
                lockData.pid = parseInt(rawLock, 10);
            }

            // Si está en el mismo host podemos verificar directamente si el PID está vivo
            if (lockData.host === myHost && lockData.pid > 0) {
                try {
                    process.kill(lockData.pid, 0);
                    isAlive = true;
                } catch (e) {
                    isAlive = false; // El PID ya no corre en este sistema operativo
                }
            } else {
                // Si proviene de otro host o contenedor, checar timestamp del heartbeat (activo si < 45 seg)
                const fileStats = fs.statSync(lockFile);
                if (Date.now() - fileStats.mtimeMs < 45000) {
                    isAlive = true;
                }
            }

            if (isAlive) {
                console.error(`⚠️ Otra instancia del bot ya está activa en [${lockData.host || 'local'}] PID: ${lockData.pid}. Abortando inicio redundante.`);
                process.exit(0);
            } else {
                try { fs.unlinkSync(lockFile); } catch (e) {}
            }
        } catch (e) {
            try { fs.unlinkSync(lockFile); } catch (err) {}
        }
    }

    fs.writeFileSync(lockFile, JSON.stringify({ pid: myPid, host: myHost, startedAt: new Date().toISOString() }));
    // Heartbeat cada 10 segundos
    setInterval(() => {
        try { fs.utimesSync(lockFile, new Date(), new Date()); } catch (e) {}
    }, 10000);

    const cleanupLock = () => {
        try {
            if (fs.existsSync(lockFile)) {
                const raw = fs.readFileSync(lockFile, 'utf8').trim();
                if (raw.includes(String(myPid))) fs.unlinkSync(lockFile);
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
    // Solo forzar salida si es error de memoria crítica o descriptor corrupto
    if (err.message && (err.message.includes('out of memory') || err.message.includes('EBADF'))) {
        process.exit(1);
    }
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
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

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'baileys_auth'));
    
    // Cache de claves de cifrado Signal con TTL para evitar lentitud y "Esperando mensaje"
    const keyStore = makeCacheableSignalKeyStore(state.keys);
    
    // Cache de mensajes salientes (LRU) para responder a reintentos de cifrado de WhatsApp
    const msgStore = new Map();
    // Cache de votos de encuestas para evitar ejecución duplicada
    const processedPollVotes = new Map();

    // CacheStore compatible con Baileys para control de reintentos
    const retryCounterMap = new Map();
    const msgRetryCounterCache = {
        get: (key) => retryCounterMap.get(key),
        set: (key, val) => retryCounterMap.set(key, val),
        del: (key) => retryCounterMap.delete(key),
        flushAll: () => retryCounterMap.clear()
    };

    sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: keyStore
        },
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        markOnlineOnConnect: true,
        syncFullHistory: false,
        fireInitQueries: false,
        msgRetryCounterCache,
        connectTimeoutMs: 120000,
        defaultQueryTimeoutMs: 120000,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: false,
        getMessage: async (key) => {
            if (key && key.id && msgStore.has(key.id)) {
                return msgStore.get(key.id);
            }
            return undefined;
        },
        shouldIgnoreJid: (jid) => false
    });

    const originalSendMessage = sock.sendMessage;
    const { ENGINE_CONFIG, randomThrottleDelay, getEngineTimestamp } = require('./src/whatsappEngine');

    // Message Queue System to prevent "Esperando mensaje" due to rate limiting
    let isSending = false;
    const messageQueue = [];
    
    const processQueue = async () => {
        if (isSending || messageQueue.length === 0) return;
        isSending = true;
        
        while (messageQueue.length > 0) {
            const item = messageQueue.shift();
            const { jid, content, options, resolve, reject } = item;
            item.retries = item.retries || 0;

            try {
                // Sincronizar presencia y estado para forzar intercambio de llaves Signal
                try {
                    await sock.sendPresenceUpdate('available');
                    await sock.sendPresenceUpdate('composing', jid);
                } catch (e) {}

                // Throttle unificado controlado por el motor de WhatsApp
                await randomThrottleDelay(); 
                
                if (content && typeof content.text === 'string' && content.text.includes('❌')) {
                    if (!content.text.includes('Soporte: https://wa.me/')) {
                        content.text += `\n\n🎧 Soporte: ${ENGINE_CONFIG.supportUrl}`;
                    }
                }

                // Si es un mensaje de encuesta, asegurar que tenga su messageSecret explícito
                let pollSecret = null;
                if (content && content.poll) {
                    const crypto = require('crypto');
                    pollSecret = content.poll.messageSecret || crypto.randomBytes(32);
                    content.poll.messageSecret = pollSecret;
                }

                const result = await Promise.race([
                    originalSendMessage.call(sock, jid, content, options),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de WhatsApp socket')), 20000))
                ]);

                if (result && result.key && result.key.id && result.message) {
                    if (pollSecret) {
                        result.message.messageContextInfo = result.message.messageContextInfo || {};
                        result.message.messageContextInfo.messageSecret = pollSecret;
                    }
                    msgStore.set(result.key.id, result.message);
                    // Mantener tamaño de caché controlado (máx 1000 mensajes para bajo consumo RAM)
                    if (msgStore.size > 1000) {
                        const firstKey = msgStore.keys().next().value;
                        msgStore.delete(firstKey);
                    }
                }

                try {
                    await sock.sendPresenceUpdate('paused', jid);
                } catch (e) {}

                resolve(result);
            } catch (err) {
                console.error(`Error enviando mensaje a ${jid} (intento ${item.retries + 1}):`, err.message);
                
                // Reintento automático inteligente hasta 3 veces si es fallo de conexión o timeout
                if (item.retries < 2 && (err.message.includes('Timeout') || err.message.includes('socket') || err.message.includes('rate-overlimit'))) {
                    item.retries++;
                    console.log(`Re-encolando mensaje para ${jid} tras pausa de seguridad...`);
                    await new Promise(r => setTimeout(r, 3000));
                    messageQueue.unshift(item);
                } else {
                    reject(err);
                }
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
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const errorTag = lastDisconnect?.error?.node?.content?.[0]?.tag || '';
            const isReplaced = errorTag === 'conflict' || lastDisconnect?.error?.message?.includes('conflict');
            const isLoggedOut = statusCode === DisconnectReason.loggedOut;
            
            console.log(`Conexión cerrada. Status: ${statusCode}, Error: ${lastDisconnect?.error?.message || 'None'}`);
            
            if (isLoggedOut) {
                console.log('⚠️ Sesión cerrada desde el teléfono. Borra la carpeta baileys_auth para escanear de nuevo.');
                isReady = false;
                return;
            }

            reconnectAttempts++;
            // Backoff exponencial con tope de 30 segundos
            const backoffMs = Math.min(30000, 2000 * Math.pow(1.5, reconnectAttempts));

            if (isReplaced) {
                console.log(`⚠️ Conflicto de sesión en el socket (otra conexión activa). Esperando ${Math.round(backoffMs/1000)}s antes de reintentar sin tumbar sesión...`);
                isReady = false;
                setTimeout(connectToWhatsApp, backoffMs);
            } else {
                console.log(`Reconectando socket (intento #${reconnectAttempts}) en ${Math.round(backoffMs/1000)}s...`);
                isReady = false;
                setTimeout(connectToWhatsApp, backoffMs);
            }
        } else if (connection === 'open') {
            console.log('✅ Bot de WhatsApp (Baileys) conectado y listo!');
            isReady = true;
            reconnectAttempts = 0; // Reset counter on successful connection
        }
    });



    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const isPollUpdate = !!msg.message?.pollUpdateMessage;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || msg.message.documentMessage?.caption || '';
        const hasMedia = !!(msg.message.imageMessage || msg.message.videoMessage || msg.message.documentMessage || msg.message.audioMessage || msg.message.stickerMessage);
        
        if (!text && !hasMedia && !isPollUpdate) return;
        
        console.log(`📩 [Mensaje recibido de ${remoteJid}]: "${text}" (hasMedia: ${hasMedia}, isPollUpdate: ${isPollUpdate})`);
        
        try {
        const isGroup = remoteJid.endsWith('@g.us');

        const sessionManager = require('./src/sessionManager');
        const commands = require('./src/commands/index');

        // Soporte para votos de Encuestas Nativas (Poll Votes)
        let resolvedText = text;
        if (isPollUpdate) {
            try {
                const pollUpdate = msg.message.pollUpdateMessage;
                const pollKey = pollUpdate.pollCreationMessageKey;
                const { decryptPollVote, jidNormalizedUser, getKeyAuthor } = require('@whiskeysockets/baileys');
                const crypto = require('crypto');

                const pollCreationMsg = pollKey?.id ? msgStore.get(pollKey.id) : null;
                const meNormalised = jidNormalizedUser(sock.user?.id || sock.authState?.creds?.me?.id);
                const meLid = sock.authState?.creds?.me?.lid ? jidNormalizedUser(sock.authState.creds.me.lid) : (sock.user?.lid ? jidNormalizedUser(sock.user.lid) : null);

                // WhatsApp en chats privados puede cifrar la encuesta usando el LID en vez del número @s.whatsapp.net
                const pollCreatorCandidates = [];
                if (pollKey) {
                    if (pollKey.fromMe) {
                        if (meLid) pollCreatorCandidates.push(meLid);
                        if (meNormalised) pollCreatorCandidates.push(meNormalised);
                    } else {
                        const author = getKeyAuthor(pollKey, meNormalised);
                        if (author) pollCreatorCandidates.push(author);
                    }
                }
                if (pollCreatorCandidates.length === 0 && meNormalised) pollCreatorCandidates.push(meNormalised);

                const voterCandidates = [];
                const voterDirect = getKeyAuthor(msg.key, meNormalised);
                if (voterDirect) voterCandidates.push(voterDirect);
                if (msg.key.participant) voterCandidates.push(jidNormalizedUser(msg.key.participant));
                if (remoteJid) voterCandidates.push(jidNormalizedUser(remoteJid));
                const uniqueVoterCandidates = [...new Set(voterCandidates)];

                let pollEncKey = pollCreationMsg?.message?.messageContextInfo?.messageSecret ||
                                 pollCreationMsg?.messageContextInfo?.messageSecret ||
                                 pollCreationMsg?.pollCreationMessage?.messageContextInfo?.messageSecret;
                if (typeof pollEncKey === 'string') {
                    pollEncKey = Buffer.from(pollEncKey, 'base64');
                }

                let decryptedVote = null;
                if (pollEncKey && pollUpdate.vote) {
                    for (const cCreator of pollCreatorCandidates) {
                        for (const cVoter of uniqueVoterCandidates) {
                            try {
                                decryptedVote = decryptPollVote(
                                    pollUpdate.vote,
                                    {
                                        pollCreatorJid: cCreator,
                                        pollMsgId: pollKey.id,
                                        pollEncKey,
                                        voterJid: cVoter
                                    }
                                );
                                if (decryptedVote && decryptedVote.selectedOptions) {
                                    break;
                                }
                            } catch (e) {
                                // Continuar probando siguiente combinación
                            }
                        }
                        if (decryptedVote && decryptedVote.selectedOptions) break;
                    }
                }

                // Si logramos descifrar las opciones seleccionadas (hashes sha256)
                if (decryptedVote && decryptedVote.selectedOptions?.length > 0) {
                    const selectedHash = Buffer.from(decryptedVote.selectedOptions[0]);
                    const opts = pollCreationMsg?.message?.pollCreationMessage?.options ||
                                 pollCreationMsg?.message?.pollCreationMessageV2?.options ||
                                 pollCreationMsg?.message?.pollCreationMessageV3?.options ||
                                 pollCreationMsg?.pollCreationMessage?.options ||
                                 pollCreationMsg?.pollCreationMessageV2?.options ||
                                 pollCreationMsg?.pollCreationMessageV3?.options || [];
                    
                    for (const opt of opts) {
                        const optHash = crypto.createHash('sha256').update(opt.optionName || '').digest();
                        if (selectedHash.equals(optHash)) {
                            resolvedText = opt.optionName;
                            break;
                        }
                    }
                }

                if (!resolvedText) {
                    console.warn(`[POLL WARNING] No se pudo resolver opción de encuesta ${pollKey?.id}. DecryptedVote:`, decryptedVote ? 'OK' : 'NULL', `pollEncKey:`, pollEncKey ? 'FOUND' : 'MISSING', `pollCreationMsg:`, pollCreationMsg ? 'FOUND' : 'MISSING');
                }

                console.log(`[POLL VOTE RESULT] resolvedText: "${resolvedText}" para ${remoteJid}`);

                // Evitar procesar el mismo voto duplicado (WhatsApp emite 2 eventos upsert para el mismo pollUpdate)
                const voteId = `${msg.key.id}_${voterDirect || remoteJid}_${resolvedText}`;
                if (processedPollVotes.has(voteId)) {
                    console.log(`[POLL DEDUPLICATE] Voto ya procesado previamente: ${voteId}, ignorando evento duplicado.`);
                    return;
                }
                processedPollVotes.set(voteId, Date.now());
                if (processedPollVotes.size > 500) {
                    const oldestKey = processedPollVotes.keys().next().value;
                    processedPollVotes.delete(oldestKey);
                }
            } catch (pollErr) {
                console.error('[POLL VOTE DECODE ERR]', pollErr);
            }
        }

        const lowerText = resolvedText.toLowerCase().trim();
        const textParts = resolvedText.trim().split(/\s+/);
        const firstWord = lowerText.split(/\s+/)[0];
        
        // RELOAD DATABASES FOR FRESH DATA
        wusers = readDB(WHATSAPP_USERS_FILE) || {};
        wsettings = readDB(WHATSAPP_SETTINGS_FILE) || { adminGroupId: null };
        
        // Auto-vincular por número de teléfono si el remitente no está registrado aún
        const rawDigits = remoteJid.split('@')[0].replace(/\D/g, '');
        let isUserLinked = !!(wusers[remoteJid] || Object.keys(wusers).some(k => {
            const kDigits = k.split('@')[0].replace(/\D/g, '');
            return kDigits === rawDigits || kDigits.endsWith(rawDigits) || rawDigits.endsWith(kDigits);
        }));

        if (!isUserLinked && !isGroup && rawDigits.length >= 10) {
            try {
                const users = readDB(USERS_FILE) || [];
                const matchingUsers = users.filter(u => {
                    if (!u.phone) return false;
                    const uClean = String(u.phone).replace(/\D/g, '');
                    return uClean === rawDigits || (uClean.length >= 10 && rawDigits.endsWith(uClean.slice(-10)));
                });

                if (matchingUsers.length === 1) {
                    const matchedUser = matchingUsers[0];
                    wusers[remoteJid] = matchedUser.id;
                    writeDB(WHATSAPP_USERS_FILE, wusers);
                    isUserLinked = true;
                    console.log(`[AUTO-LINK] WhatsApp ${remoteJid} auto-vinculado con usuario ${matchedUser.username} (${matchedUser.id})`);
                }
            } catch (autoLinkErr) {
                console.error('[AUTO-LINK] Error auto-linking:', autoLinkErr);
            }
        }

        const context = {
            sock,
            remoteJid,
            text: resolvedText,
            lowerText: resolvedText.toLowerCase().trim(),
            textParts: resolvedText.trim().split(/\s+/),
            firstWord: resolvedText.toLowerCase().trim().split(/\s+/)[0],
            args: resolvedText.trim().split(/\s+/),
            msg,
            isGroup,
            wusers,
            wsettings,
            sessionManager,
            hasMedia
        };

        // Reacción inmediata con emoji para dar feedback de procesamiento
        if (context.firstWord && (context.firstWord.startsWith('/') || ['saldo', 'pedir', 'buscar', 'recargar', 'ticket', 'soporte', 'comandos', 'ayuda'].includes(context.firstWord))) {
            try {
                await sock.sendMessage(remoteJid, {
                    react: { text: '⚡', key: msg.key }
                });
            } catch (e) {}
        }

        const handled = await commands.handleCommand(context);

        // Si se manejó exitosamente un comando principal, confirmar con reacción positiva
        if (handled && msg.key) {
            try {
                await sock.sendMessage(remoteJid, {
                    react: { text: '✅', key: msg.key }
                });
            } catch (e) {}
        }

        if (!handled && !isGroup && firstWord.length < 30) {
            if (!isUserLinked) {
                await sock.sendMessage(remoteJid, { 
                    text: '👋 ¡Hola! Soy el asistente inteligente de *MegaUnlockPhone*.\n\nPara conectarte a tu cuenta y recibir avisos de tus pedidos, escribe *vincular* (o *hola*) para activarla en segundos sin contraseñas.' 
                });
            } else {
                await sock.sendMessage(remoteJid, { 
                    text: '🤖 No reconocí esa opción.\n\nPuedes escribir *comandos* (o */comandos*) para ver lo que puedo hacer, o escribe *soporte* si necesitas ayuda con un asesor.' 
                });
            }
        }

        } catch (err) {
            console.error('WhatsApp Bot Error:', err);
            // Reacción de error visual en el mensaje del usuario
            try {
                if (msg && msg.key) {
                    await sock.sendMessage(remoteJid, { react: { text: '⚠️', key: msg.key } });
                }
            } catch (e) {}
            require('fs').appendFileSync('bot_error.log', new Date().toISOString() + '\n' + err.stack + '\n\n');
            try {
                const errMsg = err.message || '';
                if (errMsg.toLowerCase().includes('network error') || errMsg.includes('502') || errMsg.includes('503') || errMsg.includes('econnrefused') || errMsg.includes('500') || errMsg.toLowerCase().includes('timeout')) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ *¡Atención!* El servidor principal está en mantenimiento o bajo revisión. 🛠️\n\nPor favor, *CÁMBIATE A OMEGA SERVER* (Servidor 2 o Servidor 3) para continuar enviando tus pedidos sin interrupciones.' });
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
            
            const { randomThrottleDelay } = require('./src/whatsappEngine');
            if (item.type === 'group') {
                if (wsettings.adminGroupId) {
                    await sock.sendMessage(wsettings.adminGroupId, { text: item.message });
                    await randomThrottleDelay();
                }
            } else if (item.type === 'private') {
                let wsettingsLocal = readDB(WHATSAPP_SETTINGS_FILE) || {};
                const mutedUsers = wsettingsLocal.mutedUsers || {};
                
                // Si el usuario silenció o desactivó las notificaciones, no enviar
                if (item.userId && mutedUsers[item.userId]) {
                    console.log(`[QUEUE] Notificaciones silenciadas para usuario ${item.userId}. Omitiendo envío privado.`);
                } else {
                    let wusersLocal = readDB(WHATSAPP_USERS_FILE) || {};
                    let phoneIds = Object.keys(wusersLocal).filter(key => wusersLocal[key] === item.userId);

                    // Si no está vinculado en WhatsAppLinks, buscar el teléfono de su cuenta para auto-enviarle
                    if (phoneIds.length === 0 && item.userId) {
                        try {
                            const users = readDB(USERS_FILE) || [];
                            const targetUser = users.find(u => u.id === item.userId);
                            if (targetUser && targetUser.phone) {
                                let cleanDigits = String(targetUser.phone).replace(/\D/g, '');
                                if (cleanDigits.length === 10) cleanDigits = '52' + cleanDigits;
                                if (cleanDigits.length >= 10) {
                                    phoneIds = [`${cleanDigits}@s.whatsapp.net`];
                                }
                            }
                        } catch (lookupErr) {
                            console.error('[QUEUE] Error buscando teléfono del usuario:', lookupErr);
                        }
                    }

                    // Deduplicar JIDs para que el cliente reciba un solo mensaje en su chat real
                    const resolvedJids = new Set();
                    for (const rawPhone of phoneIds) {
                        try {
                            const [check] = await sock.onWhatsApp(rawPhone) || [];
                            if (check && check.exists && check.jid) {
                                resolvedJids.add(check.jid);
                            } else if (rawPhone.startsWith('52') && !rawPhone.startsWith('521')) {
                                const fallbackJid = rawPhone.replace(/^52/, '521');
                                const [checkFallback] = await sock.onWhatsApp(fallbackJid) || [];
                                if (checkFallback && checkFallback.exists && checkFallback.jid) {
                                    resolvedJids.add(checkFallback.jid);
                                } else {
                                    resolvedJids.add(rawPhone);
                                }
                            } else {
                                resolvedJids.add(rawPhone);
                            }
                        } catch (_) {
                            resolvedJids.add(rawPhone);
                        }
                    }

                    for (const targetJid of resolvedJids) {
                        try {
                            await sock.sendMessage(targetJid, { text: item.message });
                            await randomThrottleDelay();
                        } catch (e) {
                            console.error(`[QUEUE] Error sending private message to ${targetJid}:`, e);
                        }
                    }
                }
            } else if (item.type === 'direct') {
                console.log(`[QUEUE] Processing direct message to: ${item.phoneId}`);
                if (item.phoneId) {
                    let targetJid = item.phoneId;
                    
                    try {
                        let sent = false;
                        const [result] = await sock.onWhatsApp(targetJid) || [];
                        console.log(`[QUEUE] onWhatsApp(${targetJid}) result:`, result);
                        
                        if (result && result.exists && result.jid) {
                            await sock.sendMessage(result.jid, { text: item.message });
                            console.log(`[QUEUE] Message sent to validated JID ${result.jid}`);
                            sent = true;
                        }
                        
                        if (!sent && targetJid.startsWith('52') && targetJid.length === 27) { 
                            const fallbackJid = targetJid.replace(/^52/, '521');
                            const [fallbackResult] = await sock.onWhatsApp(fallbackJid) || [];
                            if (fallbackResult && fallbackResult.exists && fallbackResult.jid) {
                                await sock.sendMessage(fallbackResult.jid, { text: item.message });
                                console.log(`[QUEUE] Message sent to fallback JID ${fallbackResult.jid}`);
                                sent = true;
                            }
                        }
                        
                        if (!sent) {
                            // If onWhatsApp check returned undefined or false, try direct target
                            await sock.sendMessage(targetJid, { text: item.message });
                            console.log(`[QUEUE] Direct message sent to ${targetJid}`);
                        }
                        await randomThrottleDelay();
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
