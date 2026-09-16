const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const http = require('http');
const https = require('https');
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
        syncFullHistory: false,
        markOnlineOnConnect: false,
        connectTimeoutMs: 300000,
        defaultQueryTimeoutMs: 300000,
        keepAliveIntervalMs: 10000
    });

    const originalSendMessage = sock.sendMessage;
    sock.sendMessage = async function(jid, content, options) {
        if (content && typeof content.text === 'string' && content.text.includes('❌')) {
            if (!content.text.includes('Soporte: https://wa.me/')) {
                content.text += '\n\n🎧 Soporte: https://wa.me/522216936720';
            }
        }
        return await originalSendMessage.apply(this, arguments);
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

    async function executeSearch(sId, query, msg, remoteJid, isGroup) {
        const senderJid = isGroup ? (msg.key.participant || remoteJid) : remoteJid;
        const linkedUser = wusers[senderJid] || 1;
        try {
            const axios = require('axios');
            const res = await axios.post('https://megaunlockphone-panel.alwaysdata.net/api/bot/search', {
                botSecret: 'MEGA_BOT_SECRET_2026',
                userId: linkedUser,
                serverId: sId,
                query: query
            });
            const results = res.data.results;
            if (!results || results.length === 0) {
                await sock.sendMessage(remoteJid, { text: `🔎 No se encontraron servicios para "${query}" en el Servidor ${sId}.` });
            } else {
                let msgTxt = `⚠️ _Tip: Escribe palabras clave claras (ej. "iPhone Claro") para que la búsqueda sea más rápida y precisa._\n\n🔎 *Resultados en Servidor ${sId} para "${query}":*\n\n`;
                results.forEach((r, i) => {
                    const emoji = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'][i];
                    const prefix = emoji ? emoji : `*${i + 1}.*`;
                    const parsedPrice = parseFloat(r.price); const validPrice = !isNaN(parsedPrice) ? parsedPrice : 0;
                    msgTxt += `${prefix} ID: ${r.id} | ${r.name} | 💰 $${validPrice.toFixed(2)} MXN\n\n`;
                });
                msgTxt += `Para pedir escribe: /pedir${sId}`;
                await sock.sendMessage(remoteJid, { text: msgTxt });
            }
        } catch (e) {
            await sock.sendMessage(remoteJid, { text: '❌ Error al buscar servicios. Intenta más tarde.' });
        }
    }

    async function processAddMoneyShortcut(remoteJid, isRemove, resellerIndexOrId, serverId, amount, users) {
        const resellers = users.filter(u => u.role !== 'admin');
        let targetReseller = null;
        
        // Tratar de buscar por index (1-based) primero, y si no, por ID real
        const index = parseInt(resellerIndexOrId);
        if (!isNaN(index) && index >= 1 && index <= resellers.length) {
            targetReseller = resellers[index - 1];
        } else {
            targetReseller = resellers.find(r => r.id == resellerIndexOrId);
        }
        
        if (!targetReseller) {
            await sock.sendMessage(remoteJid, { text: '❌ Revendedor no encontrado. Por favor verifica el ID o número de la lista.' });
            return;
        }
        if (!['1', '2', '3'].includes(serverId.toString())) {
            await sock.sendMessage(remoteJid, { text: '❌ Servidor inválido. Debe ser 1, 2 o 3.' });
            return;
        }
        
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            await sock.sendMessage(remoteJid, { text: '❌ Monto inválido. Debe ser mayor a 0.' });
            return;
        }
        
        addMoneySessions[remoteJid] = {
            step: 4,
            resellers: resellers,
            type: isRemove ? 'remove' : 'add',
            resellerId: targetReseller.id,
            resellerName: targetReseller.username,
            serverId: serverId.toString(),
            amount: parsedAmount
        };
        
        if (isRemove) {
            await sock.sendMessage(remoteJid, { text: `⚠️ *CONFIRMACIÓN DE DESCUENTO* ⚠️\n\n👤 Revendedor: ${targetReseller.username}\n🏢 Servidor: ${serverId}\n📉 Monto a descontar: $${parsedAmount.toFixed(2)} MXN\n\n¿Confirmas esta reducción de saldo? Responde *SI* para proceder.` });
        } else {
            await sock.sendMessage(remoteJid, { text: `⚠️ *CONFIRMACIÓN DE RECARGA* ⚠️\n\n👤 Revendedor: ${targetReseller.username}\n🏢 Servidor: ${serverId}\n💲 Monto a agregar: $${parsedAmount.toFixed(2)} MXN\n\n¿Confirmas esta recarga? Responde *SI* para proceder.` });
        }
    }

    async function processMsgUserShortcut(remoteJid, targetId, messageText, users, hasMedia, msg) {
        if (!targetId || (!messageText && !hasMedia)) {
            await sock.sendMessage(remoteJid, { text: '❌ Faltan argumentos. Uso: /msgUser <ALL|ID> <mensaje>' });
            return;
        }

        let targetUsers = [];
        if (targetId.toUpperCase() === 'ALL') {
            targetUsers = users.filter(u => u.role !== 'admin');
        } else {
            const user = users.find(u => u.id == targetId);
            if (user) {
                targetUsers.push(user);
            }
        }

        if (targetUsers.length === 0) {
            await sock.sendMessage(remoteJid, { text: '❌ No se encontró ningún usuario con ese ID.' });
            return;
        }

        msgUserSessions[remoteJid] = {
            step: 'CONFIRM',
            targetUsers: targetUsers,
            targetName: targetId.toUpperCase() === 'ALL' ? 'TODOS LOS USUARIOS' : targetUsers[0].username,
            messageText: messageText,
            forwardMsg: hasMedia ? msg : null
        };

        if (hasMedia) {
            await sock.sendMessage(remoteJid, { text: `⚠️ *CONFIRMACIÓN DE ENVÍO* ⚠️\n\n👤 Destinatario(s): ${msgUserSessions[remoteJid].targetName}\n💬 Mensaje: [Archivo Multimedia]\n\n¿Estás seguro de enviar este archivo multimedia? Responde *SI* para confirmar o *NO* para cancelar.` });
        } else {
            await sock.sendMessage(remoteJid, { text: `⚠️ *CONFIRMACIÓN DE ENVÍO* ⚠️\n\n👤 Destinatario(s): ${msgUserSessions[remoteJid].targetName}\n💬 Mensaje:\n${messageText}\n\n¿Estás seguro de enviar este mensaje? Responde *SI* para confirmar o *NO* para cancelar.` });
        }
    }

    async function processPedirStep1(session, serviceId, remoteJid, linkedUserId, textValue) {
        try {
            const axios = require('axios');
            const res = await axios.post('https://megaunlockphone-panel.alwaysdata.net/api/bot/service_info', {
                botSecret: 'MEGA_BOT_SECRET_2026',
                userId: linkedUserId,
                serverId: session.serverId,
                serviceid: serviceId
            });
            const sInfo = res.data;
            session.serviceId = sInfo.id;
            session.serviceName = sInfo.name;
            session.price = sInfo.price;
            session.type = sInfo.type;
            session.customField = sInfo.customField;
            
            session.qntRequired = sInfo.QNT === "1";
            session.minQnt = parseInt(sInfo.MINQNT) || 1;
            session.maxQnt = parseInt(sInfo.MAXQNT) || 9999;
            session.custom = sInfo.CUSTOM || {};
            session.imeiName = sInfo.IMEINAME;
            
            if (session.qntRequired) {
                if (textValue) {
                    let qty = parseInt(textValue.trim());
                    if (isNaN(qty) || qty < session.minQnt || qty > session.maxQnt) {
                        session.step = 'QUANTITY';
                        await sock.sendMessage(remoteJid, { text: `✅ Servicio seleccionado:\n*${sInfo.name}*\n💰 Precio base: $${sInfo.price.toFixed(2)} MXN\n\n❌ Cantidad inválida (recibido: ${textValue}). Debe ser un número entre ${session.minQnt} y ${session.maxQnt}.\nPor favor ingresa la cantidad:` });
                        return;
                    }
                    session.qnt = qty;
                    session.step = 'INPUT';
                    const fallbackType = session.type === 'DATA' ? 'INFO' : session.type;
                    const fieldName = session.customField || session.imeiName || session.custom.customname || fallbackType;
                    await sock.sendMessage(remoteJid, { text: `✅ Cantidad registrada: ${qty} (Total: $${(session.price * qty).toFixed(2)} MXN)\n\nPor favor, ingresa el *${fieldName}* requerido para este servicio:` });
                } else {
                    session.step = 'QUANTITY';
                    await sock.sendMessage(remoteJid, { text: `✅ Servicio seleccionado:\n*${sInfo.name}*\n💰 Precio base: $${sInfo.price.toFixed(2)} MXN\n\nEste servicio requiere **CANTIDAD**.\nPor favor ingresa la cantidad (Mínimo: ${session.minQnt}, Máximo: ${session.maxQnt}):` });
                }
            } else {
                session.qnt = 1;
                const fallbackType = session.type === 'DATA' ? 'INFO' : session.type;
                const fieldName = session.customField || session.imeiName || session.custom.customname || fallbackType;
                
                if (textValue) {
                    const inputVal = textValue.trim();
                    if (session.custom) {
                        if (session.custom.customlen && inputVal.length < parseInt(session.custom.customlen)) {
                            session.step = 'INPUT';
                            await sock.sendMessage(remoteJid, { text: `✅ Servicio seleccionado:\n*${sInfo.name}*\n💰 Precio: $${sInfo.price.toFixed(2)} MXN\n\n❌ Error: El texto debe tener al menos ${session.custom.customlen} caracteres.\nPor favor, ingresa el *${fieldName}* nuevamente:` });
                            return;
                        }
                        if (session.custom.maxlength && inputVal.length > parseInt(session.custom.maxlength)) {
                            session.step = 'INPUT';
                            await sock.sendMessage(remoteJid, { text: `✅ Servicio seleccionado:\n*${sInfo.name}*\n💰 Precio: $${sInfo.price.toFixed(2)} MXN\n\n❌ Error: El texto no puede superar ${session.custom.maxlength} caracteres.\nPor favor, ingresa el *${fieldName}* nuevamente:` });
                            return;
                        }
                        if (session.custom.regex) {
                            try {
                                const rx = new RegExp(session.custom.regex);
                                if (!rx.test(inputVal)) {
                                    session.step = 'INPUT';
                                    await sock.sendMessage(remoteJid, { text: `✅ Servicio seleccionado:\n*${sInfo.name}*\n💰 Precio: $${sInfo.price.toFixed(2)} MXN\n\n❌ Error: El formato es inválido (debe cumplir: ${session.custom.regex}).\nPor favor, ingresa el *${fieldName}* nuevamente:` });
                                    return;
                                }
                            } catch (e) {}
                        }
                    }
                    session.imei = inputVal;
                    session.step = 'CONFIRM';
                    const totalCost = session.price * session.qnt;
                    let confMsg = `⚠️ *CONFIRMACIÓN DE PEDIDO* ⚠️\n\n🔧 Servicio: ${session.serviceName}\n📱 ${fieldName}: ${session.imei}\n💲 Costo Total a descontar: $${totalCost.toFixed(2)} MXN\n\n¿Estás seguro de continuar? Responde *SI* para confirmar o *NO* para cancelar.`;
                    await sock.sendMessage(remoteJid, { text: confMsg });
                } else {
                    session.step = 'INPUT';
                    await sock.sendMessage(remoteJid, { text: `✅ Servicio seleccionado:\n*${sInfo.name}*\n💰 Precio: $${sInfo.price.toFixed(2)} MXN\n\nPor favor, ingresa el *${fieldName}* requerido para este servicio:` });
                }
            }
        } catch (e) {
            if (e.response && e.response.status === 404) {
                await sock.sendMessage(remoteJid, { text: '❌ El servicio no existe o no está disponible.' });
            } else {
                await sock.sendMessage(remoteJid, { text: '❌ Error al verificar el servicio.' });
            }
        }
    }

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

        if (!handled && firstWord.startsWith('/') && firstWord.length < 30) {
            await sock.sendMessage(remoteJid, { text: '🤖 ¡Hola! No reconocí ese comando.\n\nPor favor, escribe */ayuda* o */comandos* para ver todo lo que puedo hacer por ti.' });
        }

        } catch (err) {
            console.error('WhatsApp Bot Error:', err);
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

setInterval(async () => {
    if (!isReady || !sock) return;
    if (!fs.existsSync(QUEUE_FILE)) return;
    
    try {
        let queue = JSON.parse(fs.readFileSync(QUEUE_FILE));
        if (queue.length > 0) {
            const item = queue.shift();
            fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
            
            if (item.type === 'group') {
                if (wsettings.adminGroupId) {
                    await sock.sendMessage(wsettings.adminGroupId, { text: item.message });
                }
            } else if (item.type === 'private') {
                let wusersLocal = readDB(WHATSAPP_USERS_FILE) || {};
                const phoneId = Object.keys(wusersLocal).find(key => wusersLocal[key] === item.userId);
                if (phoneId) {
                    await sock.sendMessage(phoneId, { text: item.message });
                }
            }
        }
    } catch (e) {
        console.error("Error procesando cola:", e);
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
