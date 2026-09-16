const path = require('path');
const { readDB, writeDB } = require('../../src/db');
const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

async function admin(context) {
    const { sock, msg, remoteJid, firstWord, args, text, sessionManager, wusers, hasMedia } = context;
    const linkedUserId = wusers[remoteJid];
    const users = readDB(USERS_FILE) || [];
    const user = users.find(u => u.id === linkedUserId);

    if (!user || user.role !== 'admin') return false;

    const cmd = firstWord.toLowerCase();
    
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
            
            await sock.sendMessage(remoteJid, { text: `✅ Revendedor seleccionado: ${session.resellerName} (ID: ${session.resellerId})\n\nSelecciona el servidor:\n1️⃣ Mega Server\n2️⃣ Servidor 2\n3️⃣ Omega Server` });
            return true;
        } else if (session.step === 2) {
            const sId = text.trim();
            if (!['1', '2', '3'].includes(sId)) {
                await sock.sendMessage(remoteJid, { text: '❌ Servidor inválido. Responde 1, 2 o 3 (o escribe "cancelar").' });
                return true;
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
            if (session.type === 'remove') {
                await sock.sendMessage(remoteJid, { text: `⚠️ *CONFIRMACIÓN DE DESCUENTO* ⚠️\n\n👤 Revendedor: ${session.resellerName}\n🏢 Servidor: ${session.serverId}\n📉 Monto a descontar: $${amount.toFixed(2)} MXN\n\n¿Confirmas esta reducción de saldo? Responde *SI* para proceder.` });
            } else {
                await sock.sendMessage(remoteJid, { text: `⚠️ *CONFIRMACIÓN DE RECARGA* ⚠️\n\n👤 Revendedor: ${session.resellerName}\n🏢 Servidor: ${session.serverId}\n💲 Monto a agregar: $${amount.toFixed(2)} MXN\n\n¿Confirmas esta recarga? Responde *SI* para proceder.` });
            }
            return true;
        } else if (session.step === 4) {
            const ans = text.trim().toLowerCase();
            if (ans === 'si' || ans === 'sí') {
                try {
                    const axios = require('axios');
                    let finalAmount = session.amount;
                    if (session.type === 'remove') {
                        finalAmount = -Math.abs(session.amount);
                    }
                    const res = await axios.post('https://megaunlockphone-panel.alwaysdata.net/api/bot/add_money', {
                        adminId: linkedUserId,
                        resellerId: session.resellerId,
                        serverId: session.serverId,
                        amount: finalAmount,
                        botSecret: 'MEGA_BOT_SECRET_2026'
                    });
                    
                    if (res.data.error) {
                        await sock.sendMessage(remoteJid, { text: `❌ Error: ${res.data.error}` });
                    } else {
                        await sock.sendMessage(remoteJid, { text: `✅ Operación exitosa.\nNuevo saldo de ${session.resellerName} en Servidor ${session.serverId}: $${res.data.newBalance.toFixed(2)} MXN` });
                    }
                } catch (e) {
                    await sock.sendMessage(remoteJid, { text: '❌ Ocurrió un error al procesar el saldo. ' + e.message });
                }
                delete sessionManager.addMoneySessions[remoteJid];
            } else if (ans === 'no') {
                delete sessionManager.addMoneySessions[remoteJid];
                await sock.sendMessage(remoteJid, { text: '🚫 Operación cancelada.' });
            } else {
                await sock.sendMessage(remoteJid, { text: '❌ Responde *SI* para confirmar o *NO* para cancelar.' });
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
            } else if (inputStr === 'todos') {
                selectedId = 'todos';
            } else {
                const rawId = parseInt(inputStr);
                if (!isNaN(rawId)) {
                    selectedId = rawId;
                }
            }
            
            if (!selectedId) {
                await sock.sendMessage(remoteJid, { text: '❌ Opción o ID inválido. Por favor, ingresa el número de la lista, el ID del usuario o escribe "cancelar".' });
                return true;
            }
            
            session.targetUserId = selectedId;
            session.step = 2;
            
            if (selectedId === 'todos') {
                await sock.sendMessage(remoteJid, { text: '✅ Has seleccionado enviar a *TODOS* los usuarios.\n\nPor favor, escribe el *Mensaje* que deseas enviarles (o escribe "cancelar").' });
            } else {
                await sock.sendMessage(remoteJid, { text: `✅ Usuario ID ${selectedId} seleccionado.\n\nPor favor, escribe el *Mensaje* que deseas enviarle (o escribe "cancelar").` });
            }
            return true;
        } else if (session.step === 2) {
            const msgText = text.trim();
            const { downloadMediaMessage } = require('@whiskeysockets/baileys');
            let mediaBuffer = null;
            let messagePayload = { text: `📩 *MENSAJE DEL ADMINISTRADOR* 📩\n━━━━━━━━━━━━━━━━━━━━━━\n${msgText}\n━━━━━━━━━━━━━━━━━━━━━━\n🛡️ _MegaUnlockPhone_` };

            if (hasMedia) {
                try {
                    mediaBuffer = await downloadMediaMessage(msg, 'buffer', { }, { reuploadRequest: sock.updateMediaMessage });
                    const isVideo = Boolean(msg.message?.videoMessage);
                    messagePayload = {
                        [isVideo ? 'video' : 'image']: mediaBuffer,
                        caption: `📩 *MENSAJE DEL ADMINISTRADOR* 📩\n━━━━━━━━━━━━━━━━━━━━━━\n${msgText}\n━━━━━━━━━━━━━━━━━━━━━━\n🛡️ _MegaUnlockPhone_`
                    };
                } catch (e) {
                    await sock.sendMessage(remoteJid, { text: '❌ Error al descargar el archivo multimedia adjunto.' });
                    return true;
                }
            }

            if (session.targetUserId === 'todos') {
                let sentCount = 0;
                for (const jid in wusers) {
                    await sock.sendMessage(jid, messagePayload);
                    sentCount++;
                }
                await sock.sendMessage(remoteJid, { text: `✅ Mensaje enviado exitosamente a ${sentCount} usuarios.` });
            } else {
                let targetJid = null;
                for (const jid in wusers) {
                    if (wusers[jid] === session.targetUserId) {
                        targetJid = jid;
                        break;
                    }
                }
                if (targetJid) {
                    await sock.sendMessage(targetJid, messagePayload);
                    await sock.sendMessage(remoteJid, { text: `✅ Mensaje enviado exitosamente al usuario ID ${session.targetUserId}.` });
                } else {
                    await sock.sendMessage(remoteJid, { text: `❌ No se encontró ningún dispositivo de WhatsApp vinculado al usuario ID ${session.targetUserId}.` });
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
            const { downloadMediaMessage } = require('@whiskeysockets/baileys');
            let messagePayload = { text: `📢 *Anuncio Global:*\n\n${msgText}` };

            if (hasMedia) {
                try {
                    let mediaBuffer = await downloadMediaMessage(msg, 'buffer', { }, { reuploadRequest: sock.updateMediaMessage });
                    const isVideo = Boolean(msg.message?.videoMessage);
                    messagePayload = {
                        [isVideo ? 'video' : 'image']: mediaBuffer,
                        caption: `📢 *Anuncio Global:*\n\n${msgText}`
                    };
                } catch (e) {
                    await sock.sendMessage(remoteJid, { text: '❌ Error al descargar el archivo multimedia adjunto.' });
                    return true;
                }
            }

            await sock.sendMessage(groupId, messagePayload);
            await sock.sendMessage(remoteJid, { text: '✅ Anuncio enviado al grupo principal.' });
        } else {
            await sock.sendMessage(remoteJid, { text: '❌ No hay ningún grupo configurado. Usa /setgroup en un grupo para configurarlo.' });
        }
        delete sessionManager.msgGrupSessions[remoteJid];
        return true;
    }

        if (['/msguser', '!msguser', 'msguser'].includes(cmd)) {
        if (args.length < 3) {
            if (!sessionManager.msgUserSessions) sessionManager.msgUserSessions = {};
            
            const resellers = users.filter(u => u.role !== 'admin');
            let resText = `💬 *ENVIAR MENSAJE A USUARIO*\n\nResponde con el número de la opción o escribe el ID directamente:\n\n`;
            
            const options = {};
            let counter = 1;
            
            resellers.slice(0, 10).forEach(r => {
                resText += `${counter}️⃣ ${r.username} (ID: ${r.id})\n`;
                options[counter] = r.id;
                counter++;
            });
            
            // Adding 'Todos' option
            resText += `${counter}️⃣ 🌐 TODOS LOS USUARIOS\n`;
            options[counter] = 'todos';
            
            sessionManager.msgUserSessions[remoteJid] = { step: 1, options };
            
            await sock.sendMessage(remoteJid, { text: resText });
            return true;
        }
        
        const targetUserId = parseInt(args[1]);
        const msgText = args.slice(2).join(' ');
        
        let targetJid = null;
        for (const jid in wusers) {
            if (wusers[jid] === targetUserId) {
                targetJid = jid;
                break;
            }
        }
        
        if (targetJid) {
            await sock.sendMessage(targetJid, { text: `📢 *Mensaje del Administrador:*

${msgText}` });
            await sock.sendMessage(remoteJid, { text: `✅ Mensaje enviado exitosamente al usuario ID ${targetUserId}.` });
        } else {
            await sock.sendMessage(remoteJid, { text: `❌ No se encontró ningún dispositivo de WhatsApp vinculado al usuario ID ${targetUserId}.` });
        }
        return true;
    }

    if (['/msggrup', '!msggrup', 'msggrup'].includes(cmd)) {
        if (args.length < 2) {
            if (!sessionManager.msgGrupSessions) sessionManager.msgGrupSessions = {};
            sessionManager.msgGrupSessions[remoteJid] = { step: 1 };
            await sock.sendMessage(remoteJid, { text: `📢 *ANUNCIO EN GRUPO*\n\nPor favor, escribe el *Mensaje* que deseas enviar a todos en el grupo configurado (o escribe "cancelar").` });
            return true;
        }
        
        const msgText = args.slice(1).join(' ');
        const { wsettings } = context;
        const groupId = wsettings ? wsettings.adminGroupId : null;
        
        if (groupId) {
            await sock.sendMessage(groupId, { text: `📢 *Anuncio Global:*

${msgText}` });
            await sock.sendMessage(remoteJid, { text: '✅ Anuncio enviado al grupo principal.' });
        } else {
            await sock.sendMessage(remoteJid, { text: '❌ No hay ningún grupo configurado. Usa /setgroup en un grupo para configurarlo.' });
        }
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
