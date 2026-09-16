const buscar = require('./buscar');
const saldo = require('./saldo');
const recargar = require('./recargar');
const pedir = require('./pedir');
const otros = require('./otros');
const admin = require('./admin');
const sessionManager = require('../sessionManager');

async function handleCommand(context) {
    const { text, remoteJid } = context;

    // Check if the user wants to cancel the current session
    if (text.toLowerCase().trim() === 'cancelar') {
        const deleted = sessionManager.clearSession(remoteJid);
        if (deleted) {
            await context.sock.sendMessage(remoteJid, { text: '🚫 Acción cancelada exitosamente.' });
            return true;
        }
    }

    // Try routing to modules. They return true if they handled the message.
    if (await buscar(context)) return true;
    if (await recargar(context)) return true;
    if (await pedir(context)) return true;
    if (await admin(context)) return true;
    if (await otros(context)) return true;

    // Saldo doesn't return boolean in the current implementation, we check its command name manually
    const cmd = context.firstWord.toLowerCase();
    if (['/saldo', '!saldo', 'saldo'].includes(cmd)) {
        await saldo(context);
        return true;
    }

    return false;
}

module.exports = {
    handleCommand
};
