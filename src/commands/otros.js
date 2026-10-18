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
        if (!args[1]) {
            context.sessionManager.ticketSessions[remoteJid] = { step: 1 };
            await sock.sendMessage(remoteJid, { text: '🧾 *Generador de Recibos*\n\nPor favor, ingresa el *ID de tu Orden* para generar el recibo (ej. 12345):' });
            return true;
        } else {
            const oId = args[1];
            context.sessionManager.ticketSessions[remoteJid] = { step: 1 };
            // Simulate that the user typed the order ID for step 1
            context.text = oId;
            // The ticket logic from whatsappBot handles session step 1 in the router or here
        }
    }

    if (context.sessionManager.ticketSessions[remoteJid]) {
        const session = context.sessionManager.ticketSessions[remoteJid];
        
        if (text.toLowerCase() === 'cancelar') {
            context.sessionManager.clearSession(remoteJid);
            await sock.sendMessage(remoteJid, { text: '🚫 Operación cancelada.' });
            return true;
        }

        if (session.step === 1) {
            const oId = text.trim();
            if (!oId) return true;
            session.orderId = oId;
            
            const history = readDB(path.join(DATA_DIR, 'history.json')) || [];
            const order = history.find(h => String(h.orderId) === String(oId) && h.userId === linkedUserId);
            if (!order) {
                await sock.sendMessage(remoteJid, { text: '❌ No se encontró esa orden en tu historial. Revisa el ID e intenta de nuevo (o escribe "cancelar").' });
                return true;
            }
            session.order = order;
            session.step = 2;
            await sock.sendMessage(remoteJid, { text: `✅ Orden #${order.orderId} encontrada (${order.serviceName}).\n\n¿Qué *precio a mostrar* quieres ponerle al recibo para tu cliente final? (ej. 250.00):` });
            return true;
        } else if (session.step === 2) {
            const clientPrice = parseFloat(text.trim());
            if (isNaN(clientPrice) || clientPrice < 0) {
                await sock.sendMessage(remoteJid, { text: '❌ Precio inválido. Ingresa un número válido (o "cancelar").' });
                return true;
            }
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
            const userName = (ticketUser && ticketUser.role === 'admin') ? 'Admin #1' : (ticketUser ? ticketUser.username : 'Socio');
            
            const configDb = readDB('ticket_configs.json') || {};
            const userConfig = configDb[linkedUserId] || {};
            
            let receipt = `🧾 *MEGAUNLOCKPHONE TICKET* 🧾\n━━━━━━━━━━━━━━━━━━━━━━\n\n🆔 *Orden:* #${o.orderId}\n👤 *Atendido por:* ${userName} (ID: ${linkedUserId})\n📅 *Fecha y Hora:* ${dateStr}\n📱 *IMEI/SN:* ${o.imei || 'N/A'}\n🔧 *Servicio:* ${o.serviceName}\n\n💲 *Total Pagado:* $${clientPrice.toFixed(2)}\n\n🔑 *Respuesta / Código:*\n${cleanStatus}\n\n🎉 *Estado:* Completado\n\n━━━━━━━━━━━━━━━━━━━━━━\n_¡Gracias por tu preferencia!_ 🌐\n\n`;
            
            if (userConfig.whatsapp) receipt += `📱 *WhatsApp:* ${userConfig.whatsapp}\n`;
            if (userConfig.facebook) receipt += `📘 *Facebook:* ${userConfig.facebook}\n`;
            
            receipt += `\n_Powered By MegaUnlockPhone_`;
            
            if (userConfig.logoExt) {
                const logoPath = path.join(__dirname, '../../data/logos', `${linkedUserId}${userConfig.logoExt}`);
                if (require('fs').existsSync(logoPath)) {
                    await sock.sendMessage(remoteJid, { image: { url: logoPath }, caption: receipt });
                } else {
                    await sock.sendMessage(remoteJid, { text: receipt });
                }
            } else {
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

    if (['/ayuda', '!ayuda', 'ayuda', '/comandos', '!comandos', 'comandos'].includes(cmd)) {
        let helpText = '🤖 *¡Hola! Soy MegaBOOT, tu asistente personal.*\n\n' +
        'Aquí tienes mis comandos útiles. ¡Puedes escribirlos con o sin barra (/), como te sea más cómodo!\n\n' +
        '🔎 *BÚSQUEDA DE SERVICIOS*\n' +
        '📱 *buscar* (o /bus) - Buscar servicios en catálogo\n' +
        '📱 *bus1 <modelo>* - Búsqueda rápida en Servidor 1\n\n' +
        '🛒 *COMPRAS Y PEDIDOS* (Chat Privado)\n' +
        '🛒 *pedir* (o /pedir) - Hacer un pedido interactivo\n' +
        '🛒 *pedir 1 <ID> <IMEI>* - Pedido express directo\n' +
        '🛍️ *pedidos* - Ver tus últimos pedidos\n\n' +
        '🔐 *MI CUENTA Y AJUSTES* (Chat Privado)\n' +
        '💳 *saldo* - Consultar tu saldo disponible\n' +
        '💸 *recargar* - Recargas automáticas 24/7\n' +
        '🧾 *ticket <ID>* - Generar recibo para tu cliente\n' +
        '👤 *perfil* - Ver datos de tu cuenta\n' +
        '🔕 *desactivar* (o silenciar) - Apagar avisos de WhatsApp\n' +
        '🔔 *activar* - Encender avisos de WhatsApp\n' +
        '🔌 *desvincular* - Desconectar tu cuenta\n' +
        '🎧 *soporte* - Contacto directo\n\n' +
        '_✨ Vinculación automática: Tu WhatsApp se conecta a tu cuenta sin necesidad de contraseñas si tu teléfono coincide._';
        
        if (user && user.role === 'admin') {
            helpText += '\n\n👑 *COMANDOS ADMIN:*\n' +
            '💰 */addmoney* - Agregar saldo\n' +
            '📉 */removemoney* - Quitar saldo\n' +
            '💬 */msguser* - Enviar mensaje privado a usuarios\n' +
            '🌐 */historial* - Ver 10 últimos pedidos globales\n' +
            '📢 */msggrup* - Anuncio en grupo';
        }
        
        await sock.sendMessage(remoteJid, { text: helpText });
        return true;
    }

    if (['/soporte', '!soporte', 'soporte'].includes(cmd)) {
        await sock.sendMessage(remoteJid, { text: '🎧 *Soporte Técnico*\n\nSi necesitas ayuda con un pedido o tienes dudas sobre un servicio, por favor contáctanos:\n\n💬 WhatsApp: https://wa.me/522216936720\n\nNuestro equipo te atenderá lo más pronto posible.' });
        return true;
    }

    return false;
}

module.exports = otros;
