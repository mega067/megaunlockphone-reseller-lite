const path = require('path');
const { readDB, writeDB } = require('../../src/db');
const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const WHATSAPP_USERS_FILE = path.join(DATA_DIR, 'whatsapp_users.json');
const WHATSAPP_SETTINGS_FILE = path.join(DATA_DIR, 'whatsapp_settings.json');

async function otros(context) {
    const { sock, remoteJid, firstWord, text, args, msg, isGroup, wusers, wsettings } = context;
    const linkedUserId = wusers[remoteJid];
    const users = readDB(USERS_FILE) || [];
    const user = users.find(u => u.id === linkedUserId);

    const cmd = firstWord.toLowerCase();
    
    if (['/ticket', '!ticket', 'ticket'].includes(cmd)) {
        if (!linkedUserId) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Debes vincular tu cuenta primero para generar recibos. Escribe *vincular*.' });
            return true;
        }

        if (!args[1]) {
            context.sessionManager.ticketSessions[remoteJid] = { step: 'ask_order_id' };
            await sock.sendMessage(remoteJid, { text: '🧾 *Generador de Recibos de Cliente*\n━━━━━━━━━━━━━━━━━━━━━━\nPor favor, ingresa el *ID de la Orden* (ej. 12345):' });
            return true;
        } else {
            const oId = args[1].replace(/\D/g, '');
            context.sessionManager.ticketSessions[remoteJid] = { step: 'select_ticket_server', orderId: oId };
            
            try {
                await sock.sendMessage(remoteJid, {
                    poll: {
                        name: `🧾 ¿En qué servidor se procesó la Orden #${oId}?`,
                        values: ['1️⃣ MEGA SERVER', '3️⃣ OMEGA SERVER'],
                        selectableCount: 1
                    }
                });
            } catch (e) {
                await sock.sendMessage(remoteJid, {
                    text: `🧾 ¿En qué servidor se procesó la orden #${oId}?\n\n1️⃣ MEGA SERVER\n3️⃣ OMEGA SERVER\n\n_Responde 1 o 3:_`
                });
            }
            return true;
        }
    }

    if (context.sessionManager.ticketSessions[remoteJid]) {
        const session = context.sessionManager.ticketSessions[remoteJid];
        
        if (text.toLowerCase() === 'cancelar') {
            context.sessionManager.clearSession(remoteJid);
            await sock.sendMessage(remoteJid, { text: '🚫 Operación cancelada.' });
            return true;
        }

        if (session.step === 'ask_order_id') {
            const oId = text.trim().replace(/\D/g, '');
            if (!oId) {
                await sock.sendMessage(remoteJid, { text: '❌ Por favor ingresa solo los números del ID de la orden (o escribe "cancelar").' });
                return true;
            }
            session.orderId = oId;
            session.step = 'select_ticket_server';

            try {
                await sock.sendMessage(remoteJid, {
                    poll: {
                        name: `🧾 ¿En qué servidor se procesó la Orden #${oId}?`,
                        values: ['1️⃣ MEGA SERVER', '3️⃣ OMEGA SERVER'],
                        selectableCount: 1
                    }
                });
            } catch (e) {
                await sock.sendMessage(remoteJid, {
                    text: `🧾 ¿En qué servidor se procesó la orden #${oId}?\n\n1️⃣ MEGA SERVER\n3️⃣ OMEGA SERVER\n\n_Responde 1 o 3:_`
                });
            }
            return true;
        } else if (session.step === 'select_ticket_server') {
            const inputVal = text.trim().toLowerCase();
            let sId = null;
            if (inputVal === '3' || inputVal.includes('omega') || inputVal.includes('3️⃣')) {
                sId = '3';
            } else if (inputVal === '1' || /(^|\s|1️⃣)mega(\s|$|server)/i.test(inputVal) || inputVal.includes('1️⃣')) {
                sId = '1';
            } else {
                sId = '1'; // fallback
            }

            session.serverId = sId;
            session.step = 'fetching_order';

            await sock.sendMessage(remoteJid, { text: `🔍 Consultando Orden #${session.orderId} en Servidor ${sId === '1' ? 'Mega' : 'Omega'}...` });

            // 1. Buscar primero en historial local
            const history = readDB(path.join(DATA_DIR, 'history.json')) || [];
            let order = history.find(h => String(h.orderId) === String(session.orderId) && (h.userId === linkedUserId || user?.role === 'admin'));

            // 2. Si no está en historial local o falta respuesta, consultar la API del servidor
            if (!order || !order.statusText) {
                try {
                    const settingsDb = readDB(path.join(DATA_DIR, 'settings.json')) || {};
                    const { getServerSettings } = require('../helpers');
                    const serverConfig = getServerSettings(settingsDb, sId);

                    if (serverConfig && serverConfig.endpoint) {
                        const axios = require('axios');
                        const https = require('https');
                        const ipv4Agent = new https.Agent({ family: 4, keepAlive: true });
                        const targetUrl = serverConfig.endpoint.endsWith('/') ? serverConfig.endpoint + 'api/index.php' : serverConfig.endpoint + '/api/index.php';

                        const params = new URLSearchParams();
                        params.append('username', serverConfig.username);
                        params.append('apiaccesskey', serverConfig.apiaccesskey);
                        params.append('action', 'getimeiorder');
                        params.append('requestformat', 'JSON');
                        params.append('parameters', `<PARAMETERS><ID>${session.orderId}</ID></PARAMETERS>`);

                        const apiRes = await axios.post(targetUrl, params.toString(), {
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            timeout: 15000,
                            httpsAgent: ipv4Agent
                        });

                        const resData = apiRes.data?.SUCCESS ? apiRes.data.SUCCESS[0] : null;
                        if (resData) {
                            order = {
                                orderId: session.orderId,
                                serviceName: resData.SERVICENAME || resData.serviceName || `Servicio #${session.orderId}`,
                                imei: resData.IMEI || resData.SN || 'N/A',
                                statusText: resData.CODE || resData.REPLY || resData.STATUS || 'Completado',
                                status: resData.STATUS || 'success',
                                date: resData.DATETIME || new Date().toISOString(),
                                serverId: sId,
                                userId: linkedUserId
                            };
                        }
                    }
                } catch (liveErr) {
                    console.warn('[LIVE ORDER FETCH ERR]', liveErr.message);
                }
            }

            if (!order) {
                session.order = {
                    orderId: session.orderId,
                    serviceName: `Servicio #${session.orderId}`,
                    imei: 'N/A',
                    statusText: 'Procesado Exitosamente',
                    status: 'Completado',
                    date: new Date().toISOString(),
                    serverId: sId
                };
            } else {
                session.order = order;
            }

            session.step = 'ask_price';
            await sock.sendMessage(remoteJid, {
                text: `✅ Orden #${session.order.orderId} lista (${session.order.serviceName}).\n\n¿Qué *precio a mostrar* deseas que aparezca en el recibo para tu cliente? (ej. 250.00 o escribe 0 para no mostrar):`
            });
            return true;
        } else if (session.step === 'ask_price') {
            const clientPrice = parseFloat(text.trim()) || 0;
            const o = session.order;
            let cleanStatus = String(o.statusText || o.status || 'Completado').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
            let dateStr = 'N/A';
            if (o.date) {
                const parsedDate = new Date(o.date);
                if (!isNaN(parsedDate.getTime())) {
                    dateStr = parsedDate.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
                } else {
                    dateStr = String(o.date);
                }
            }
            
            const usersList = readDB(USERS_FILE) || [];
            const ticketUser = usersList.find(u => u.id === linkedUserId);
            
            const configDb = readDB('ticket_configs.json') || {};
            const userConfig = configDb[linkedUserId] || {};
            
            // Branding personalizado idéntico a la web
            const brandTitle = userConfig.nombre || (ticketUser && ticketUser.role === 'admin' ? 'MegaUnlockPhone' : (ticketUser ? ticketUser.username : 'MegaUnlockPhone'));
            const serverLabel = o.serverId === '3' ? 'OMEGA SERVER' : (o.serverId === '2' ? 'ALPHA SERVER' : 'MEGA SERVER');
            
            let receipt = `🧾 *${brandTitle.toUpperCase()}* 🧾\n` +
                          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                          `🆔 *ID de Orden:* #${o.orderId}\n` +
                          `📅 *Fecha:* ${dateStr}\n` +
                          `🏢 *Servidor:* ${serverLabel}\n` +
                          `🔧 *Servicio:* ${o.serviceName}\n`;
            if (o.imei) receipt += `📱 *IMEI / SN:* ${o.imei}\n`;
            if (clientPrice > 0) receipt += `💲 *Precio al Cliente:* $${clientPrice.toFixed(2)} MXN\n`;
            receipt += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                       `🔑 *DETALLES / RESPUESTA:*\n` +
                       `${cleanStatus}\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

            if (userConfig.whatsapp) receipt += `📱 *WhatsApp de Atención:* ${userConfig.whatsapp}\n`;
            if (userConfig.facebook) receipt += `📘 *Facebook:* ${userConfig.facebook}\n`;
            receipt += `👤 *Atendido por:* ${brandTitle} (ID: ${linkedUserId})\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                       `✨ _¡Gracias por tu preferencia! Powered by MegaUnlockPhone_`;
            
            // Si tiene logotipo subido desde la web o el bot, mandar como imagen con pie de foto
            let sentWithLogo = false;
            if (userConfig.logoExt) {
                const logoPath = path.join(__dirname, '../../data/logos', `${linkedUserId}${userConfig.logoExt}`);
                if (require('fs').existsSync(logoPath)) {
                    try {
                        const logoBuffer = require('fs').readFileSync(logoPath);
                        await sock.sendMessage(remoteJid, { image: logoBuffer, caption: receipt });
                        sentWithLogo = true;
                    } catch (logoErr) {
                        console.error('[TICKET LOGO ERR]', logoErr.message);
                    }
                }
            }
            if (!sentWithLogo) {
                await sock.sendMessage(remoteJid, { text: receipt });
            }
            
            delete context.sessionManager.ticketSessions[remoteJid];
            return true;
        }
    }
    
    // configticket routing
    const configticket = require('./configticket');
    if (context.sessionManager.configTicketSessions[remoteJid] || ['/configticket', '!configticket', 'configticket'].includes(cmd)) {
        const handled = await configticket(context);
        if (handled) return true;
    }

    if (['/ordenes', '!ordenes', 'ordenes', '/pedidos', '!pedidos', 'pedidos'].includes(cmd)) {
        const history = readDB(path.join(DATA_DIR, 'history.json')) || [];
        const myOrders = history.filter(h => h.userId === linkedUserId).slice(0, 5); 
        
        if (myOrders.length === 0) {
            await sock.sendMessage(remoteJid, { text: '👻 *¡Qué vacío!* No tienes pedidos recientes. ¡Anímate a hacer uno en el panel!' });
        } else {
            let resText = '📋 *TUS ÚLTIMOS PEDIDOS*\n━━━━━━━━━━━━━━━━━━━━━━\n';
            myOrders.forEach(o => {
                let emoji = o.status === 'success' ? '✅' : (o.status === 'rejected' ? '❌' : '⏳');
                let cleanStatus = String(o.statusText || o.status || 'N/A').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();
                if (cleanStatus.length > 50) cleanStatus = cleanStatus.substring(0, 47) + '...';
                const dateStr = o.date ? new Date(o.date).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) : 'N/A';
                resText += `📦 *${o.serviceName}*\n🆔 *Orden:* #${o.orderId}\n📱 *IMEI:* ${o.imei || 'N/A'}\n📅 *Fecha:* ${dateStr}\n${emoji} *Estado:* ${cleanStatus}\n━━━━━━━━━━━━━━━━━━━━━━\n`;
            });
            resText += `\n_Para ver detalles completos o tu historial antiguo, visita tu web._`;
            await sock.sendMessage(remoteJid, { text: resText });
        }
        return true;
    }

    if (['/historial', '!historial', 'historial'].includes(cmd)) {
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
        return true;
    }

    if (['/perfil', '!perfil', 'perfil'].includes(cmd)) {
        if (user) {
            const role = user.role === 'admin' ? '👑 Administrador' : (user.role === 'reseller' ? '💼 Revendedor' : '👤 Usuario');
            const profileMsg = `👤 *PERFIL MEGAUNLOCK* 👤\n━━━━━━━━━━━━━━━━━━━━━━\n📛 *Usuario:* ${user.username}\n🛡️ *Rol:* ${role}\n#️⃣ *ID de Cuenta:* ${user.id}\n━━━━━━━━━━━━━━━━━━━━━━\n_Tu cuenta está conectada de forma segura._`;
            await sock.sendMessage(remoteJid, { text: profileMsg });
        }
        return true;
    }

    // COMANDOS DE SILENCIAR / ACTIVAR NOTIFICACIONES (Sin exigir barra '/')
    const muteTriggers = ['/desactivar', '!desactivar', 'desactivar', '/silenciar', '!silenciar', 'silenciar', '/mutear', '!mutear', 'mutear', '/apagar', '!apagar', 'apagar'];
    if (muteTriggers.includes(cmd)) {
        if (!linkedUserId) {
            await sock.sendMessage(remoteJid, { text: '⚠️ No tienes una cuenta vinculada para gestionar notificaciones.' });
            return true;
        }

        wsettings.mutedUsers = wsettings.mutedUsers || {};
        wsettings.mutedUsers[linkedUserId] = true;
        writeDB(WHATSAPP_SETTINGS_FILE, wsettings);

        await sock.sendMessage(remoteJid, { 
            text: '🔕 *Notificaciones Desactivadas*\n━━━━━━━━━━━━━━━━━━━━━━\nYa no recibirás avisos automáticos de pedidos o recargas por este chat.\n\n💡 *¿Quieres volver a recibirlas?*\nEn cualquier momento solo escribe *activar* (o */activar*) y listo.' 
        });
        return true;
    }

    const unmuteTriggers = ['/activar', '!activar', 'activar', '/desmutear', '!desmutear', 'desmutear', '/encender', '!encender', 'encender'];
    if (unmuteTriggers.includes(cmd)) {
        if (!linkedUserId) {
            await sock.sendMessage(remoteJid, { text: '⚠️ No tienes una cuenta vinculada para gestionar notificaciones.' });
            return true;
        }

        wsettings.mutedUsers = wsettings.mutedUsers || {};
        delete wsettings.mutedUsers[linkedUserId];
        writeDB(WHATSAPP_SETTINGS_FILE, wsettings);

        await sock.sendMessage(remoteJid, { 
            text: '🔔 *Notificaciones Activadas*\n━━━━━━━━━━━━━━━━━━━━━━\n¡Listo! Recibirás avisos en tiempo real sobre el estado de tus pedidos, compras y recargas en tu WhatsApp.' 
        });
        return true;
    }

    if (['/desvincular', '!desvincular', 'desvincular'].includes(cmd)) {
        delete wusers[remoteJid];
        writeDB(WHATSAPP_USERS_FILE, wusers);
        await sock.sendMessage(remoteJid, { text: '🔌 *¡Desconectado!* Tu cuenta ha sido desvinculada de este WhatsApp. \n\n¡Te echaré de menos! 😢' });
        return true;
    }

    if (['!setgroup', '/setgroup'].includes(cmd)) {
        if (isGroup) {
            const senderJid = msg.key.participant || remoteJid;
            const linkedUserId = wusers[senderJid];
            if (linkedUserId) {
                const groupUser = users.find(u => u.id === linkedUserId);
                if (groupUser && groupUser.role === 'admin') {
                    wsettings.adminGroupId = remoteJid;
                    writeDB(WHATSAPP_SETTINGS_FILE, wsettings);
                    await sock.sendMessage(remoteJid, { text: '✅ Este grupo ha sido configurado como el Grupo de Administradores para recibir notificaciones.' });
                }
            }
        }
        return true;
    }

    if (['/info', '!info'].includes(cmd)) {
        await sock.sendMessage(remoteJid, { text: '🤖 *MegaUnlock Bot*\n\nSoy el asistente oficial del panel. Para consultar saldos y pedidos, envíame un mensaje privado directo para proteger tu privacidad.' });
        return true;
    }

    if (['/servicios', '!servicios'].includes(cmd)) {
        await sock.sendMessage(remoteJid, { text: '🚀 *Servicios MegaUnlock*\n\nOfrecemos desbloqueos, liberaciones y recargas al mejor precio. ¡Regístrate en nuestro panel web para ver el catálogo completo y hacer tus pedidos!' });
        return true;
    }

    if (['/ayuda', '!ayuda', 'ayuda', '/comandos', '!comandos', 'comandos', '/menu', '!menu', 'menu'].includes(cmd)) {
        let helpText = `⚡ *MEGAUNLOCK CLOUD BOT • MENÚ OFICIAL* ⚡\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `¡Hola! Soy tu asistente inteligente 24/7. Puedes escribir los comandos con o sin barra (*/*).\n\n` +
        `🔍 *BÚSQUEDA DE SERVICIOS*\n` +
        `• *buscar* (o /bus) ➔ Catálogo interactivo\n` +
        `• *bus1 <modelo>* ➔ Mega Server directo\n` +
        `• *bus3 <modelo>* ➔ Omega Server directo\n\n` +
        `🛒 *PEDIDOS & COMPRAS* (Privado)\n` +
        `• *pedir* ➔ Asistente guiado paso a paso\n` +
        `• *pedir 1 <ID> <IMEI>* ➔ Compra express Servidor 1\n` +
        `• *pedidos* ➔ Ver tus últimas 5 órdenes con estado\n\n` +
        `💳 *BILLETERA & FINANZAS* (Privado)\n` +
        `• *saldo* ➔ Consulta de créditos disponibles\n` +
        `• *recargar* ➔ Depósito automático SPEI 24/7\n` +
        `• *ticket <ID>* ➔ Genera recibo/factura para tu cliente\n\n` +
        `⚙️ *CONFIGURACIÓN & PRIVACIDAD*\n` +
        `• *perfil* ➔ Detalles y ID de tu cuenta\n` +
        `• *desactivar* (o silenciar) ➔ Pausar avisos en WhatsApp\n` +
        `• *activar* ➔ Reanudar notificaciones en tiempo real\n` +
        `• *soporte* ➔ Contacto directo con el equipo técnico\n` +
        `• *cancelar* ➔ Salir de cualquier proceso activo\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        
        if (user && user.role === 'admin') {
            helpText += `\n\n👑 *CONSOLA DE ADMINISTRADOR* 🛡️\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `• */msg <ID|Usuario> <Texto>* ➔ Mensaje a usuario (admite fotos/videos)\n` +
            `• */msgall <Texto>* ➔ Difusión masiva a TODOS los clientes (fotos/videos)\n` +
            `• */msggrup <Texto>* ➔ Anuncio al grupo oficial (fotos/videos)\n` +
            `• */addmoney <ID> <Servidor> <Monto>* ➔ Recargar saldo a revendedor\n` +
            `• */removemoney <ID> <Servidor> <Monto>* ➔ Descontar saldo\n` +
            `• */setprice* ➔ Modificador de márgenes y precios\n` +
            `• */historial* ➔ Últimos 10 pedidos globales\n` +
            `• */sync* ➔ Forzar sincronización de pedidos con proveedores\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        } else {
            helpText += `\n_💡 Tip: Puedes adjuntarme el comprobante o consultar tu IMEI directamente en cualquier momento._`;
        }
        
        await sock.sendMessage(remoteJid, { text: helpText });
        return true;
    }

    if (['/soporte', '!soporte', 'soporte', '/contacto', '!contacto', 'contacto'].includes(cmd)) {
        const vcard = 'BEGIN:VCARD\n' // metadata of the contact card
            + 'VERSION:3.0\n' 
            + 'FN:MegaUnlockPhone Soporte Oficial\n' 
            + 'ORG:MegaUnlockPhone Cloud;\n' 
            + 'TEL;type=CELL;type=VOICE;waid=522216936720:+52 221 693 6720\n' 
            + 'URL:https://megaunlockphone-panel.alwaysdata.net\n'
            + 'END:VCARD';

        await sock.sendMessage(remoteJid, {
            contacts: {
                displayName: 'MegaUnlockPhone Soporte Oficial',
                contacts: [{ vcard }]
            }
        });

        await sock.sendMessage(remoteJid, {
            text: `🎧 *CANALES DE ATENCIÓN & SOPORTE 24/7* 🌐\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `¡Estamos listos para apoyarte con tus servicios, activaciones y recargas!\n\n` +
                  `💬 *WhatsApp Directo:* https://wa.me/522216936720\n` +
                  `🌐 *Panel Web:* https://megaunlockphone-panel.alwaysdata.net\n` +
                  `📘 *Facebook:* https://www.facebook.com/share/1DjDKeofvo/\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `_Toca la tarjeta de contacto adjunta arriba para guardar nuestro número en tu agenda con un solo clic._`
        });
        return true;
    }

    return false;
}

module.exports = otros;
