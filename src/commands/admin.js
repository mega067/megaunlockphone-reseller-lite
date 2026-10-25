const path = require('path');
const { readDB, writeDB } = require('../../src/db');
const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

async function admin(context) {
    const { sock, msg, remoteJid, firstWord, args, text, sessionManager, wusers, hasMedia } = context;
    const linkedUserId = context.linkedUserId != null ? context.linkedUserId : wusers[remoteJid];
    const users = readDB(USERS_FILE) || [];
    const cleanId = String(linkedUserId || '').replace(/\.0+$/, '');
    let user = users.find(u => String(u.id).replace(/\.0+$/, '') === cleanId || (cleanId && String(u.id) === cleanId));

    // Si no está en users.json, verificar en SQLite Users
    if (!user && linkedUserId) {
        try {
            const sqliteDb = require('../../src/database');
            const row = sqliteDb.prepare("SELECT * FROM Users WHERE id = ? OR id = ?").get(cleanId, String(linkedUserId));
            if (row) user = row;
        } catch (e) {}
    }

    if (!user || user.role !== 'admin') return false;

    const cmd = firstWord.toLowerCase();
    
    // Setprice command handling
    const setpriceCmd = require('./setprice');
    if ((sessionManager.setPriceSessions && sessionManager.setPriceSessions[remoteJid]) || ['/setprice', '!setprice', 'setprice'].includes(cmd)) {
        const handled = await setpriceCmd(context);
        if (handled) return true;
    }
    
    // /addmoney and /removemoney
    if (['/addmoney', '!addmoney', 'addmoney'].includes(cmd) || ['/removemoney', '!removemoney', 'removemoney'].includes(cmd)) {
        const isRemove = ['/removemoney', '!removemoney', 'removemoney'].includes(cmd);
        if (args.length >= 4) {
            // direct syntax: /addmoney <ID> <Server> <Amount>
            await processAddMoneyShortcut(remoteJid, isRemove, args[1], args[2], args[3], users, sessionManager, sock);
        } else {
            sessionManager.addMoneySessions[remoteJid] = { step: 1, type: isRemove ? 'remove' : 'add' };
            const resellers = users.filter(u => u.role !== 'admin');
            sessionManager.addMoneySessions[remoteJid].resellers = resellers;
            
            let resText = `💰 *${isRemove ? 'REDUCIR' : 'AGREGAR'} SALDO*\n\nSelecciona el revendedor:\n\n`;
            resellers.forEach((r, idx) => {
                resText += `${idx + 1}️⃣ ${r.username} (ID: ${r.id})\n`;
            });
            await sock.sendMessage(remoteJid, { text: resText });
        }
        return true;
    }

    if (sessionManager.addMoneySessions[remoteJid]) {
        const session = sessionManager.addMoneySessions[remoteJid];
        if (text.toLowerCase() === 'cancelar') {
            sessionManager.clearSession(remoteJid);
            await sock.sendMessage(remoteJid, { text: '🚫 Operación cancelada.' });
            return true;
        }

                if (session.step === 1) {
            const idx = parseInt(text.trim()) - 1;
            if (isNaN(idx) || idx < 0 || idx >= session.resellers.length) {
                await sock.sendMessage(remoteJid, { text: '❌ Opción inválida. Escribe el número del revendedor (o escribe "cancelar").' });
                return true;
            }
            session.resellerId = session.resellers[idx].id;
            session.resellerName = session.resellers[idx].username;
            session.step = 2;
            
            try {
                await sock.sendMessage(remoteJid, {
                    poll: {
                        name: `🏢 Servidor para ${session.resellerName}:`,
                        values: ['1️⃣ MEGA SERVER', '3️⃣ OMEGA SERVER'],
                        selectableCount: 1
                    }
                });
            } catch (pErr) {
                await sock.sendMessage(remoteJid, { text: `✅ Revendedor seleccionado: ${session.resellerName} (ID: ${session.resellerId})\n\nSelecciona el servidor:\n1️⃣ Mega Server\n3️⃣ Omega Server` });
            }
            return true;
        } else if (session.step === 2) {
            const rawVal = text.trim().toLowerCase();
            let sId = null;
            if (rawVal === '3' || rawVal.includes('omega') || rawVal.includes('3️⃣')) {
                sId = '3';
            } else if (rawVal === '1' || /(^|\s|1️⃣)mega(\s|$|server)/i.test(rawVal) || rawVal.includes('1️⃣')) {
                sId = '1';
            } else if (rawVal === '2') {
                sId = '2';
            }

            if (!sId) {
                await sock.sendMessage(remoteJid, { text: '❌ Servidor inválido. Pulsa una opción en la encuesta o responde 1 o 3 (o escribe "cancelar").' });
                return true;
            }
            session.serverId = sId;
            session.step = 3;
            
            await sock.sendMessage(remoteJid, { text: `🔄 Consultando el estado actual del Servidor ${sId}...` });
            
            let serverDisp = 'Desconocido';
            try {
                const { callBotApi } = require('../whatsappEngine');
                let bals = null;
                try {
                    const res = await callBotApi('saldo', { userId: linkedUserId }, 8000);
                    bals = res.data?.balances;
                } catch (e) {
                    const botController = require('../controllers/botController');
                    const mockReq = { body: { userId: linkedUserId, botSecret: 'MEGA_BOT_SECRET_2026' } };
                    const mockRes = {
                        status: () => mockRes,
                        json: (data) => { bals = data.balances; }
                    };
                    await botController.getSaldo(mockReq, mockRes);
                }
                if (bals && bals[sId] && !bals[sId].error) {
                    serverDisp = `$${bals[sId].disp.toFixed(2)} MXN`;
                }
            } catch (e) {
                console.error('Error fetching saldo in addMoney step 2:', e);
            }
            
            let targetResellerBal = 0;
            const updatedUsers = readDB(USERS_FILE) || [];
            updatedUsers.forEach(u => {
                if (u.id === session.resellerId) {
                    targetResellerBal = parseFloat(u['credits_' + sId] || 0);
                }
            });
            
            const msgStr = session.type === 'remove'
                ? `📉 *Reducir Saldo*\n\nServidor seleccionado: ${sId}\n\n📊 *Saldos Actuales:*\nBóveda Disponible para dar: ${serverDisp}\nSaldo actual de ${session.resellerName}: $${targetResellerBal.toFixed(2)} MXN\n\n¿Cuánto saldo deseas descontarle a ${session.resellerName}?`
                : `💸 *Agregar Saldo*\n\nServidor seleccionado: ${sId}\n\n📊 *Saldos Actuales:*\nBóveda Disponible: ${serverDisp}\nSaldo actual de ${session.resellerName}: $${targetResellerBal.toFixed(2)} MXN\n\n¿Cuánto saldo deseas agregar?`;
                
            await sock.sendMessage(remoteJid, { text: msgStr });
            return true;
        } else if (session.step === 3) {
            const amount = parseFloat(text.trim());
            if (isNaN(amount) || amount <= 0) {
                await sock.sendMessage(remoteJid, { text: '❌ Monto inválido. Ingresa un número mayor a 0 (o "cancelar").' });
                return true;
            }
            session.amount = amount;
            session.step = 4;
            const confirmAction = session.type === 'remove' ? 'descuento' : 'recarga';
            const confirmName = `¿Confirmar ${confirmAction} de $${amount.toFixed(2)} a ${session.resellerName}?`;
            try {
                await sock.sendMessage(remoteJid, {
                    poll: {
                        name: confirmName,
                        values: ['✅ SÍ, PROCEDER', '❌ NO, CANCELAR'],
                        selectableCount: 1
                    }
                });
            } catch (pErr) {
                if (session.type === 'remove') {
                    await sock.sendMessage(remoteJid, { text: `⚠️ *CONFIRMACIÓN DE DESCUENTO* ⚠️\n\n👤 Revendedor: ${session.resellerName}\n🏢 Servidor: ${session.serverId}\n📉 Monto a descontar: $${amount.toFixed(2)} MXN\n\n¿Confirmas esta reducción de saldo? Responde *SI* para proceder o *NO* para cancelar.` });
                } else {
                    await sock.sendMessage(remoteJid, { text: `⚠️ *CONFIRMACIÓN DE RECARGA* ⚠️\n\n👤 Revendedor: ${session.resellerName}\n🏢 Servidor: ${session.serverId}\n💲 Monto a agregar: $${amount.toFixed(2)} MXN\n\n¿Confirmas esta recarga? Responde *SI* para proceder o *NO* para cancelar.` });
                }
            }
            return true;
        } else if (session.step === 4) {
            const ans = text.trim().toLowerCase();
            if (ans === 'si' || ans === 'sí' || ans.includes('sí, proceder') || ans.includes('proceder') || ans.includes('✅')) {
                try {
                    const { callBotApi } = require('../whatsappEngine');
                    let finalAmount = session.amount;
                    if (session.type === 'remove') {
                        finalAmount = -Math.abs(session.amount);
                    }
                    
                    let resData = null;
                    const addPayload = {
                        adminId: linkedUserId,
                        resellerId: session.resellerId,
                        serverId: session.serverId,
                        amount: finalAmount
                    };

                    try {
                        const res = await callBotApi('add_money', addPayload, 10000);
                        resData = res.data;
                    } catch (apiErr) {
                        console.warn('[ADMIN] External add_money failed, falling back to local botController:', apiErr.message);
                        const botController = require('../controllers/botController');
                        const mockReq = { body: { ...addPayload, botSecret: 'MEGA_BOT_SECRET_2026' } };
                        const mockRes = {
                            status: () => mockRes,
                            json: (data) => { resData = data; }
                        };
                        await botController.addMoney(mockReq, mockRes);
                    }
                    
                    if (resData && resData.error) {
                        await sock.sendMessage(remoteJid, { text: `❌ Error: ${resData.error}` });
                    } else if (resData && resData.newBalance !== undefined) {
                        await sock.sendMessage(remoteJid, { text: `✅ Operación exitosa.\nNuevo saldo de ${session.resellerName} en Servidor ${session.serverId}: $${parseFloat(resData.newBalance).toFixed(2)} MXN` });
                    } else {
                        await sock.sendMessage(remoteJid, { text: '⚠️ La operación se completó pero no se confirmó el balance. Verifica con /saldo.' });
                    }
                } catch (e) {
                    await sock.sendMessage(remoteJid, { text: '❌ Ocurrió un error al procesar el saldo: ' + e.message });
                }
            } else if (ans === 'no' || ans.includes('cancelar') || ans.includes('❌') || ans.includes('no, cancelar')) {
                delete sessionManager.addMoneySessions[remoteJid];
                await sock.sendMessage(remoteJid, { text: '🚫 Operación cancelada.' });
            } else {
                await sock.sendMessage(remoteJid, { text: '❌ Respuesta inválida. Pulsa una opción en la encuesta o responde *SI* o *NO*.' });
            }
            return true;
        }
    }

    if (['/sync', '/sincronizar'].includes(cmd)) {
        await sock.sendMessage(remoteJid, { text: '⏳ *Iniciando Sincronización Manual...*' });
        try {
            const axios = require('axios');
            const res = await axios.get('https://megaunlockphone-panel.alwaysdata.net/api/cron/sync');
            if (res.data && res.data.status === 'ok') {
                await sock.sendMessage(remoteJid, { text: '✅ *Sincronización completada.*\n\nSi había pedidos pendientes con respuesta, deberías recibir las notificaciones en un momento.' });
            } else {
                await sock.sendMessage(remoteJid, { text: '⚠️ Sincronización finalizada con advertencias.' });
            }
        } catch (e) {
            await sock.sendMessage(remoteJid, { text: '❌ Error al sincronizar: ' + e.message });
        }
        return true;
    }

    // Setprice, msgUser, msgGrup... can be added similarly if needed. For now just handle the most complex ones.
    
    // Helper function to extract and download media from msg if present
    const extractMediaPayload = async (rawCaption) => {
        let mediaBuffer = null;
        let isVideo = false;
        let isAudio = false;
        let isDoc = false;
        let fileName = 'archivo';

        if (hasMedia) {
            try {
                const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                mediaBuffer = await downloadMediaMessage(msg, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
                isVideo = Boolean(msg.message?.videoMessage);
                isAudio = Boolean(msg.message?.audioMessage);
                isDoc = Boolean(msg.message?.documentMessage);
                if (isDoc && msg.message?.documentMessage?.fileName) {
                    fileName = msg.message.documentMessage.fileName;
                }
            } catch (mediaErr) {
                console.error('[ADMIN MEDIA ERROR]', mediaErr);
                mediaBuffer = null;
            }
        }

        if (mediaBuffer) {
            if (isVideo) {
                return { video: mediaBuffer, caption: rawCaption };
            } else if (isAudio) {
                return { audio: mediaBuffer, mimetype: 'audio/mp4', ptt: false };
            } else if (isDoc) {
                return { document: mediaBuffer, fileName: fileName, caption: rawCaption };
            } else {
                return { image: mediaBuffer, caption: rawCaption };
            }
        }
        return { text: rawCaption };
    };

    // Helper to get all deduplicated client phone JIDs
    const getBroadcastRecipients = () => {
        const uniqueJids = new Set();
        // 1. WhatsApp linked numbers in wusers (keys are JIDs)
        for (const jid in wusers) {
            if (jid && !jid.endsWith('@g.us')) {
                uniqueJids.add(jid);
            }
        }
        // 2. Users from database with registered phone numbers
        const dbUsers = readDB(USERS_FILE) || [];
        dbUsers.forEach(u => {
            if (u.phone) {
                const digits = String(u.phone).replace(/\D/g, '');
                if (digits.length >= 10) {
                    uniqueJids.add(`${digits}@s.whatsapp.net`);
                }
            }
        });
        return Array.from(uniqueJids);
    };

    // --- SESSIONS HANDLERS ---
    if (sessionManager.msgUserSessions && sessionManager.msgUserSessions[remoteJid]) {
        const session = sessionManager.msgUserSessions[remoteJid];
        if (text.toLowerCase() === 'cancelar') {
            delete sessionManager.msgUserSessions[remoteJid];
            await sock.sendMessage(remoteJid, { text: '🚫 Operación cancelada.' });
            return true;
        }
        if (session.step === 1) {
            const inputStr = text.trim().toLowerCase();
            let selectedId = null;
            
            const inputNum = parseInt(inputStr);
            if (!isNaN(inputNum) && session.options && session.options[inputNum]) {
                selectedId = session.options[inputNum];
            } else if (['todos', 'all', 'global'].includes(inputStr)) {
                selectedId = 'todos';
            } else {
                const rawId = parseInt(inputStr);
                if (!isNaN(rawId)) {
                    selectedId = rawId;
                }
            }
            
            if (!selectedId) {
                await sock.sendMessage(remoteJid, { text: '❌ Opción o ID inválido. Ingresa el número de la lista, el ID del usuario o escribe "cancelar".' });
                return true;
            }
            
            session.targetUserId = selectedId;
            session.step = 2;
            
            if (selectedId === 'todos') {
                await sock.sendMessage(remoteJid, { 
                    text: `📢 *DIFUSIÓN GLOBAL SELECCIONADA*\n━━━━━━━━━━━━━━━━━━━━━━\nHas seleccionado enviar a *TODOS* los usuarios de la plataforma.\n\n📸 *Puedes enviar texto, foto o video*:\nEnvía ahora tu mensaje o adjunta tu multimedia con el pie de texto que deseas transmitir.\n\n_Escribe "cancelar" para detener._` 
                });
            } else {
                await sock.sendMessage(remoteJid, { 
                    text: `👤 *DESTINATARIO SELECCIONADO: ID ${selectedId}*\n━━━━━━━━━━━━━━━━━━━━━━\n📸 *Puedes enviar texto, foto o video*:\nEnvía tu mensaje o foto/video con texto para este usuario.\n\n_Escribe "cancelar" para detener._` 
                });
            }
            return true;
        } else if (session.step === 2) {
            const msgText = text.trim();
            const captionHeader = session.targetUserId === 'todos' 
                ? `📢 *COMUNICADO OFICIAL • MEGAUNLOCKPHONE* 🌐\n━━━━━━━━━━━━━━━━━━━━━━\n${msgText}\n━━━━━━━━━━━━━━━━━━━━━━\n🛡️ _Equipo de Administración MegaUnlock_`
                : `📩 *MENSAJE DIRECTO DEL ADMINISTRADOR* 📩\n━━━━━━━━━━━━━━━━━━━━━━\n${msgText}\n━━━━━━━━━━━━━━━━━━━━━━\n🛡️ _MegaUnlockPhone Cloud_`;
            
            const messagePayload = await extractMediaPayload(captionHeader);

            if (session.targetUserId === 'todos') {
                const recipients = getBroadcastRecipients();
                let sentCount = 0;
                await sock.sendMessage(remoteJid, { text: `🚀 *Iniciando transmisión masiva a ${recipients.length} destinatarios...*\n_Por favor espera unos momentos._` });
                
                for (const jid of recipients) {
                    try {
                        await sock.sendMessage(jid, messagePayload);
                        sentCount++;
                    } catch (sendErr) {
                        console.error(`[BROADCAST ERROR] Falló envío a ${jid}:`, sendErr.message);
                    }
                }
                await sock.sendMessage(remoteJid, { text: `✅ *DIFUSIÓN COMPLETADA*\n━━━━━━━━━━━━━━━━━━━━━━\nTransmisión entregada exitosamente a *${sentCount}* clientes.` });
            } else {
                let targetJid = null;
                for (const jid in wusers) {
                    if (wusers[jid] === session.targetUserId) {
                        targetJid = jid;
                        break;
                    }
                }
                if (!targetJid) {
                    const dbUsers = readDB(USERS_FILE) || [];
                    const foundUser = dbUsers.find(u => u.id === session.targetUserId);
                    if (foundUser && foundUser.phone) {
                        const cleanDigits = String(foundUser.phone).replace(/\D/g, '');
                        if (cleanDigits.length >= 10) targetJid = `${cleanDigits}@s.whatsapp.net`;
                    }
                }

                if (targetJid) {
                    await sock.sendMessage(targetJid, messagePayload);
                    await sock.sendMessage(remoteJid, { text: `✅ Mensaje enviado exitosamente al usuario ID ${session.targetUserId}.` });
                } else {
                    await sock.sendMessage(remoteJid, { text: `❌ No se encontró ningún teléfono o WhatsApp vinculado al usuario ID ${session.targetUserId}.` });
                }
            }
            delete sessionManager.msgUserSessions[remoteJid];
            return true;
        }
    }

    if (sessionManager.msgGrupSessions && sessionManager.msgGrupSessions[remoteJid]) {
        if (text.toLowerCase() === 'cancelar') {
            delete sessionManager.msgGrupSessions[remoteJid];
            await sock.sendMessage(remoteJid, { text: '🚫 Operación cancelada.' });
            return true;
        }
        const msgText = text.trim();
        const { wsettings } = context;
        const groupId = wsettings ? wsettings.adminGroupId : null;
        if (groupId) {
            const groupCaption = `📢 *ANUNCIO OFICIAL MEGAUNLOCK* 📢\n━━━━━━━━━━━━━━━━━━━━━━\n${msgText}\n━━━━━━━━━━━━━━━━━━━━━━\n⚡ _Información de Sistema_`;
            const messagePayload = await extractMediaPayload(groupCaption);

            await sock.sendMessage(groupId, messagePayload);
            await sock.sendMessage(remoteJid, { text: '✅ Anuncio multimedia transmitido exitosamente al grupo principal.' });
        } else {
            await sock.sendMessage(remoteJid, { text: '❌ No hay ningún grupo configurado. Usa /setgroup dentro del grupo deseado.' });
        }
        delete sessionManager.msgGrupSessions[remoteJid];
        return true;
    }

    // --- COMANDOS DIRECTOS: /msgall /broadcast /anuncio ---
    const msgAllTriggers = ['/msgall', '!msgall', 'msgall', '/broadcast', '!broadcast', 'broadcast', '/anuncio', '!anuncio'];
    if (msgAllTriggers.includes(cmd)) {
        let msgText = '';
        if (args.length > 1) {
            msgText = args.slice(1).join(' ').trim();
        }

        if (!msgText && !hasMedia) {
            if (!sessionManager.msgUserSessions) sessionManager.msgUserSessions = {};
            sessionManager.msgUserSessions[remoteJid] = { step: 2, targetUserId: 'todos' };
            await sock.sendMessage(remoteJid, {
                text: `📢 *TRANSMISIÓN GLOBAL (MSGALL)*\n━━━━━━━━━━━━━━━━━━━━━━\nEnvía a continuación el texto, foto o video que deseas transmitir a *TODOS* los clientes de la plataforma (o escribe "cancelar").`
            });
            return true;
        }

        const captionHeader = `📢 *COMUNICADO OFICIAL • MEGAUNLOCKPHONE* 🌐\n━━━━━━━━━━━━━━━━━━━━━━\n${msgText}\n━━━━━━━━━━━━━━━━━━━━━━\n🛡️ _Equipo de Administración MegaUnlock_`;
        const messagePayload = await extractMediaPayload(captionHeader);

        const recipients = getBroadcastRecipients();
        await sock.sendMessage(remoteJid, { text: `🚀 *Iniciando transmisión masiva a ${recipients.length} usuarios...*` });
        
        let sentCount = 0;
        for (const jid of recipients) {
            try {
                await sock.sendMessage(jid, messagePayload);
                sentCount++;
            } catch (err) {
                console.error(`[MSGALL FAIL] ${jid}:`, err.message);
            }
        }
        await sock.sendMessage(remoteJid, { text: `✅ *DIFUSIÓN COMPLETADA*\n━━━━━━━━━━━━━━━━━━━━━━\nSe ha transmitido el mensaje multimedia a *${sentCount}* usuarios registrados.` });
        return true;
    }

    // --- COMANDOS DIRECTOS: /msg /msguser ---
    const msgUserTriggers = ['/msg', '!msg', 'msg', '/msguser', '!msguser', 'msguser'];
    if (msgUserTriggers.includes(cmd)) {
        if (args.length < 2 && !hasMedia) {
            if (!sessionManager.msgUserSessions) sessionManager.msgUserSessions = {};
            
            const resellers = users.filter(u => u.role !== 'admin');
            let resText = `💬 *ENVIAR MENSAJE A USUARIOS*\n━━━━━━━━━━━━━━━━━━━━━━\nResponde con el número de opción o ID:\n\n`;
            
            const options = {};
            let counter = 1;
            
            resellers.slice(0, 10).forEach(r => {
                resText += `*${counter}.* 👤 ${r.username} (ID: ${r.id})\n`;
                options[counter] = r.id;
                counter++;
            });
            
            resText += `\n*${counter}.* 🌐 *TODOS LOS USUARIOS* (/msgall)\n`;
            options[counter] = 'todos';
            
            resText += `\n💡 _Tip: También puedes usar directo:_ \n*/msg <ID o Usuario> <Mensaje>*\n_o adjuntar foto/video con el comando en el pie de foto._`;

            sessionManager.msgUserSessions[remoteJid] = { step: 1, options };
            await sock.sendMessage(remoteJid, { text: resText });
            return true;
        }
        
        // Determinar ID objetivo
        const targetArg = args[1] ? args[1].toLowerCase() : '';
        let targetUserId = null;

        if (targetArg === 'todos' || targetArg === 'all') {
            // Desviar a msgall
            const restText = args.slice(2).join(' ').trim();
            const captionHeader = `📢 *COMUNICADO OFICIAL • MEGAUNLOCKPHONE* 🌐\n━━━━━━━━━━━━━━━━━━━━━━\n${restText}\n━━━━━━━━━━━━━━━━━━━━━━\n🛡️ _Equipo de Administración MegaUnlock_`;
            const messagePayload = await extractMediaPayload(captionHeader);
            const recipients = getBroadcastRecipients();
            await sock.sendMessage(remoteJid, { text: `🚀 Transmitiendo a ${recipients.length} usuarios...` });
            let sentCount = 0;
            for (const jid of recipients) {
                try {
                    await sock.sendMessage(jid, messagePayload);
                    sentCount++;
                } catch (e) {}
            }
            await sock.sendMessage(remoteJid, { text: `✅ Transmitido exitosamente a ${sentCount} usuarios.` });
            return true;
        }

        const parsedId = parseInt(targetArg);
        if (!isNaN(parsedId)) {
            targetUserId = parsedId;
        } else {
            // Buscar por username
            const foundByName = users.find(u => u.username && u.username.toLowerCase() === targetArg);
            if (foundByName) {
                targetUserId = foundByName.id;
            }
        }

        if (!targetUserId) {
            await sock.sendMessage(remoteJid, { text: '❌ No se reconoció el ID o nombre de usuario indicado. Ej: */msg 12 Hola buenas tardes*' });
            return true;
        }

        const msgText = args.slice(2).join(' ').trim();
        const captionHeader = `📩 *MENSAJE DIRECTO DEL ADMINISTRADOR* 📩\n━━━━━━━━━━━━━━━━━━━━━━\n${msgText}\n━━━━━━━━━━━━━━━━━━━━━━\n🛡️ _MegaUnlockPhone Cloud_`;
        const messagePayload = await extractMediaPayload(captionHeader);
        
        let targetJid = null;
        for (const jid in wusers) {
            if (wusers[jid] === targetUserId) {
                targetJid = jid;
                break;
            }
        }
        if (!targetJid) {
            const foundUser = users.find(u => u.id === targetUserId);
            if (foundUser && foundUser.phone) {
                const cleanDigits = String(foundUser.phone).replace(/\D/g, '');
                if (cleanDigits.length >= 10) targetJid = `${cleanDigits}@s.whatsapp.net`;
            }
        }
        
        if (targetJid) {
            await sock.sendMessage(targetJid, messagePayload);
            await sock.sendMessage(remoteJid, { text: `✅ Mensaje multimedia enviado exitosamente al usuario ID ${targetUserId}.` });
        } else {
            await sock.sendMessage(remoteJid, { text: `❌ No se encontró ningún WhatsApp vinculado al usuario ID ${targetUserId}.` });
        }
        return true;
    }

    // --- COMANDOS DIRECTOS: /msggrup ---
    if (['/msggrup', '!msggrup', 'msggrup'].includes(cmd)) {
        const { wsettings } = context;
        const groupId = wsettings ? wsettings.adminGroupId : null;

        if (!groupId) {
            await sock.sendMessage(remoteJid, { text: '❌ No hay ningún grupo configurado. Usa /setgroup dentro del grupo oficial.' });
            return true;
        }

        let msgText = args.slice(1).join(' ').trim();
        if (!msgText && !hasMedia) {
            if (!sessionManager.msgGrupSessions) sessionManager.msgGrupSessions = {};
            sessionManager.msgGrupSessions[remoteJid] = { step: 1 };
            await sock.sendMessage(remoteJid, { text: `📢 *ANUNCIO EN GRUPO*\n━━━━━━━━━━━━━━━━━━━━━━\nEnvía a continuación el texto, foto o video que deseas publicar en el grupo oficial (o escribe "cancelar").` });
            return true;
        }
        
        const groupCaption = `📢 *ANUNCIO OFICIAL MEGAUNLOCK* 📢\n━━━━━━━━━━━━━━━━━━━━━━\n${msgText}\n━━━━━━━━━━━━━━━━━━━━━━\n⚡ _Información de Sistema_`;
        const messagePayload = await extractMediaPayload(groupCaption);

        await sock.sendMessage(groupId, messagePayload);
        await sock.sendMessage(remoteJid, { text: '✅ Anuncio multimedia publicado exitosamente en el grupo principal.' });
        return true;
    }

    // --- COMANDO DE ENCUESTA MASIVA: /pollall ---
    const pollAllTriggers = ['/pollall', '!pollall', 'pollall', '/encuesta', '!encuesta'];
    if (pollAllTriggers.includes(cmd)) {
        // Formato esperado: /pollall ¿Pregunta? | Opcion 1 | Opcion 2 | Opcion 3
        const rawInput = args.slice(1).join(' ').trim();
        const parts = rawInput.split('|').map(p => p.trim()).filter(Boolean);

        if (parts.length < 3) {
            await sock.sendMessage(remoteJid, {
                text: `📊 *COMANDO DE ENCUESTA MASIVA* 📊\n━━━━━━━━━━━━━━━━━━━━━━\nPermite enviar una encuesta interactiva a *TODOS* los clientes registrados y al grupo oficial.\n\n👉 *Uso:* \n*/pollall ¿Pregunta principal? | Opción 1 | Opción 2 | Opción 3*\n\n💡 *Ejemplo:* \n*/pollall ¿Qué servidor prefieren para recargas? | Mega Server | Omega Server | Ambos*`
            });
            return true;
        }

        const question = parts[0];
        const options = parts.slice(1);

        if (options.length > 12) {
            await sock.sendMessage(remoteJid, { text: '❌ WhatsApp admite un máximo de 12 opciones por encuesta.' });
            return true;
        }

        const pollMessage = {
            poll: {
                name: `📢 [MegaUnlock Oficial] ${question}`,
                values: options,
                selectableCount: 1
            }
        };

        const recipients = getBroadcastRecipients();
        await sock.sendMessage(remoteJid, { text: `🚀 *Iniciando transmisión de encuesta a ${recipients.length} clientes...*` });

        let sentCount = 0;
        for (const jid of recipients) {
            try {
                await sock.sendMessage(jid, pollMessage);
                sentCount++;
            } catch (err) {
                console.error(`[POLLALL ERR] ${jid}:`, err.message);
            }
        }

        // También enviar al grupo principal si está configurado
        const { wsettings } = context;
        if (wsettings && wsettings.adminGroupId) {
            try {
                await sock.sendMessage(wsettings.adminGroupId, pollMessage);
            } catch (e) {}
        }

        await sock.sendMessage(remoteJid, {
            text: `✅ *ENCUESTA MASIVA TRANSMITIDA*\n━━━━━━━━━━━━━━━━━━━━━━\nEncuesta entregada a *${sentCount}* usuarios y al grupo oficial.`
        });
        return true;
    }

    if (['/ganancia', '!ganancia', 'ganancia', '/finanzas', '!finanzas', 'finanzas'].includes(cmd)) {
        const orderIdParam = args[0] ? args[0].replace(/\D/g, '') : null;
        const financeManager = require('../financeManager');

        if (orderIdParam) {
            const details = financeManager.getOrderFinanceDetails(orderIdParam);
            if (!details || (!details.order && details.ledgerEntries.length === 0)) {
                await sock.sendMessage(remoteJid, { text: `❌ No se encontró registro contable ni orden con ID #${orderIdParam}.` });
                return true;
            }

            const o = details.order || {};
            const sum = details.financialSummary || {};
            const charged = sum.hasLedgerRecord ? sum.totalCharged : parseFloat(o.costCharged || o.resellerCost || o.price || 0);
            const cost = sum.hasLedgerRecord ? sum.totalCost : parseFloat(o.realCost || 0);
            const gross = sum.hasLedgerRecord ? sum.totalGrossProfit : (charged - cost);
            const reinvest = sum.hasLedgerRecord ? sum.totalReinvest : (gross > 0 ? gross * 0.5 : 0);
            const net = sum.hasLedgerRecord ? sum.totalNetProfit : (gross > 0 ? gross * 0.5 : gross);
            const account = details.ledgerEntries.length > 0 ? details.ledgerEntries[0].account : 'Server';

            let rep = `📊 *DESGLOSE FINANCIERO DE ORDEN #${orderIdParam}* 📊\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━\n` +
                      `🔧 *Servicio:* ${o.serviceName || 'Servicio'}\n` +
                      `🏦 *Cuenta / Destino:* ${account}\n` +
                      `💵 *Monto Cobrado:* $${charged.toFixed(2)} MXN\n` +
                      `📉 *Costo Proveedor:* $${cost.toFixed(2)} MXN\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━\n` +
                      `📈 *Ganancia Bruta:* $${gross.toFixed(2)} MXN\n` +
                      `🔄 *Fondo Reinversión:* $${reinvest.toFixed(2)} MXN\n` +
                      `💰 *Tu Ganancia Real (Bolsillo):* $${net.toFixed(2)} MXN\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━\n` +
                      `_MegaUnlockPhone Financial Engine_`;
            await sock.sendMessage(remoteJid, { text: rep });
            return true;
        }

        // Resumen general si no dio ID
        const data = financeManager.getFinanceSummary();
        const s = data.summary;
        let rep = `📊 *RESUMEN GENERAL DE FINANZAS* 📊\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `💵 *Total Cobrado:* $${parseFloat(s.totalCharged).toFixed(2)} MXN\n` +
                  `📉 *Costo Servidores:* $${parseFloat(s.totalCost).toFixed(2)} MXN\n` +
                  `🔄 *Fondo de Reinversión:* $${parseFloat(s.totalReinvest).toFixed(2)} MXN\n` +
                  `💰 *Ganancia Real Neta:* $${parseFloat(s.totalNetProfit).toFixed(2)} MXN\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `🏦 *Balances por Cuenta:*\n`;
        
        data.accounts.forEach(acc => {
            rep += `• *${acc.account}:* $${parseFloat(acc.balance).toFixed(2)} MXN (Neta: +$${parseFloat(acc.netProfit).toFixed(2)})\n`;
        });
        rep += `\n💡 _Para consultar una orden específica escribe:_ */ganancia <ID_ORDEN>*`;
        await sock.sendMessage(remoteJid, { text: rep });
        return true;
    }
    
    return false;
}

async function processAddMoneyShortcut(remoteJid, isRemove, resellerIndexOrId, serverId, amount, users, sessionManager, sock) {
    const resellers = users.filter(u => u.role !== 'admin');
    let targetReseller = null;
    
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
    
    sessionManager.addMoneySessions[remoteJid] = {
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

module.exports = admin;
