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
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        
        if (!text) return;
        
        try {
        const isGroup = remoteJid.endsWith('@g.us');

        if (text.toLowerCase().trim() === 'cancelar' && orderSessions[remoteJid]) {
            delete orderSessions[remoteJid];
            await sock.sendMessage(remoteJid, { text: '🚫 Orden cancelada.' });
            return;
        }

        const cmdLower = text.toLowerCase().trim();
        const firstWord = cmdLower.split(' ')[0];

        if (cmdLower.startsWith('/bus1') || cmdLower.startsWith('/bus2') || cmdLower.startsWith('/bus3')) {
            const match = cmdLower.match(/^\/bus([123])/);
            if (!match) return;
            const sId = match[1];
            // Get everything after "/busX"
            const query = text.trim().substring(5).trim();
            if (!query) {
                await sock.sendMessage(remoteJid, { text: `⚠️ Por favor, ingresa un término de búsqueda.\nEjemplo: /bus${sId} iphone` });
                return;
            }
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
                        msgTxt += `${prefix} ID: ${r.id} | ${r.name} | 💰 $${r.price.toFixed(2)} MXN\n\n`;
                    });
                    msgTxt += `Para pedir escribe: /pedir${sId}`;
                    await sock.sendMessage(remoteJid, { text: msgTxt });
                }
            } catch (e) {
                await sock.sendMessage(remoteJid, { text: '❌ Error al buscar servicios. Intenta más tarde.' });
            }
            return;
        }

        // Marcar como leído para evitar el error de "esperando mensaje"
        try {
            await sock.readMessages([msg.key]);
        } catch(e) {}

        if (isGroup) {
            const cmd = text.trim().toLowerCase();
            if (cmd === '!setgroup' || cmd === '/setgroup') {
                const senderJid = msg.key.participant || remoteJid;
                const linkedUserId = wusers[senderJid];
                if (linkedUserId) {
                    const users = readDB(USERS_FILE) || [];
                    const user = users.find(u => u.id === linkedUserId);
                    if (user && user.role === 'admin') {
                        wsettings.adminGroupId = remoteJid;
                        writeDB(WHATSAPP_SETTINGS_FILE, wsettings);
                        await sock.sendMessage(remoteJid, { text: '✅ Este grupo ha sido configurado como el Grupo de Administradores para recibir notificaciones.' });
                    }
                }
            } else if (cmd === '/info' || cmd === '!info') {
                await sock.sendMessage(remoteJid, { text: '🤖 *MegaUnlock Bot*\n\nSoy el asistente oficial del panel. Para consultar saldos y pedidos, envíame un mensaje privado directo para proteger tu privacidad.' });
            } else if (cmd === '/servicios' || cmd === '!servicios') {
                await sock.sendMessage(remoteJid, { text: '🚀 *Servicios MegaUnlock*\n\nOfrecemos desbloqueos, liberaciones y recargas al mejor precio. ¡Regístrate en nuestro panel web para ver el catálogo completo y hacer tus pedidos!' });
            } else if (cmd === '/ayuda' || cmd === '!ayuda' || cmd === 'ayuda' || cmd === '/comandos' || cmd === '!comandos' || cmd === 'comandos') {
                let helpText = '🤖 *¡Hola! Soy MegaBOOT, tu asistente personal.*\n\nAquí tienes mis comandos mágicos:\n\n🔎 *BÚSQUEDA DE SERVICIOS*\n(Disponibles en el grupo)\n📱 */bus1 <modelo>* - Buscar en Servidor 1\n📱 */bus2 <modelo>* - Buscar en Servidor 2\n📱 */bus3 <modelo>* - Buscar en Servidor 3\n\n🛒 *COMPRAS*\n(Realiza pedidos directamente)\n🛒 */pedir1 <ID>* - Pedir en Servidor 1\n🛒 */pedir2 <ID>* - Pedir en Servidor 2\n🛒 */pedir3 <ID>* - Pedir en Servidor 3\n\n🔐 *COMANDOS PRIVADOS*\n(Envíamelos por Mensaje Privado)\n🧾 */ticket <ID>* - Generar un recibo para tu cliente\n🛍️ */pedidos* - Ver tus últimos 5 pedidos\n💳 */saldo* - Consultar tu saldo en los servidores\n👤 */perfil* - Ver los datos de tu cuenta\n💸 */recargar* - Recarga tu saldo automáticamente 24/7\n🎧 */soporte* - Opciones de ayuda\n🔌 */desvincular* - Desconectar tu cuenta\n\n_🔔 ¡Te enviaré un mensajito en cuanto tus pedidos cambien de estado!_';
                const users = readDB(USERS_FILE) || [];
                const user = users.find(u => u.id === linkedUserId);
                if (user && user.role === 'admin') {
                    helpText += '\n\n👑 *COMANDOS ADMIN:*\n💰 */addMoney* - Agregar saldo a un revendedor\n📉 */removeMoney* - Quitar saldo a revendedor\n🌐 */historial* - Ver últimos 10 pedidos globales\n📢 */msggrup* - Enviar anuncio al grupo oficial';
                }
                await sock.sendMessage(remoteJid, { text: helpText });
            } else if (cmd === '/historial' || cmd === '!historial' || cmd === 'historial') {
                const senderJid = msg.key.participant || remoteJid;
                const linkedUserId = wusers[senderJid];
                const users = readDB(USERS_FILE) || [];
                const user = users.find(u => u.id === linkedUserId);
                if (user && user.role === 'admin') {
                    const history = readDB(path.join(DATA_DIR, 'history.json')) || [];
                    const allOrders = history.slice(0, 10);
                    
                    if (allOrders.length === 0) {
                        await sock.sendMessage(remoteJid, { text: '👻 *¡Qué vacío!* No hay pedidos recientes en todo el panel.' });
                    } else {
                        let resText = '🌐 *Últimos 10 pedidos GLOBALES:*\n\n';
                        allOrders.forEach(o => {
                            const reseller = users.find(u => u.id === o.userId);
                            const rName = reseller ? reseller.username : 'Desconocido';
                            let emoji = o.status === 'success' ? '✅' : (o.status === 'rejected' ? '❌' : '⏳');
                            let cleanStatus = (o.statusText || o.status || 'N/A').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();
                            if (cleanStatus.length > 50) cleanStatus = cleanStatus.substring(0, 47) + '...';
                            resText += `👤 *${rName}*\n📦 *${o.serviceName}*\n🆔 ID Orden: #${o.orderId}\n📱 IMEI: ${o.imei || 'N/A'}\n${emoji} Estado: ${cleanStatus}\n---\n`;
                        });
                        await sock.sendMessage(remoteJid, { text: resText });
                    }
                } else {
                    await sock.sendMessage(remoteJid, { text: '❌ Este comando es exclusivo para administradores.' });
                }
            } else if (['/addmoney', '!addmoney', 'addmoney', '/removemoney', '!removemoney', 'removemoney', '/quitarsaldo', '/saldo', '!saldo', 'saldo', '/pedidos', '!pedidos', 'pedidos', '/ordenes', '!ordenes', 'ordenes', '/ticket', '!ticket', 'ticket', '/perfil', '!perfil', 'perfil'].includes(cmd.split(' ')[0])) {
                await sock.sendMessage(remoteJid, { text: '🔒 *Comando Privado*\n\nHola, estás intentando usar un comando que requiere interacción con tu cuenta o tiene datos sensibles. Por favor, envíame este comando por *Mensaje Privado*.' });
            }
            return;
        }

        // PRIVATE CHAT LOGIC
        const linkedUserId = wusers[remoteJid];
        
        if (!linkedUserId) {
            if (text.trim().toLowerCase() === 'cancelar') {
                if (loginSessions[remoteJid]) delete loginSessions[remoteJid];
                await sock.sendMessage(remoteJid, { text: '🚫 Inicio de sesión cancelado.' });
                return;
            }
            const session = loginSessions[remoteJid] || { step: 0 };
            
            if (session.step === 0) {
                await sock.sendMessage(remoteJid, { text: '👋 *¡Hola!* Parece que tu número no está vinculado a Mega Unlock.\n\nPara empezar a recibir notificaciones mágicas, por favor *ingresa tu usuario*:' });
                loginSessions[remoteJid] = { step: 1 };
            } else if (session.step === 1) {
                loginSessions[remoteJid] = { step: 2, username: text.trim() };
                await sock.sendMessage(remoteJid, { text: '¡Perfecto! 🕵️‍♂️ Ahora *ingresa tu contraseña* (tranquilo, es nuestro secreto):' });
            } else if (session.step === 2) {
                const username = session.username;
                const password = text.trim();
                const users = readDB(USERS_FILE) || [];
                const user = users.find(u => 
                    (u.username === username || u.email === username) && 
                    u.password === password
                );

                if (user) {
                    wusers[remoteJid] = user.id;
                    writeDB(WHATSAPP_USERS_FILE, wusers);
                    await sock.sendMessage(remoteJid, { text: `🎉 *¡BINGO, ${user.username}!*\n\nTu cuenta ha sido vinculada exitosamente a WhatsApp.\n\nEscribe */comandos* para ver mis superpoderes. 🦸‍♂️` });
                    delete loginSessions[remoteJid];
                } else {
                    await sock.sendMessage(remoteJid, { text: '❌ *¡Ups!* Las credenciales no coinciden.\n\nVamos a intentarlo de nuevo. Por favor, *ingresa tu usuario*:' });
                    loginSessions[remoteJid] = { step: 1 };
                }
            }
        } else {
            if (text.trim().toLowerCase() === 'cancelar') {
                if (orderSessions[remoteJid]) delete orderSessions[remoteJid];
                if (addMoneySessions[remoteJid]) delete addMoneySessions[remoteJid];
                if (ticketSessions[remoteJid]) delete ticketSessions[remoteJid];
                if (autoFundSessions[remoteJid]) delete autoFundSessions[remoteJid];
                if (msgGrupSessions[remoteJid]) delete msgGrupSessions[remoteJid];
                await sock.sendMessage(remoteJid, { text: '🚫 Acción cancelada exitosamente.' });
                return;
            }

            if (msgGrupSessions[remoteJid]) {
                const session = msgGrupSessions[remoteJid];
                if (session.step === 1) {
                    const messageToSend = text.trim();
                    if (!wsettings.adminGroupId) {
                        await sock.sendMessage(remoteJid, { text: '❌ *ERROR:* No hay ningún grupo oficial configurado. Agrégame a un grupo y escribe !setgroup' });
                        delete msgGrupSessions[remoteJid];
                        return;
                    }
                    
                    const groupMsg = `🟢 *COMUNICADO OFICIAL* 🟢\n━━━━━━━━━━━━━━━━━━━━━━\n\n${messageToSend}\n\n━━━━━━━━━━━━━━━━━━━━━━\n🛡️ _MegaUnlockPhone_ | 👤 _Administración_`;
                    await sock.sendMessage(wsettings.adminGroupId, { text: groupMsg });
                    await sock.sendMessage(remoteJid, { text: '✅ *¡Anuncio enviado con éxito al grupo oficial!*' });
                    delete msgGrupSessions[remoteJid];
                    return;
                }
            }

            if (orderSessions[remoteJid]) {
                const session = orderSessions[remoteJid];
                
                if (session.step === 1) {
                    const serviceId = text.trim();
                    if (!serviceId || isNaN(serviceId)) {
                        await sock.sendMessage(remoteJid, { text: '❌ ID inválido. Por favor, ingresa solo el número del ID (o escribe "cancelar").' });
                        return;
                    }
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
                        
                        // New Advanced fields
                        session.qntRequired = sInfo.QNT === "1";
                        session.minQnt = parseInt(sInfo.MINQNT) || 1;
                        session.maxQnt = parseInt(sInfo.MAXQNT) || 9999;
                        session.custom = sInfo.CUSTOM || {};
                        session.imeiName = sInfo.IMEINAME;
                        
                        if (session.qntRequired) {
                            session.step = 'QUANTITY';
                            await sock.sendMessage(remoteJid, { text: `✅ Servicio seleccionado:\n*${sInfo.name}*\n💰 Precio base: $${sInfo.price.toFixed(2)} MXN\n\nEste servicio requiere **CANTIDAD**.\nPor favor ingresa la cantidad (Mínimo: ${session.minQnt}, Máximo: ${session.maxQnt}):` });
                        } else {
                            session.qnt = 1;
                            session.step = 'INPUT';
                            const fallbackType = session.type === 'DATA' ? 'INFO' : session.type;
                            const fieldName = session.customField || session.imeiName || session.custom.customname || fallbackType;
                            await sock.sendMessage(remoteJid, { text: `✅ Servicio seleccionado:\n*${sInfo.name}*\n💰 Precio: $${sInfo.price.toFixed(2)} MXN\n\nPor favor, ingresa el *${fieldName}* requerido para este servicio:` });
                        }
                    } catch (e) {
                        if (e.response && e.response.status === 404) {
                            await sock.sendMessage(remoteJid, { text: '❌ El servicio no existe o no está disponible.' });
                        } else {
                            await sock.sendMessage(remoteJid, { text: '❌ Error al verificar el servicio.' });
                        }
                    }
                    return;
                } else if (session.step === 'QUANTITY') {
                    let qty = parseInt(text.trim());
                    if (isNaN(qty) || qty < session.minQnt || qty > session.maxQnt) {
                        await sock.sendMessage(remoteJid, { text: `❌ Cantidad inválida. Debe ser un número entre ${session.minQnt} y ${session.maxQnt}. Intenta de nuevo:` });
                        return;
                    }
                    session.qnt = qty;
                    session.step = 'INPUT';
                    const fallbackType = session.type === 'DATA' ? 'INFO' : session.type;
                    const fieldName = session.customField || session.imeiName || session.custom.customname || fallbackType;
                    await sock.sendMessage(remoteJid, { text: `✅ Cantidad registrada: ${qty} (Total: $${(session.price * qty).toFixed(2)} MXN)\n\nPor favor, ingresa el *${fieldName}* requerido para este servicio:` });
                    return;
                } else if (session.step === 'INPUT') {
                    const inputVal = text.trim();
                    
                    // Advanced Validation Check
                    if (session.custom) {
                        if (session.custom.customlen && inputVal.length < parseInt(session.custom.customlen)) {
                            await sock.sendMessage(remoteJid, { text: `❌ Error: El texto debe tener al menos ${session.custom.customlen} caracteres. Ingresa el valor nuevamente:` });
                            return;
                        }
                        if (session.custom.maxlength && inputVal.length > parseInt(session.custom.maxlength)) {
                            await sock.sendMessage(remoteJid, { text: `❌ Error: El texto no puede superar ${session.custom.maxlength} caracteres. Ingresa el valor nuevamente:` });
                            return;
                        }
                        if (session.custom.regex) {
                            try {
                                const rx = new RegExp(session.custom.regex);
                                if (!rx.test(inputVal)) {
                                    await sock.sendMessage(remoteJid, { text: `❌ Error: El formato es inválido (debe cumplir: ${session.custom.regex}). Ingresa el valor nuevamente:` });
                                    return;
                                }
                            } catch (e) {} // Ignore bad regex from server
                        }
                    }

                    session.imei = inputVal;
                    session.step = 'CONFIRM';
                    
                    const fallbackType = session.type === 'DATA' ? 'INFO' : session.type;
                    const fieldName = session.customField || session.imeiName || session.custom.customname || fallbackType;
                    const totalCost = session.price * session.qnt;
                    
                    let confMsg = `⚠️ *CONFIRMACIÓN DE PEDIDO* ⚠️\n\n🔧 Servicio: ${session.serviceName}\n`;
                    if (session.qntRequired) confMsg += `📦 Cantidad: ${session.qnt}\n`;
                    confMsg += `📱 ${fieldName}: ${session.imei}\n💲 Costo Total a descontar: $${totalCost.toFixed(2)} MXN\n\n¿Estás seguro de continuar? Responde *SI* para confirmar o *NO* para cancelar.`;
                    
                    await sock.sendMessage(remoteJid, { text: confMsg });
                    return;
                } else if (session.step === 'CONFIRM') {
                    const ans = text.toLowerCase().trim();
                    if (ans === 'si' || ans === 'sí') {
                        await sock.sendMessage(remoteJid, { text: '⏳ Procesando pedido, por favor espera...' });
                        try {
                            const axios = require('axios');
                            
                            const payload = {
                                botSecret: 'MEGA_BOT_SECRET_2026',
                                userId: linkedUserId,
                                serverId: session.serverId,
                                serviceid: session.serviceId,
                                serviceName: session.serviceName,
                                serviceType: session.type === 'DATA' ? 'INFO' : session.type,
                                imei: session.imei,
                                qnt: session.qnt
                            };
                            
                            if (session.customField) {
                                payload.custom_fields = { [session.customField]: session.imei };
                            }
                            
                            const res = await axios.post('https://megaunlockphone-panel.alwaysdata.net/api/bot/order', payload);
                            
                            if (res.data.error || res.data.ERROR) {
                                let errStr = res.data.error || res.data.ERROR;
                                if (typeof errStr === 'object') errStr = JSON.stringify(errStr);
                                await sock.sendMessage(remoteJid, { text: `❌ Error al procesar tu pedido:\n${errStr}` });
                            } else {
                                // For immediate notifications if Dhru returns instant success
                                // We wait for the web panel webhook or background poller to notify us.
                                // The backend already calls enqueueWhatsApp if it finishes immediately.
                            }
                        } catch (e) {
                            let errText = e.response?.data?.error || e.message;
                            if (typeof errText === 'object') errText = JSON.stringify(errText);
                            await sock.sendMessage(remoteJid, { text: `❌ Fallo al procesar el pedido:\n${errText}` });
                        }
                        delete orderSessions[remoteJid];
                    } else if (ans === 'no') {
                        delete orderSessions[remoteJid];
                        await sock.sendMessage(remoteJid, { text: '🚫 Pedido cancelado.' });
                    } else {
                        await sock.sendMessage(remoteJid, { text: 'Responde *SI* o *NO*.' });
                    }
                    return;
                }
            } else if (addMoneySessions[remoteJid]) {
                const session = addMoneySessions[remoteJid];
                if (session.step === 1) {
                    const sel = parseInt(text.trim());
                    if (isNaN(sel) || sel < 1 || sel > session.resellers.length) {
                        await sock.sendMessage(remoteJid, { text: '❌ Selección inválida. Por favor, ingresa el número de la lista (o escribe "cancelar").' });
                        return;
                    }
                    session.resellerId = session.resellers[sel - 1].id;
                    session.resellerName = session.resellers[sel - 1].username;
                    session.step = 2;
                    await sock.sendMessage(remoteJid, { text: `✅ Has seleccionado a *${session.resellerName}*.\n\n¿A qué *Servidor* le quieres agregar saldo? (Responde 1, 2 o 3)` });
                    return;
                } else if (session.step === 2) {
                    const sId = text.trim();
                    if (!['1', '2', '3'].includes(sId)) {
                        await sock.sendMessage(remoteJid, { text: '❌ Servidor inválido. Responde 1, 2 o 3 (o escribe "cancelar").' });
                        return;
                    }
                    session.serverId = sId;
                    session.step = 3;
                    
                    await sock.sendMessage(remoteJid, { text: `🔄 Consultando el estado actual del Servidor ${sId}...` });
                    
                    let serverDisp = 'Desconocido';
                    try {
                        const axios = require('axios');
                        const res = await axios.post('https://megaunlockphone-panel.alwaysdata.net/api/bot/saldo', {
                            botSecret: 'MEGA_BOT_SECRET_2026',
                            userId: linkedUserId
                        });
                        const bals = res.data.balances;
                        if (bals && bals[sId] && !bals[sId].error) {
                            serverDisp = `$${bals[sId].disp.toFixed(2)} MXN`;
                        }
                    } catch (e) {
                        console.error('Error fetching saldo in addMoney step 2:', e);
                    }
                    
                    const users = readDB(USERS_FILE) || [];
                    let cedido = 0;
                    let targetResellerBal = 0;
                    users.forEach(u => {
                        if (u.role !== 'admin') {
                            const bal = parseFloat(u['credits_' + sId] || 0);
                            cedido += bal;
                            if (u.id === session.resellerId) targetResellerBal = bal;
                        }
                    });
                    
                    const actionWord = session.type === 'remove' ? 'descontar' : 'agregar';
                    await sock.sendMessage(remoteJid, { text: `✅ Servidor ${sId} seleccionado para ${session.resellerName}.\n\n📊 *Estado del Servidor ${sId}:*\n- Crédito DISPONIBLE: ${serverDisp}\n- Total repartido a revendedores: $${cedido.toFixed(2)} MXN\n- Saldo actual de ${session.resellerName}: $${targetResellerBal.toFixed(2)} MXN\n\nPor favor, ingresa la *cantidad exacta de saldo* (en MXN) a ${actionWord} (ej. 50.00):` });
                    return;
                } else if (session.step === 3) {
                    const amount = parseFloat(text.trim());
                    if (isNaN(amount) || amount <= 0) {
                        await sock.sendMessage(remoteJid, { text: '❌ Monto inválido. Ingresa un número mayor a 0 (o "cancelar").' });
                        return;
                    }
                    session.amount = amount;
                    session.step = 4;
                    
                    if (session.type === 'remove') {
                        await sock.sendMessage(remoteJid, { text: `⚠️ *CONFIRMACIÓN DE DESCUENTO* ⚠️\n\n👤 Revendedor: ${session.resellerName}\n🏢 Servidor: ${session.serverId}\n📉 Monto a descontar: $${amount.toFixed(2)} MXN\n\n¿Confirmas esta reducción de saldo? Responde *SI* para proceder.` });
                    } else {
                        await sock.sendMessage(remoteJid, { text: `⚠️ *CONFIRMACIÓN DE RECARGA* ⚠️\n\n👤 Revendedor: ${session.resellerName}\n🏢 Servidor: ${session.serverId}\n💲 Monto a agregar: $${amount.toFixed(2)} MXN\n\n¿Confirmas esta recarga? Responde *SI* para proceder.` });
                    }
                    return;
                } else if (session.step === 4) {
                    const ans = text.toLowerCase().trim();
                    if (ans === 'si' || ans === 'sí') {
                        await sock.sendMessage(remoteJid, { text: '⏳ Procesando transacción...' });
                        
                        const finalAmount = session.type === 'remove' ? -Math.abs(session.amount) : Math.abs(session.amount);
                        
                        try {
                            const axios = require('axios');
                            const res = await axios.post('https://megaunlockphone-panel.alwaysdata.net/api/bot/add_money', {
                                botSecret: 'MEGA_BOT_SECRET_2026',
                                adminId: linkedUserId,
                                resellerId: session.resellerId,
                                serverId: session.serverId,
                                amount: finalAmount
                            });
                            if (res.data.error) {
                                await sock.sendMessage(remoteJid, { text: `❌ Error al procesar:\n${res.data.error}` });
                            } else {
                                if (session.type === 'remove') {
                                    await sock.sendMessage(remoteJid, { text: `✅ *¡DESCUENTO EXITOSO!*\n\nSe descontaron $${Math.abs(session.amount).toFixed(2)} al Servidor ${session.serverId} de ${session.resellerName}.\nNuevo saldo del revendedor: $${parseFloat(res.data.newBalance).toFixed(2)}` });
                                } else {
                                    await sock.sendMessage(remoteJid, { text: `✅ *¡RECARGA EXITOSA!*\n\nSe agregaron $${session.amount.toFixed(2)} al Servidor ${session.serverId} de ${session.resellerName}.\nNuevo saldo del revendedor: $${parseFloat(res.data.newBalance).toFixed(2)}` });
                                }
                            }
                        } catch (e) {
                            const errText = e.response?.data?.error || e.message;
                            await sock.sendMessage(remoteJid, { text: `❌ Fallo al conectar con el panel:\n${errText}` });
                        }
                    } else {
                        await sock.sendMessage(remoteJid, { text: '🚫 Recarga cancelada.' });
                    }
                    delete addMoneySessions[remoteJid];
                    return;
                }
            } else if (autoFundSessions[remoteJid]) {
                const session = autoFundSessions[remoteJid];
                if (session.step === 1) {
                    const amount = parseFloat(text.trim());
                    if (isNaN(amount) || amount <= 0) {
                        await sock.sendMessage(remoteJid, { text: '❌ Por favor, ingresa un monto válido (o "cancelar").' });
                        return;
                    }
                    session.amount = amount;
                    session.step = 1.5;
                    let serverText = '🖥️ *Selecciona el servidor al que deseas agregar saldo*\nResponde con el número de la lista:\n\n1️⃣ LatamGSM (Mínimo recomendado: $50)\n3️⃣ UnlockerFast (Mínimo recomendado: $100)';
                    await sock.sendMessage(remoteJid, { text: serverText });
                    return;
                } else if (session.step === 1.5) {
                    const opt = parseInt(text.trim());
                    if (opt !== 1 && opt !== 3) {
                       await sock.sendMessage(remoteJid, { text: '❌ Opción inválida. Responde 1 para LatamGSM o 3 para UnlockerFast.' });
                       return;
                    }
                    session.serverId = String(opt);
                    session.step = 2;
                    let bankText = '🏦 *Selecciona tu Banco de Origen*\nResponde con el número de la lista:\n\n1️⃣ BBVA\n2️⃣ Banamex\n3️⃣ Banorte\n4️⃣ Santander\n5️⃣ Banco Azteca\n6️⃣ NU\n7️⃣ Spin/OXXO\n8️⃣ HSBC\n9️⃣ Scotiabank\n1️⃣0️⃣ Inbursa\n1️⃣1️⃣ Banregio\n1️⃣2️⃣ Mercado Pago\n1️⃣3️⃣ Klar';
                    await sock.sendMessage(remoteJid, { text: bankText });
                    return;
                } else if (session.step === 2) {
                    const option = parseInt(text.trim());
                    let userBankCode = '99999';
                    if (option === 1) userBankCode = '40012';
                    else if (option === 2) userBankCode = '40002';
                    else if (option === 3) userBankCode = '40072';
                    else if (option === 4) userBankCode = '40014';
                    else if (option === 5) userBankCode = '40127';
                    else if (option === 6) userBankCode = '40638';
                    else if (option === 7) userBankCode = '90706';
                    else if (option === 8) userBankCode = '40021';
                    else if (option === 9) userBankCode = '40044';
                    else if (option === 10) userBankCode = '40036';
                    else if (option === 11) userBankCode = '40058';
                    else if (option === 12) userBankCode = '40659';
                    else if (option === 13) userBankCode = '40655';
                    
                    if (userBankCode === '99999') {
                        await sock.sendMessage(remoteJid, { text: '❌ Opción inválida. Responde con un número de la lista.' });
                        return;
                    }

                    session.userBankCode = userBankCode;
                    session.step = 3;
                    
                    await sock.sendMessage(remoteJid, { text: '🔄 Buscando la mejor bóveda para tu depósito...' });
                    
                    try {
                        const axios = require('axios');
                        const res = await axios.post('https://megaunlockphone-panel.alwaysdata.net/api/fund/route', {
                            amount: session.amount,
                            bankCode: session.userBankCode,
                            serverId: session.serverId,
                            botSecret: 'MEGA_BOT_SECRET_2026'
                        }, { headers: { 'Authorization': 'Bearer ' + linkedUserId } });
                        
                        const routeInfo = res.data;

                        if (routeInfo.error) {
                            delete autoFundSessions[remoteJid];
                            await sock.sendMessage(remoteJid, { text: `❌ ${routeInfo.error}` });
                            return;
                        }
                        
                        session.routeInfo = routeInfo;
                        
                        let depMsg = `✅ *Bóveda Asignada*\n\nPor favor realiza una *Transferencia SPEI* por exactamente *$${session.amount.toFixed(2)} MXN* a la siguiente cuenta:\n\n`;
                        depMsg += `🏦 *Banco:* ${routeInfo.account.bankName}\n`;
                        depMsg += `👤 *Nombre:* ${routeInfo.account.ownerName}\n`;
                        depMsg += `💳 *CLABE:* ${routeInfo.account.clabe}\n\n`;
                        depMsg += `⚠️ *IMPORTANTE:* LAS CUENTAS CAMBIAN CONTINUAMENTE, si transfieres a una cuenta anterior el saldo se puede perder. Por favor asegúrate de enviar exactamente a esta cuenta.\n\n`;
                        depMsg += `_Una vez realizada la transferencia, responde a este mensaje con la *Clave de Rastreo* de Banxico o el folio SPEI para abonar tu saldo._`;
                        
                        await sock.sendMessage(remoteJid, { text: depMsg });
                    } catch (e) {
                        delete autoFundSessions[remoteJid];
                        await sock.sendMessage(remoteJid, { text: '❌ Ocurrió un error al asignar bóveda. Intenta de nuevo más tarde.' });
                    }
                    return;
                } else if (session.step === 3) {
                    const trackingNumber = text.trim();
                    if (!trackingNumber || trackingNumber.length < 5) {
                        await sock.sendMessage(remoteJid, { text: '❌ Clave de rastreo muy corta. Intenta de nuevo.' });
                        return;
                    }
                    
                    await sock.sendMessage(remoteJid, { text: '🔍 *Verificando transferencia en Banxico...* Esto puede tomar hasta 30 segundos.' });
                    
                    try {
                        const axios = require('axios');
                        const res = await axios.post('https://megaunlockphone-panel.alwaysdata.net/api/fund/verify', {
                            amount: session.amount,
                            bankCode: session.userBankCode,
                            trackingNumber: trackingNumber,
                            accountId: session.routeInfo.account.id,
                            providerKey: session.routeInfo.account.providerKey,
                            serverId: session.serverId,
                            botSecret: 'MEGA_BOT_SECRET_2026'
                        }, { headers: { 'Authorization': 'Bearer ' + linkedUserId } });
                        
                        await sock.sendMessage(remoteJid, { text: res.data.message });
                        delete autoFundSessions[remoteJid];
                    } catch (e) {
                        const errText = e.response?.data?.error || 'Error de conexión. Intenta enviar tu clave de rastreo nuevamente en unos minutos.';
                        await sock.sendMessage(remoteJid, { text: `❌ ${errText}` });
                    }
                    return;
                }
            } else if (ticketSessions[remoteJid]) {
                const session = ticketSessions[remoteJid];
                if (session.step === 1) {
                    const oId = text.trim();
                    if (!oId) return;
                    session.orderId = oId;
                    
                    const history = readDB(path.join(DATA_DIR, 'history.json')) || [];
                    const order = history.find(h => String(h.orderId) === String(oId) && h.userId === linkedUserId);
                    if (!order) {
                        await sock.sendMessage(remoteJid, { text: '❌ No se encontró esa orden en tu historial. Revisa el ID e intenta de nuevo (o escribe "cancelar").' });
                        return;
                    }
                    session.order = order;
                    session.step = 2;
                    await sock.sendMessage(remoteJid, { text: `✅ Orden #${order.orderId} encontrada (${order.serviceName}).\n\n¿Qué *precio a mostrar* quieres ponerle al recibo para tu cliente final? (ej. 250.00):` });
                    return;
                } else if (session.step === 2) {
                    const clientPrice = parseFloat(text.trim());
                    if (isNaN(clientPrice) || clientPrice < 0) {
                        await sock.sendMessage(remoteJid, { text: '❌ Precio inválido. Ingresa un número válido (o "cancelar").' });
                        return;
                    }
                    const o = session.order;
                    let cleanStatus = (o.statusText || o.status || 'Completado').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
                    const dateStr = o.date ? new Date(o.date).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) : 'N/A';
                    const receipt = `🧾 *MEGAUNLOCKPHONE TICKET* 🧾\n━━━━━━━━━━━━━━━━━━━━━━\n\n🆔 *Orden:* #${o.orderId}\n📅 *Fecha y Hora:* ${dateStr}\n📱 *IMEI/SN:* ${o.imei || 'N/A'}\n🔧 *Servicio:* ${o.serviceName}\n\n💲 *Total Pagado:* $${clientPrice.toFixed(2)}\n\n🔑 *Respuesta / Código:*\n${cleanStatus}\n\n🎉 *Estado:* Completado\n\n━━━━━━━━━━━━━━━━━━━━━━\n_¡Gracias por tu preferencia!_ 🌐`;
                    await sock.sendMessage(remoteJid, { text: receipt });
                    delete ticketSessions[remoteJid];
                    return;
                }
            }
            
            if (firstWord === '/msggrup' || firstWord === '!msggrup') {
                const users = readDB(USERS_FILE) || [];
                const user = users.find(u => u.id === linkedUserId);
                if (!user || user.role !== 'admin') {
                    await sock.sendMessage(remoteJid, { text: '❌ Este comando es exclusivo para administradores.' });
                    return;
                }
                msgGrupSessions[remoteJid] = { step: 1 };
                await sock.sendMessage(remoteJid, { text: '📢 *MODO ANUNCIO ACTIVADO*\n━━━━━━━━━━━━━━━━━━━━━━\n✍️ Escribe el mensaje que deseas transmitir a todos en el grupo oficial.\n\n_💡 Tip: Puedes usar emojis y formato de WhatsApp (*negrita*, _cursiva_)._\n\n(Escribe *cancelar* para salir)' });
                return;
            }

            if (firstWord === '/pedir1' || firstWord === '/pedir2' || firstWord === '/pedir3') {
                const sId = firstWord.replace('/pedir', '');
                if (!linkedUserId) {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Debes vincular tu cuenta para hacer pedidos.' });
                    return;
                }
                orderSessions[remoteJid] = { step: 1, serverId: sId };
                await sock.sendMessage(remoteJid, { text: `🛒 ¡Excelente! Vamos a hacer un pedido en el Servidor ${sId}.\n\nPor favor, ingresa el *ID del servicio* que deseas comprar (o escribe "cancelar" para salir):` });
                return;
            }

            const cmd = text.toLowerCase().trim();
            
            if (cmd === '/desvincular' || cmd === '!desvincular' || cmd === 'desvincular') {
                delete wusers[remoteJid];
                writeDB(WHATSAPP_USERS_FILE, wusers);
                await sock.sendMessage(remoteJid, { text: '🔌 *¡Desconectado!* Tu cuenta ha sido desvinculada de este WhatsApp. \n\n¡Te echaré de menos! 😢' });
            
            } else if (cmd === '/ordenes' || cmd === '!ordenes' || cmd === 'ordenes' || cmd === '/pedidos' || cmd === '!pedidos' || cmd === 'pedidos') {
                const history = readDB(path.join(DATA_DIR, 'history.json')) || [];
                const myOrders = history.filter(h => h.userId === linkedUserId).slice(0, 5); // ultimas 5
                
                if (myOrders.length === 0) {
                    await sock.sendMessage(remoteJid, { text: '👻 *¡Qué vacío!* No tienes pedidos recientes. ¡Anímate a hacer uno en el panel!' });
                } else {
                    let resText = '📋 *TUS ÚLTIMOS PEDIDOS*\n━━━━━━━━━━━━━━━━━━━━━━\n';
                    myOrders.forEach(o => {
                        let emoji = o.status === 'success' ? '✅' : (o.status === 'rejected' ? '❌' : '⏳');
                        let cleanStatus = (o.statusText || o.status || 'N/A').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();
                        if (cleanStatus.length > 50) cleanStatus = cleanStatus.substring(0, 47) + '...';
                        const dateStr = o.date ? new Date(o.date).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) : 'N/A';
                        resText += `📦 *${o.serviceName}*\n🆔 *Orden:* #${o.orderId}\n📱 *IMEI:* ${o.imei || 'N/A'}\n📅 *Fecha:* ${dateStr}\n${emoji} *Estado:* ${cleanStatus}\n━━━━━━━━━━━━━━━━━━━━━━\n`;
                    });
                    resText += `\n_Para ver detalles completos o tu historial antiguo, visita tu web._`;
                    await sock.sendMessage(remoteJid, { text: resText });
                }

            } else if (cmd === '/historial' || cmd === '!historial' || cmd === 'historial') {
                const users = readDB(USERS_FILE) || [];
                const user = users.find(u => u.id === linkedUserId);
                if (user && user.role === 'admin') {
                    const history = readDB(path.join(DATA_DIR, 'history.json')) || [];
                    const allOrders = history.slice(0, 10);
                    
                    if (allOrders.length === 0) {
                        await sock.sendMessage(remoteJid, { text: '👻 *¡Qué vacío!* No hay pedidos recientes en todo el panel.' });
                    } else {
                        let resText = '🌐 *ÚLTIMOS 10 PEDIDOS GLOBALES*\n━━━━━━━━━━━━━━━━━━━━━━\n';
                        allOrders.forEach(o => {
                            const reseller = users.find(u => u.id === o.userId);
                            const rName = reseller ? reseller.username : 'Desconocido';
                            let emoji = o.status === 'success' ? '✅' : (o.status === 'rejected' ? '❌' : '⏳');
                            let cleanStatus = (o.statusText || o.status || 'N/A').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();
                            if (cleanStatus.length > 50) cleanStatus = cleanStatus.substring(0, 47) + '...';
                            const dateStr = o.date ? new Date(o.date).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) : 'N/A';
                            resText += `👤 *Usuario:* ${rName}\n📦 *${o.serviceName}*\n🆔 *ID Orden:* #${o.orderId}\n📱 *IMEI:* ${o.imei || 'N/A'}\n📅 *Fecha:* ${dateStr}\n${emoji} *Estado:* ${cleanStatus}\n━━━━━━━━━━━━━━━━━━━━━━\n`;
                        });
                        await sock.sendMessage(remoteJid, { text: resText });
                    }
                } else {
                    await sock.sendMessage(remoteJid, { text: '❌ Este comando es exclusivo para administradores.' });
                }
            } else if (cmd === '/recargar' || cmd === '!recargar' || cmd === 'recargar' || cmd === '/addsaldo' || cmd === '!addsaldo') {
                autoFundSessions[remoteJid] = { step: 1 };
                await sock.sendMessage(remoteJid, { text: '💸 *Recarga Automática SPEI*\n\n¿Cuánto dinero deseas recargar a tu cuenta? (Mínimo $50 MXN)\n\n_Escribe solo el número, ej: 100_' });
                return;
            } else if (cmd === '/saldo' || cmd === '!saldo' || cmd === 'saldo') {
                const users = readDB(USERS_FILE) || [];
                const user = users.find(u => u.id === linkedUserId);
                if (user) {
                    if (user.role === 'admin') {
                        await sock.sendMessage(remoteJid, { text: '🔄 *Consultando las bóvedas en tiempo real...*' });
                        
                        const settingsDb = readDB(path.join(DATA_DIR, 'settings.json')) || {};
                        const allUsers = readDB(USERS_FILE) || [];
                        let saldoText = `✨ *Bóvedas Administrativas*\n\n`;
                        
                        try {
                            const axios = require('axios');
                            const res = await axios.post('https://megaunlockphone-panel.alwaysdata.net/api/bot/saldo', {
                                botSecret: 'MEGA_BOT_SECRET_2026',
                                userId: linkedUserId
                            });
                            
                            const bals = res.data.balances;
                            for (let sId of ['1', '2', '3']) {
                                if (bals[sId].error) {
                                    saldoText += `🏢 *Servidor ${sId}:* ${bals[sId].error}\n\n`;
                                } else {
                                    saldoText += `🏢 *Servidor ${sId}*\n`;
                                    saldoText += `🟢 REAL: $${bals[sId].real.toFixed(2)}\n`;
                                    saldoText += `🟣 CEDIDO: $${bals[sId].cedido.toFixed(2)}\n`;
                                    saldoText += `🔵 DISP: $${bals[sId].disp.toFixed(2)}\n\n`;
                                }
                            }
                            await sock.sendMessage(remoteJid, { text: saldoText.trim() });
                        } catch (e) {
                            const errMsg = e.response ? `HTTP ${e.response.status}: ${JSON.stringify(e.response.data)}` : e.message;
                            await sock.sendMessage(remoteJid, { text: `❌ Error de diagnóstico interno: ${errMsg}` });
                        }
                    } else {
                        let saldoText = `✨ *¡Hola, ${user.username}!* Aquí tienes tu saldo actual:\n\n`;
                        let hasCredits = false;
                        
                        if (user.credits_1 !== undefined) {
                            saldoText += `🏢 *Servidor 1:* $${parseFloat(user.credits_1).toFixed(2)}\n`;
                            hasCredits = true;
                        }
                        if (user.credits_2 !== undefined) {
                            saldoText += `🏢 *Servidor 2:* $${parseFloat(user.credits_2).toFixed(2)}\n`;
                            hasCredits = true;
                        }
                        if (user.credits_3 !== undefined) {
                            saldoText += `🏢 *Servidor 3:* $${parseFloat(user.credits_3).toFixed(2)}\n`;
                            hasCredits = true;
                        }
                        if (user.credit !== undefined && user.credit > 0) {
                            saldoText += `💰 *Saldo General:* $${parseFloat(user.credit).toFixed(2)}\n`;
                            hasCredits = true;
                        }
                        
                        if (!hasCredits) {
                            saldoText += `💸 *Saldo Total:* $0.00 MXN\n`;
                        }
                        saldoText += `━━━━━━━━━━━━━━━━━━━━━━\n🚀 _¡Listo para seguir desbloqueando!_`;
                        
                        await sock.sendMessage(remoteJid, { text: saldoText });
                    }
                }
            } else if (cmd === '/perfil' || cmd === '!perfil' || cmd === 'perfil') {
                const users = readDB(USERS_FILE) || [];
                const user = users.find(u => u.id === linkedUserId);
                if (user) {
                    const role = user.role === 'admin' ? '👑 Administrador' : (user.role === 'reseller' ? '💼 Revendedor' : '👤 Usuario');
                    const profileMsg = `👤 *PERFIL MEGAUNLOCK* 👤\n━━━━━━━━━━━━━━━━━━━━━━\n📛 *Usuario:* ${user.username}\n🛡️ *Rol:* ${role}\n#️⃣ *ID de Cuenta:* ${user.id}\n━━━━━━━━━━━━━━━━━━━━━━\n_Tu cuenta está conectada de forma segura._`;
                    await sock.sendMessage(remoteJid, { text: profileMsg });
                }
            } else if (cmd === '/forceaddmoneyserver' || cmd === '/forceaddmoneyadmin') {
                const users = readDB(USERS_FILE) || [];
                const user = users.find(u => u.id === linkedUserId);
                if (user && user.role === 'admin') {
                    const arg = (textParts[1] || '').toLowerCase();
                    if (arg !== 'on' && arg !== 'off') {
                        await sock.sendMessage(remoteJid, { text: '❌ Uso: ' + cmd + ' on|off' });
                        return;
                    }
                    
                    let mode = 'INTELLIGENT';
                    const isServerCommand = (cmd === '/forceaddmoneyserver');
                    
                    if (arg === 'on') {
                        mode = isServerCommand ? 'FORCE_SERVER' : 'FORCE_ADMIN';
                    }
                    
                    writeDB(path.join(DATA_DIR, 'payment_override.json'), { mode: mode });
                    
                    if (mode === 'INTELLIGENT') {
                        await sock.sendMessage(remoteJid, { text: '✅ Modo de Enrutamiento Inteligente ACTIVADO.' });
                    } else if (mode === 'FORCE_SERVER') {
                        await sock.sendMessage(remoteJid, { text: '⚠️ MODO FORZADO: Todas las recargas SPEI irán a las cuentas de los PROVEEDORES.' });
                    } else if (mode === 'FORCE_ADMIN') {
                        await sock.sendMessage(remoteJid, { text: '⚠️ MODO FORZADO: Todas las recargas SPEI irán a las cuentas del ADMIN.' });
                    }
                } else {
                    await sock.sendMessage(remoteJid, { text: '❌ Este comando es exclusivo para administradores.' });
                }
            } else if (cmd === '/addmoney' || cmd === '!addmoney' || cmd === 'addmoney' || cmd === '/removemoney' || cmd === '!removemoney' || cmd === 'removemoney' || cmd === '/quitarsaldo') {
                const isRemove = cmd.includes('remove') || cmd.includes('quitar');
                const users = readDB(USERS_FILE) || [];
                const user = users.find(u => u.id === linkedUserId);
                if (user && user.role === 'admin') {
                    const resellers = users.filter(u => u.role !== 'admin');
                    if (resellers.length === 0) {
                        await sock.sendMessage(remoteJid, { text: '❌ No tienes revendedores registrados.' });
                        return;
                    }
                    let resText = '👥 *Lista de Revendedores:*\n\n';
                    resellers.forEach((r, i) => {
                        resText += `${i + 1}. ${r.username}\n`;
                    });
                    const actionWord = isRemove ? 'quitar' : 'agregar';
                    resText += `\nPor favor, responde con el *número* del revendedor al que deseas ${actionWord} saldo (o "cancelar").`;
                    
                    addMoneySessions[remoteJid] = { step: 1, resellers: resellers, type: isRemove ? 'remove' : 'add' };
                    await sock.sendMessage(remoteJid, { text: resText });
                } else {
                    await sock.sendMessage(remoteJid, { text: '❌ Este comando es exclusivo para administradores.' });
                }
            } else if (cmd === '/ticket' || cmd === '!ticket' || cmd === 'ticket' || firstWord === '/ticket') {
                let oId = '';
                if (firstWord === '/ticket' && textParts.length > 1) {
                    oId = textParts[1].trim();
                }
                
                if (oId) {
                    const history = readDB(path.join(DATA_DIR, 'history.json')) || [];
                    const order = history.find(h => String(h.orderId) === String(oId) && h.userId === linkedUserId);
                    if (!order) {
                        await sock.sendMessage(remoteJid, { text: '❌ No se encontró esa orden en tu historial. Verifica el ID.' });
                        return;
                    }
                    ticketSessions[remoteJid] = { step: 2, order: order };
                    await sock.sendMessage(remoteJid, { text: `✅ Orden #${order.orderId} encontrada (${order.serviceName}).\n\n¿Qué *precio a mostrar* quieres ponerle al recibo para tu cliente final? (ej. 250.00):` });
                } else {
                    ticketSessions[remoteJid] = { step: 1 };
                    await sock.sendMessage(remoteJid, { text: '🧾 *Generador de Tickets*\n\nPor favor, ingresa el *ID de la Orden* para la cual deseas generar el ticket:' });
                }
            } else if (cmd === '/soporte' || cmd === '!soporte' || cmd === 'soporte') {
                await sock.sendMessage(remoteJid, { text: `🎧 *Soporte Técnico*\n\n¿Necesitas ayuda con un pedido o tienes dudas? ¡Estamos para apoyarte!\n\nPor favor, contacta directamente al administrador del panel o envía un mensaje detallando tu problema.\n_Tip: Si tu duda es sobre un pedido, ten tu ID a la mano._` });
            } else if (cmd === '/comandos' || cmd === '!comandos' || cmd === 'comandos' || cmd === 'ayuda' || cmd === '/ayuda') {
                let helpText = '🤖 *¡Hola! Soy MegaBOOT, tu asistente personal.*\n\nAquí tienes mis comandos mágicos:\n\n🔎 *BÚSQUEDA DE SERVICIOS*\n📱 */bus1 <modelo>* - Buscar en Servidor 1\n📱 */bus2 <modelo>* - Buscar en Servidor 2\n📱 */bus3 <modelo>* - Buscar en Servidor 3\n\n🛒 *COMPRAS*\n🛒 */pedir1 <ID>* - Pedir en Servidor 1\n🛒 */pedir2 <ID>* - Pedir en Servidor 2\n🛒 */pedir3 <ID>* - Pedir en Servidor 3\n\n🔐 *MI CUENTA Y HERRAMIENTAS*\n💸 */recargar* - Recarga tu saldo automáticamente 24/7\n🧾 */ticket <ID>* - Generar un recibo para tu cliente\n🛍️ */pedidos* - Ver tus últimos 5 pedidos\n💳 */saldo* - Consultar tu saldo en los servidores\n👤 */perfil* - Ver los datos de tu cuenta\n🎧 */soporte* - Opciones de ayuda\n🔌 */desvincular* - Desconectar tu cuenta';
                const users = readDB(USERS_FILE) || [];
                const user = users.find(u => u.id === linkedUserId);
                if (user && user.role === 'admin') {
                    helpText += '\n\n👑 *COMANDOS ADMIN:*\n💰 */addMoney* - Agregar saldo a un revendedor\n📉 */removeMoney* - Quitar saldo a revendedor\n🌐 */historial* - Ver últimos 10 pedidos globales\n📢 */msggrup* - Enviar anuncio al grupo oficial';
                }
                helpText += '\n\n_🔔 ¡Te enviaré un mensajito en cuanto tus pedidos cambien de estado!_';
                await sock.sendMessage(remoteJid, { text: helpText });
            } else {
                // Respond to unhandled short text so the user doesn't feel left on read
                if (cmd.length < 30) {
                    await sock.sendMessage(remoteJid, { text: '🤖 ¡Hola! No reconocí ese comando.\n\nPor favor, escribe */ayuda* o */comandos* para ver todo lo que puedo hacer por ti.' });
                }
            }
        }
        } catch (err) {
            console.error('WhatsApp Bot Error:', err);
            try {
                await sock.sendMessage(remoteJid, { text: '❌ Ocurrió un error inesperado al procesar tu mensaje. El equipo de soporte ha sido notificado.' });
                // Enviar log al admin (usando la función existente enqueueWhatsAppAdmin)
                enqueueWhatsAppAdmin(`🚨 *ERROR INTERNO EN EL BOT* 🚨\n\nUsuario: ${remoteJid}\nMensaje: ${text.substring(0, 50)}\nError: ${err.message}`);
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
