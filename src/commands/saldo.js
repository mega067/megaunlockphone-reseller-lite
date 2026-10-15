const axios = require('axios');
const path = require('path');
const { readDB } = require('../../src/db');
const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const serverNames = {
    '1': 'Mega Server',
    '2': 'Servidor 2',
    '3': 'Omega Server'
};

async function saldo(context) {
    const { sock, remoteJid, wusers } = context;
    const linkedUserId = wusers[remoteJid];
    const users = readDB(USERS_FILE) || [];
    const user = users.find(u => u.id === linkedUserId);

    if (user) {
        if (user.role === 'admin') {
            await sock.sendMessage(remoteJid, { text: '🔄 *Consultando las bóvedas en tiempo real...*' });
            
            let saldoText = `✨ *Bóvedas Administrativas*\n\n`;
            
            try {
                const { callBotApi } = require('../whatsappEngine');
                let bals = null;
                try {
                    const res = await callBotApi('saldo', { userId: linkedUserId }, 8000);
                    bals = res.data?.balances;
                } catch (apiErr) {
                    // Fallback directo a controlador local
                    const botController = require('../controllers/botController');
                    const mockReq = { body: { userId: linkedUserId, botSecret: 'MEGA_BOT_SECRET_2026' } };
                    const mockRes = {
                        status: () => mockRes,
                        json: (data) => { bals = data.balances; }
                    };
                    await botController.getSaldo(mockReq, mockRes);
                }
                
                if (bals) {
                    for (let sId of ['1', '2', '3']) {
                        const serverName = serverNames[sId] || `Servidor ${sId}`;
                        if (bals[sId] && bals[sId].error) {
                            saldoText += `🏢 *${serverName}:* ${bals[sId].error}\n\n`;
                        } else if (bals[sId]) {
                            saldoText += `🏢 *${serverName}*\n`;
                            saldoText += `🟢 REAL: $${(bals[sId].real || 0).toFixed(2)}\n`;
                            saldoText += `🟣 CEDIDO: $${(bals[sId].cedido || 0).toFixed(2)}\n`;
                            saldoText += `🔵 DISP: $${(bals[sId].disp || 0).toFixed(2)}\n\n`;
                        }
                    }
                    await sock.sendMessage(remoteJid, { text: saldoText.trim() });
                } else {
                    await sock.sendMessage(remoteJid, { text: '⚠️ No se pudieron obtener los balances en este momento. Intenta de nuevo en unos segundos.' });
                }
            } catch (e) {
                const errMsg = e.response ? `HTTP ${e.response.status}: ${JSON.stringify(e.response.data)}` : e.message;
                await sock.sendMessage(remoteJid, { text: `❌ Error al consultar bóvedas: ${errMsg}` });
            }
        } else {
            let saldoText = `✨ *¡Hola, ${user.username}!* Aquí tienes tu saldo actual:\n\n`;
            let hasCredits = false;
            
            if (user.credits_1 !== undefined) {
                saldoText += `🏢 *Mega Server (1):* $${parseFloat(user.credits_1).toFixed(2)}\n`;
                hasCredits = true;
            }
            if (user.credits_2 !== undefined) {
                saldoText += `🏢 *Servidor 2:* $${parseFloat(user.credits_2).toFixed(2)}\n`;
                hasCredits = true;
            }
            if (user.credits_3 !== undefined) {
                saldoText += `🏢 *Omega Server (3):* $${parseFloat(user.credits_3).toFixed(2)}\n`;
                hasCredits = true;
            }
            if (user.credit !== undefined && user.credit > 0) {
                saldoText += `💰 *Saldo General:* $${parseFloat(user.credit).toFixed(2)}\n`;
                hasCredits = true;
            }
            
            if (!hasCredits) {
                saldoText += `💸 *Saldo Total:* $0.00 MXN\n`;
            }
            saldoText += `━━━━━━━━━━━━━━━━━━━━━━\n🚀 _¡Listo para seguir desbloqueando!_`;
            
            await sock.sendMessage(remoteJid, { text: saldoText });
        }
    }
}

module.exports = saldo;
