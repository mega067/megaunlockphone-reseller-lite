const buscar = require('./buscar');
const saldo = require('./saldo');
const recargar = require('./recargar');
const pedir = require('./pedir');
const otros = require('./otros');
const admin = require('./admin');
const vincular = require('./vincular');
const finanzasBot = require('./finanzasBot');
const sessionManager = require('../sessionManager');

async function handleCommand(context) {
    const { text, remoteJid, isGroup } = context;

    // Check if the user wants to cancel the current session
    if (text.toLowerCase().trim() === 'cancelar') {
        const deleted = sessionManager.clearSession(remoteJid);
        if (deleted) {
            await context.sock.sendMessage(remoteJid, { text: '🚫 Acción cancelada exitosamente.' });
            return true;
        }
    }

    const cmd = context.firstWord.toLowerCase();

    // Bloquear comandos privados en grupos
    const privateCommands = ['/saldo', '!saldo', 'saldo', '/pedir', '!pedir', 'pedir', '/historial', '!historial', 'historial', '/recargar', '!recargar', 'recargar', '/vincular', '!vincular', 'vincular', '/pago', '!pago', 'pago', '/recibido', '!recibido', 'recibido', '/mesada', '!mesada', 'mesada', '/deudores', '!deudores', 'deudores', '/deudas', '!deudas', 'deudas', '/deudor', '!deudor', 'deudor', '/debo', '!debo', 'debo', '/abono', '!abono', 'abono'];
    if (isGroup && privateCommands.includes(cmd)) {
        await context.sock.sendMessage(remoteJid, { text: '🚫 *Comando Restringido*\n\nPor motivos de privacidad y seguridad, este comando solo puede utilizarse enviándome un mensaje por chat privado.' });
        return true;
    }

    // Try routing to modules. They return true if they handled the message.
    if (await finanzasBot(context)) return true;
    if (await buscar(context)) return true;
    if (await recargar(context)) return true;
    if (await pedir(context)) return true;
    if (await admin(context)) return true;
    if (await vincular(context)) return true;
    if (await otros(context)) return true;

    // Saldo doesn't return boolean in the current implementation, we check its command name manually
    if (['/saldo', '!saldo', 'saldo'].includes(cmd)) {
        await saldo(context);
        return true;
    }

    return false;
}

module.exports = {
    handleCommand
};
