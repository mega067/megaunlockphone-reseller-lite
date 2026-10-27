const path = require('path');
const { readDB } = require('../db');
const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

async function ayuda(context) {
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

    // Soporte y canales de contacto
    if (['/soporte', '!soporte', 'soporte', '/contacto', '!contacto', 'contacto'].includes(cmd)) {
        const vcard = 'BEGIN:VCARD\n'
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

    // Información básica del bot
    if (['/info', '!info'].includes(cmd)) {
        await sock.sendMessage(remoteJid, { text: '🤖 *MegaUnlock Bot*\n\nSoy el asistente oficial del panel. Para consultar saldos y pedidos, envíame un mensaje privado directo para proteger tu privacidad.' });
        return true;
    }

    // Información de servicios generales
    if (['/servicios', '!servicios'].includes(cmd)) {
        await sock.sendMessage(remoteJid, { text: '🚀 *Servicios MegaUnlock*\n\nOfrecemos desbloqueos, liberaciones y recargas al mejor precio. ¡Regístrate en nuestro panel web para ver el catálogo completo y hacer tus pedidos!' });
        return true;
    }

    // Menú principal de comandos
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
            `📨 *MENSAJERÍA & DIFUSIÓN (Directo o con Menú):*\n` +
            `• *msg* ➔ Abre el menú guiado con lista de tus clientes para elegir a quién escribir\n` +
            `• *msg <ID|Usuario> <Texto>* ➔ Envía mensaje directo (o adjunta foto/video con este texto)\n` +
            `• *msgall* ➔ Abre asistente para redactar difusión general a toda tu clientela\n` +
            `• *msgall <Texto>* ➔ Envía comunicado masivo a TODOS los clientes registrados\n` +
            `• *msggrup <Texto>* ➔ Publica anuncio oficial en el grupo de WhatsApp\n\n` +
            `💰 *SALDOS & CRÉDITOS:*\n` +
            `• */addmoney <ID> <Servidor 1|2|3> <Monto>* ➔ Recargar saldo a revendedor\n` +
            `• */setprice* ➔ Modificador de márgenes y precios\n\n` +
            `📊 *FINANZAS & GASTOS:*\n` +
            `• */pago <Monto> [Concepto]* ➔ Registrar gasto (comida, pasaje, etc.)\n` +
            `• */recibido <Monto> [Concepto]* ➔ Registrar dinero recibido en efectivo o banco\n` +
            `• */mesada <Monto>* ➔ Registrar apoyo de pasaje o comida uni\n` +
            `• */deudores* ➔ Ver quién te debe y a quién le debes\n` +
            `• */deudor <Nombre> <Monto>* ➔ Registrar persona que te debe dinero\n` +
            `• */debo <Nombre> <Monto>* ➔ Registrar dinero que debes pagar\n` +
            `• */abono <Nombre> <Monto>* ➔ Registrar abono o liquidación de deuda\n` +
            `• */finanzas* (o */ganancias*) ➔ Resumen contable de patrimonio\n\n` +
            `🔄 *SISTEMA & PEDIDOS:*\n` +
            `• */historial* ➔ Ver últimas órdenes globales de todos los clientes\n` +
            `• */sync* ➔ Forzar sincronización de pedidos con servidores proveedores\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        } else {
            helpText += `\n_💡 Tip: Puedes adjuntarme el comprobante o consultar tu IMEI directamente en cualquier momento._`;
        }
        
        await sock.sendMessage(remoteJid, { text: helpText });
        return true;
    }

    return false;
}

module.exports = ayuda;
