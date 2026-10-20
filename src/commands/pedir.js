const axios = require('axios');

async function pedir(context) {
    const { sock, msg, remoteJid, firstWord, args, text, sessionManager, wusers } = context;
    const linkedUserId = wusers[remoteJid];

    // Handle ongoing session
    if (sessionManager.orderSessions[remoteJid]) {
        if (!linkedUserId) {
            delete sessionManager.orderSessions[remoteJid];
            await sock.sendMessage(remoteJid, { text: '❌ Tu cuenta de WhatsApp no está vinculada. Por favor, inicia sesión usando /login [email] [contraseña]' });
            return true;
        }
        const session = sessionManager.orderSessions[remoteJid];
        
        if (text.toLowerCase() === 'cancelar') {
            sessionManager.clearSession(remoteJid);
            await sock.sendMessage(remoteJid, { text: '🚫 Acción cancelada exitosamente.' });
            return true;
        }
        
        if (session.step === 'select_server') {
            const rawInput = text.trim().toLowerCase();
            let sId = null;
            if (rawInput === 'omega' || rawInput === '3' || rawInput.includes('omega') || rawInput.includes('3️⃣')) {
                sId = '3';
            } else if (rawInput === 'mega' || rawInput === '1' || rawInput.includes('1️⃣') || /(^|\s|1️⃣)mega(\s|$|server)/i.test(rawInput)) {
                sId = '1';
            }

            if (!sId || !['1', '3'].includes(sId)) {
                await sock.sendMessage(remoteJid, { text: '❌ Servidor inválido. Pulsa una opción en la encuesta o responde *1* para Mega o *3* para Omega.' });
                return true;
            }
            session.serverId = sId;
            session.step = 1;
            const srvName = sId === '1' ? '1️⃣ MEGA SERVER' : (sId === '3' ? '3️⃣ OMEGA SERVER' : `Servidor ${sId}`);
            await sock.sendMessage(remoteJid, { text: `🛒 ¡Excelente! Vamos a hacer un pedido en *${srvName}*.\n\nPor favor, ingresa el *ID del servicio* que deseas comprar (o escribe "cancelar" para salir):` });
            return true;
        } else if (session.step === 1) {
            const serviceId = text.trim();
            if (!serviceId || isNaN(serviceId)) {
                await sock.sendMessage(remoteJid, { text: '❌ ID inválido. Por favor, ingresa solo el número del ID (o escribe "cancelar").' });
                return true;
            }
            await processPedirStep1(session, serviceId, remoteJid, linkedUserId, null, sock);
            return true;
        } else if (session.step === 'QUANTITY') {
            let qty = parseInt(text.trim());
            if (isNaN(qty) || qty < session.minQnt || qty > session.maxQnt) {
                await sock.sendMessage(remoteJid, { text: `❌ Cantidad inválida. Debe ser un número entre ${session.minQnt} y ${session.maxQnt}. Intenta de nuevo:` });
                return true;
            }
            session.qnt = qty;
            session.step = 'INPUT';
            const fallbackType = session.type === 'DATA' ? 'INFO' : session.type;
            const fieldName = session.customField || session.imeiName || session.custom.customname || fallbackType;
            await sock.sendMessage(remoteJid, { text: `✅ Cantidad registrada: ${qty} (Total: $${(session.price * qty).toFixed(2)} MXN)\n\nPor favor, ingresa el *${fieldName}* requerido para este servicio:` });
            return true;
        } else if (session.step === 'INPUT') {
            const inputVal = text.trim();
            
            // Advanced Validation Check
            if (session.custom) {
                if (session.custom.customlen && inputVal.length < parseInt(session.custom.customlen)) {
                    await sock.sendMessage(remoteJid, { text: `❌ Error: El texto debe tener al menos ${session.custom.customlen} caracteres. Ingresa el valor nuevamente:` });
                    return true;
                }
                if (session.custom.maxlength && inputVal.length > parseInt(session.custom.maxlength)) {
                    await sock.sendMessage(remoteJid, { text: `❌ Error: El texto no puede superar ${session.custom.maxlength} caracteres. Ingresa el valor nuevamente:` });
                    return true;
                }
                if (session.custom.regex) {
                    try {
                        const rx = new RegExp(session.custom.regex);
                        if (!rx.test(inputVal)) {
                            await sock.sendMessage(remoteJid, { text: `❌ Error: El formato es inválido (debe cumplir: ${session.custom.regex}). Ingresa el valor nuevamente:` });
                            return true;
                        }
                    } catch (e) {} // Ignore bad regex from server
                }
            }

            session.imei = inputVal;
            session.step = 'CONFIRM';
            
            const fallbackType = session.type === 'DATA' ? 'INFO' : session.type;
            const fieldName = session.customField || session.imeiName || session.custom.customname || fallbackType;
            const totalCost = session.price * session.qnt;
            
            let confMsg = `⚠️ *RESUMEN DE PEDIDO* ⚠️\n━━━━━━━━━━━━━━━━━━━━━━\n` +
                          `🔧 *Servicio:* ${session.serviceName}\n`;
            if (session.qntRequired) confMsg += `📦 *Cantidad:* ${session.qnt}\n`;
            confMsg += `📱 *${fieldName}:* ${session.imei}\n` +
                       `💲 *Total a descontar:* $${totalCost.toFixed(2)} MXN\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━\n` +
                       `¿Deseas confirmar la compra ahora?`;
            
            await sock.sendMessage(remoteJid, { text: confMsg });
            try {
                await sock.sendMessage(remoteJid, {
                    poll: {
                        name: '¿Confirmar pedido?',
                        values: ['✅ SÍ, PROCEDER', '❌ NO, CANCELAR'],
                        selectableCount: 1
                    }
                });
            } catch (pErr) {
                await sock.sendMessage(remoteJid, { text: 'Responde *SI* para confirmar o *NO* para cancelar.' });
            }
            return true;
        } else if (session.step === 'CONFIRM') {
            const ans = text.toLowerCase().trim();
            if (ans === 'si' || ans === 'sí' || ans.includes('sí, proceder') || ans.includes('proceder') || ans.includes('✅')) {
                await sock.sendMessage(remoteJid, { text: '⏳ Procesando pedido, por favor espera...' });
                try {
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
                    
                    const { callBotApi } = require('../whatsappEngine');
                    let orderRes = null;
                    try {
                        const res = await callBotApi('order', payload, 25000);
                        orderRes = res.data;
                    } catch (apiErr) {
                        console.warn('[PEDIR] External order call failed, attempting local orderController fallback:', apiErr.message);
                        const orderController = require('../controllers/orderController');
                        const mockReq = {
                            body: payload,
                            user: { id: linkedUserId },
                            headers: { 'x-server-id': session.serverId }
                        };
                        const mockRes = {
                            status: () => mockRes,
                            json: (data) => { orderRes = data; }
                        };
                        await orderController.processOrder(mockReq, mockRes);
                    }
                    
                    if (orderRes && (orderRes.error || orderRes.ERROR)) {
                        let errStr = orderRes.error || orderRes.ERROR;
                        if (typeof errStr === 'object') errStr = JSON.stringify(errStr);
                        await sock.sendMessage(remoteJid, { text: `❌ Error al procesar tu pedido:\n${errStr}` });
                    }
                } catch (e) {
                    let errText = e.response?.data?.error || e.message;
                    if (typeof errText === 'object') errText = JSON.stringify(errText);
                    await sock.sendMessage(remoteJid, { text: `❌ Fallo al procesar el pedido:\n${errText}` });
                }
                delete sessionManager.orderSessions[remoteJid];
            } else if (ans === 'no' || ans.includes('cancelar') || ans.includes('❌') || ans.includes('no, cancelar')) {
                delete sessionManager.orderSessions[remoteJid];
                await sock.sendMessage(remoteJid, { text: '🚫 Pedido cancelado.' });
            } else {
                await sock.sendMessage(remoteJid, { text: '❌ Respuesta inválida. Por favor pulsa una opción en la encuesta o responde *SI* o *NO*.' });
            }
            return true;
        }
    }

    // Trigger command parsing
    if (firstWord.match(/^[\/!]?pedir?([123megaomega]+)?$/i)) {
        if (!linkedUserId) {
            await sock.sendMessage(remoteJid, { text: '❌ Tu cuenta de WhatsApp no está vinculada. Por favor, inicia sesión usando /login [usuario] [contraseña]' });
            return true;
        }

        let sIdRaw = firstWord.match(/^[\/!]?pedir(mega|omega|1|2|3)?$/i);
        let sId = null;
        let serviceId = null;
        let dataValue = null;

        if (sIdRaw && sIdRaw[1]) {
            let raw = sIdRaw[1].toLowerCase();
            if (raw === 'mega') sId = '1';
            else if (raw === 'omega') sId = '3';
            else sId = raw;
            
            if (args[1]) serviceId = args[1];
            if (args.length > 2) dataValue = args.slice(2).join(' ');
        } else {
            const arg1 = args[1] ? args[1].toLowerCase() : null;
            if (arg1 === 'mega') sId = '1';
            else if (arg1 === 'omega') sId = '3';
            else if (['1', '2', '3'].includes(arg1)) sId = arg1;

            if (sId) {
                if (args[2]) serviceId = args[2];
                if (args.length > 3) dataValue = args.slice(3).join(' ');
            }
        }

        if (sId) {
            if (serviceId) {
                sessionManager.orderSessions[remoteJid] = { step: 1, serverId: sId };
                await processPedirStep1(sessionManager.orderSessions[remoteJid], serviceId, remoteJid, linkedUserId, dataValue, sock);
            } else {
                sessionManager.orderSessions[remoteJid] = { step: 1, serverId: sId };
                await sock.sendMessage(remoteJid, { text: `🛒 ¡Excelente! Vamos a hacer un pedido en el Servidor ${sId === '1' ? '1️⃣ MEGA SERVER' : (sId === '3' ? '3️⃣ OMEGA SERVER' : sId)}.\n\nPor favor, ingresa el *ID del servicio* que deseas comprar (o escribe "cancelar" para salir):` });
            }
        } else {
            sessionManager.orderSessions[remoteJid] = { step: 'select_server' };
            
            // Envío interactivo con Encuesta nativa de 1 solo toque (WhatsApp Poll)
            try {
                await sock.sendMessage(remoteJid, {
                    poll: {
                        name: '🛒 Selecciona el Servidor para tu pedido:',
                        values: ['1️⃣ MEGA SERVER', '3️⃣ OMEGA SERVER'],
                        selectableCount: 1
                    }
                });
            } catch (pollErr) {
                console.warn('[PEDIR POLL FAIL] Fallback a texto:', pollErr.message);
                let srvText = '🛍️ *SELECCIÓN DE SERVIDOR*\n━━━━━━━━━━━━━━━━━━━━━━\nResponde con el número o nombre del servidor:\n\n1️⃣ MEGA SERVER\n3️⃣ OMEGA SERVER\n\n_(O escribe "cancelar" para salir)_';
                await sock.sendMessage(remoteJid, { text: srvText });
            }
        }
        return true;
    }
    
    return false;
}

async function processPedirStep1(session, serviceId, remoteJid, linkedUserId, textValue, sock) {
    try {
        const { callBotApi } = require('../whatsappEngine');
        let sInfo = null;
        try {
            const res = await callBotApi('service_info', {
                userId: linkedUserId,
                serverId: session.serverId,
                serviceid: serviceId
            }, 8000);
            sInfo = res.data;
        } catch (apiErr) {
            console.warn('[PEDIR] External service_info failed, falling back to local controller:', apiErr.message);
            const botController = require('../controllers/botController');
            const mockReq = {
                body: { userId: linkedUserId, serverId: session.serverId, serviceid: serviceId },
                headers: { 'x-server-id': session.serverId }
            };
            const mockRes = {
                status: () => mockRes,
                json: (data) => { sInfo = data; }
            };
            await botController.getServiceInfo(mockReq, mockRes);
        }

        if (!sInfo || sInfo.error) {
            delete require('../sessionManager').orderSessions[remoteJid];
            await sock.sendMessage(remoteJid, { text: `❌ El servicio #${serviceId} no existe o no está disponible en este servidor.` });
            return;
        }

        session.serviceId = sInfo.id;
        session.serviceName = sInfo.name;
        session.price = parseFloat(sInfo.price) || 0;
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
                    await sock.sendMessage(remoteJid, { text: `✅ Servicio seleccionado:\n*${sInfo.name}*\n💰 Precio base: $${session.price.toFixed(2)} MXN\n\n❌ Cantidad inválida (recibido: ${textValue}). Debe ser un número entre ${session.minQnt} y ${session.maxQnt}.\nPor favor ingresa la cantidad:` });
                    return;
                }
                session.qnt = qty;
                session.step = 'INPUT';
                const fallbackType = session.type === 'DATA' ? 'INFO' : session.type;
                const fieldName = session.customField || session.imeiName || session.custom.customname || fallbackType;
                await sock.sendMessage(remoteJid, { text: `✅ Cantidad registrada: ${qty} (Total: $${(session.price * qty).toFixed(2)} MXN)\n\nPor favor, ingresa el *${fieldName}* requerido para este servicio:` });
            } else {
                session.step = 'QUANTITY';
                await sock.sendMessage(remoteJid, { text: `✅ Servicio seleccionado:\n*${sInfo.name}*\n💰 Precio base: $${session.price.toFixed(2)} MXN\n\nEste servicio requiere **CANTIDAD**.\nPor favor ingresa la cantidad (Mínimo: ${session.minQnt}, Máximo: ${session.maxQnt}):` });
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
                        await sock.sendMessage(remoteJid, { text: `✅ Servicio seleccionado:\n*${sInfo.name}*\n💰 Precio: $${session.price.toFixed(2)} MXN\n\n❌ Error: El texto debe tener al menos ${session.custom.customlen} caracteres.\nPor favor, ingresa el *${fieldName}* nuevamente:` });
                        return;
                    }
                    if (session.custom.maxlength && inputVal.length > parseInt(session.custom.maxlength)) {
                        session.step = 'INPUT';
                        await sock.sendMessage(remoteJid, { text: `✅ Servicio seleccionado:\n*${sInfo.name}*\n💰 Precio: $${session.price.toFixed(2)} MXN\n\n❌ Error: El texto no puede superar ${session.custom.maxlength} caracteres.\nPor favor, ingresa el *${fieldName}* nuevamente:` });
                        return;
                    }
                    if (session.custom.regex) {
                        try {
                            const rx = new RegExp(session.custom.regex);
                            if (!rx.test(inputVal)) {
                                session.step = 'INPUT';
                                await sock.sendMessage(remoteJid, { text: `✅ Servicio seleccionado:\n*${sInfo.name}*\n💰 Precio: $${session.price.toFixed(2)} MXN\n\n❌ Error: El formato es inválido (debe cumplir: ${session.custom.regex}).\nPor favor, ingresa el *${fieldName}* nuevamente:` });
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
                await sock.sendMessage(remoteJid, { text: `✅ Servicio seleccionado:\n*${sInfo.name}*\n💰 Precio: $${session.price.toFixed(2)} MXN\n\nPor favor, ingresa el *${fieldName}* requerido para este servicio:` });
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

module.exports = pedir;
