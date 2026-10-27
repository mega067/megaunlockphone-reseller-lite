const path = require('path');
const { writeDB } = require('../db');
const DATA_DIR = path.join(__dirname, '../../data');
const WHATSAPP_USERS_FILE = path.join(DATA_DIR, 'whatsapp_users.json');
const WHATSAPP_SETTINGS_FILE = path.join(DATA_DIR, 'whatsapp_settings.json');

async function perfil(context) {
    const { sock, remoteJid, firstWord, msg, isGroup, wusers, wsettings } = context;
    const linkedUserId = context.linkedUserId != null ? context.linkedUserId : wusers[remoteJid];
    const cleanId = String(linkedUserId || '').replace(/\.0+$/, '');
    
    let user = null;
    if (cleanId) {
        try {
            const { readDB } = require('../db');
            const users = readDB(path.join(DATA_DIR, 'users.json')) || [];
            user = users.find(u => String(u.id).replace(/\.0+$/, '') === cleanId || String(u.id) === cleanId);
            if (!user) {
                const sqliteDb = require('../database');
                const row = sqliteDb.prepare("SELECT * FROM Users WHERE id = ? OR id = ?").get(cleanId, String(linkedUserId));
                if (row) user = row;
            }
        } catch (e) {}
    }

    const cmd = firstWord.toLowerCase();

    // Ver perfil
    if (['/perfil', '!perfil', 'perfil'].includes(cmd)) {
        if (user) {
            const role = user.role === 'admin' ? '👑 Administrador' : (user.role === 'reseller' ? '💼 Revendedor' : '👤 Usuario');
            const profileMsg = `👤 *PERFIL MEGAUNLOCK* 👤\n━━━━━━━━━━━━━━━━━━━━━━\n📛 *Usuario:* ${user.username}\n🛡️ *Rol:* ${role}\n#️⃣ *ID de Cuenta:* ${user.id}\n━━━━━━━━━━━━━━━━━━━━━━\n_Tu cuenta está conectada de forma segura._`;
            await sock.sendMessage(remoteJid, { text: profileMsg });
        } else {
            await sock.sendMessage(remoteJid, { text: '⚠️ Tu número no está vinculado a ninguna cuenta. Escribe *vincular* para conectarla.' });
        }
        return true;
    }

    // Silenciar notificaciones
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

    // Reactivar notificaciones
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

    // Desvincular cuenta
    if (['/desvincular', '!desvincular', 'desvincular'].includes(cmd)) {
        delete wusers[remoteJid];
        writeDB(WHATSAPP_USERS_FILE, wusers);
        await sock.sendMessage(remoteJid, { text: '🔌 *¡Desconectado!* Tu cuenta ha sido desvinculada de este WhatsApp. \n\n¡Te echaré de menos! 😢' });
        return true;
    }

    // Configurar grupo de administradores
    if (['!setgroup', '/setgroup'].includes(cmd)) {
        if (isGroup) {
            const senderJid = msg.key.participant || remoteJid;
            const linkedSenderId = wusers[senderJid];
            if (linkedSenderId) {
                const { readDB } = require('../db');
                const users = readDB(path.join(DATA_DIR, 'users.json')) || [];
                const groupUser = users.find(u => u.id === linkedSenderId);
                if (groupUser && groupUser.role === 'admin') {
                    wsettings.adminGroupId = remoteJid;
                    writeDB(WHATSAPP_SETTINGS_FILE, wsettings);
                    await sock.sendMessage(remoteJid, { text: '✅ Este grupo ha sido configurado como el Grupo de Administradores para recibir notificaciones.' });
                }
            }
        }
        return true;
    }

    return false;
}

module.exports = perfil;
