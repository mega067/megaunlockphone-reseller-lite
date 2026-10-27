const path = require('path');
const { readDB } = require('../db');
const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

async function pedidos(context) {
    const { sock, remoteJid, firstWord, wusers } = context;
    const linkedUserId = context.linkedUserId != null ? context.linkedUserId : wusers[remoteJid];
    const users = readDB(USERS_FILE) || [];
    const cleanId = String(linkedUserId || '').replace(/\.0+$/, '');
    let user = users.find(u => String(u.id).replace(/\.0+$/, '') === cleanId || (cleanId && String(u.id) === cleanId));

    if (!user && linkedUserId) {
        try {
            const sqliteDb = require('../database');
            const row = sqliteDb.prepare("SELECT * FROM Users WHERE id = ? OR id = ?").get(cleanId, String(linkedUserId));
            if (row) user = row;
        } catch (e) {}
    }

    const cmd = firstWord.toLowerCase();

    // Ver pedidos personales del usuario
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

    // Ver historial global (solo Admin)
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

    return false;
}

module.exports = pedidos;
