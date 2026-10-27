/**
 * Módulo Orquestador de Comandos Secundarios y de Soporte
 * Modularizado limpiamente delegando en sus respectivos submódulos:
 * - ticket.js        -> Recibos y registro contable de venta POS
 * - configticket.js  -> Configuración de marca y logo de tickets
 * - pedidos.js       -> Consulta de órdenes recientes e historial
 * - perfil.js        -> Perfil, activar/silenciar avisos, desvincular y grupo admin
 * - finanzasBot.js   -> Resumen patrimonial (/finanzas)
 * - ayuda.js         -> Menú interactivo, soporte con vCard e info
 */

const ticket = require('./ticket');
const configticket = require('./configticket');
const pedidos = require('./pedidos');
const perfil = require('./perfil');
const ayuda = require('./ayuda');

async function otros(context) {
    const { sock, remoteJid, firstWord, text, args, wusers } = context;
    const cmd = firstWord.toLowerCase();

    // 1. Manejo del generador de tickets y recibos
    if (context.sessionManager?.ticketSessions?.[remoteJid] || ['/ticket', '!ticket', 'ticket'].includes(cmd)) {
        if (await ticket(context)) return true;
    }

    // 2. Configuración de datos del ticket / logo
    if (context.sessionManager?.configTicketSessions?.[remoteJid] || ['/configticket', '!configticket', 'configticket'].includes(cmd)) {
        if (await configticket(context)) return true;
    }

    // 3. Consulta de pedidos del usuario o historial global
    if (['/ordenes', '!ordenes', 'ordenes', '/pedidos', '!pedidos', 'pedidos', '/historial', '!historial', 'historial'].includes(cmd)) {
        if (await pedidos(context)) return true;
    }

    // 4. Gestión de perfil, notificaciones, desvinculación y setgroup
    const perfilTriggers = [
        '/perfil', '!perfil', 'perfil',
        '/desactivar', '!desactivar', 'desactivar', '/silenciar', '!silenciar', 'silenciar', '/mutear', '!mutear', 'mutear', '/apagar', '!apagar', 'apagar',
        '/activar', '!activar', 'activar', '/desmutear', '!desmutear', 'desmutear', '/encender', '!encender', 'encender',
        '/desvincular', '!desvincular', 'desvincular',
        '!setgroup', '/setgroup'
    ];
    if (perfilTriggers.includes(cmd)) {
        if (await perfil(context)) return true;
    }

    // 5. Ayuda, menú de comandos, soporte vCard e información
    const ayudaTriggers = [
        '/ayuda', '!ayuda', 'ayuda', '/comandos', '!comandos', 'comandos', '/menu', '!menu', 'menu',
        '/soporte', '!soporte', 'soporte', '/contacto', '!contacto', 'contacto',
        '/info', '!info', '/servicios', '!servicios'
    ];
    if (ayudaTriggers.includes(cmd)) {
        if (await ayuda(context)) return true;
    }

    // 6. Resumen de finanzas / ganancias (Admin)
    if (['/finanzas', '!finanzas', 'finanzas', '/ganancias', '!ganancias', 'ganancias'].includes(cmd)) {
        const linkedUserId = context.linkedUserId != null ? context.linkedUserId : wusers[remoteJid];
        const cleanId = String(linkedUserId || '').replace(/\.0+$/, '');
        const { readDB } = require('../db');
        const path = require('path');
        const users = readDB(path.join(__dirname, '../../data/users.json')) || [];
        let user = users.find(u => String(u.id).replace(/\.0+$/, '') === cleanId || String(u.id) === cleanId);

        if (!user && linkedUserId) {
            try {
                const sqliteDb = require('../database');
                const row = sqliteDb.prepare("SELECT * FROM Users WHERE id = ? OR id = ?").get(cleanId, String(linkedUserId));
                if (row) user = row;
            } catch (e) {}
        }

        if (!user || user.role !== 'admin') {
            await sock.sendMessage(remoteJid, { text: '🔒 Este comando es exclusivo para el Administrador del sistema.' });
            return true;
        }

        try {
            const financeManager = require('../financeManager');
            const summary = financeManager.getFinanceSummary();
            const accounts = summary.accounts || [];

            let finReport = `📊 *RESUMEN EJECUTIVO DE FINANZAS* 📊\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `💵 *Cobrado Global:* $${summary.summary.totalCharged.toFixed(2)} MXN\n` +
                            `📉 *Costo Servidores:* -$${summary.summary.totalCost.toFixed(2)} MXN\n` +
                            `🔄 *Fondo Reinversión:* $${summary.summary.totalReinvest.toFixed(2)} MXN\n` +
                            `🤑 *Tu Ganancia Real:* +$${summary.summary.totalNetProfit.toFixed(2)} MXN\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `🏦 *BALANCES POR BANCO & TARJETA:*\n`;

            let totalPatrimonio = 0;
            accounts.forEach(acc => {
                const bal = parseFloat(acc.currentBalance || acc.balance || 0);
                totalPatrimonio += bal;
                finReport += `• *${acc.name || acc.account}:* $${bal.toFixed(2)} MXN\n`;
            });

            finReport += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                         `💎 *Patrimonio Total:* $${totalPatrimonio.toFixed(2)} MXN\n\n` +
                         `🌐 *Acceso al Panel Web:* \nhttps://megaunlockphone-panel.alwaysdata.net\n` +
                         `_Inicia sesión y pulsa el botón verde *Finanzas* en la barra superior._`;

            await sock.sendMessage(remoteJid, { text: finReport });
        } catch(err) {
            await sock.sendMessage(remoteJid, { text: `❌ Error al consultar finanzas: ${err.message}` });
        }
        return true;
    }

    return false;
}

module.exports = otros;
