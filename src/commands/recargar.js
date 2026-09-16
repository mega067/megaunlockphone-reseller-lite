const axios = require('axios');

async function recargar(context) {
    const { sock, msg, remoteJid, firstWord, text, sessionManager, wusers } = context;
    const linkedUserId = wusers[remoteJid];

    // Initialize command if it's the trigger
    if (['/recargar', '!recargar', 'recargar', '/addsaldo', '!addsaldo'].includes(firstWord.toLowerCase())) {
        sessionManager.autoFundSessions[remoteJid] = { step: 1 };
        await sock.sendMessage(remoteJid, { text: '💸 *Recarga Automática SPEI*\n\n¿Cuánto dinero deseas recargar a tu cuenta? (Mínimo $50 MXN)\n\n_Escribe solo el número, ej: 100_' });
        return true;
    }

    // Handle ongoing session
    if (sessionManager.autoFundSessions[remoteJid]) {
        const session = sessionManager.autoFundSessions[remoteJid];
        
        if (text.toLowerCase() === 'cancelar') {
            sessionManager.clearSession(remoteJid);
            await sock.sendMessage(remoteJid, { text: '🚫 Recarga cancelada exitosamente.' });
            return true;
        }

        if (session.step === 1) {
            const amount = parseFloat(text.trim());
            if (isNaN(amount) || amount <= 0) {
                await sock.sendMessage(remoteJid, { text: '❌ Por favor, ingresa un monto válido (o "cancelar").' });
                return true;
            }
            session.amount = amount;
            session.step = 1.5;
            let serverText = '🖥️ *Selecciona el servidor al que deseas agregar saldo*\nResponde con el número de la lista:\n\n1️⃣ Mega Server (Mínimo recomendado: $50)\n3️⃣ Omega Server (Mínimo recomendado: $100)';
            await sock.sendMessage(remoteJid, { text: serverText });
            return true;
        } else if (session.step === 1.5) {
            const opt = parseInt(text.trim());
            if (opt !== 1 && opt !== 3) {
               await sock.sendMessage(remoteJid, { text: '❌ Opción inválida. Responde 1 para Mega Server o 3 para Omega Server.' });
               return true;
            }
            session.serverId = String(opt);
            session.step = 2;
            let bankText = '🏦 *Selecciona tu Banco de Origen*\nResponde con el número de la lista:\n\n1️⃣ BBVA\n2️⃣ Banamex\n3️⃣ Banorte\n4️⃣ Santander\n5️⃣ Banco Azteca\n6️⃣ NU\n7️⃣ Spin/OXXO\n8️⃣ HSBC\n9️⃣ Scotiabank\n1️⃣0️⃣ Inbursa\n1️⃣1️⃣ Banregio\n1️⃣2️⃣ Mercado Pago\n1️⃣3️⃣ Klar';
            await sock.sendMessage(remoteJid, { text: bankText });
            return true;
        } else if (session.step === 2) {
            const option = parseInt(text.trim());
            let userBankCode = '99999';
            if (option === 1) userBankCode = '40012';
            else if (option === 2) userBankCode = '40002';
            else if (option === 3) userBankCode = '40072';
            else if (option === 4) userBankCode = '40014';
            else if (option === 5) userBankCode = '40127';
            else if (option === 6) userBankCode = '40638';
            else if (option === 7) userBankCode = '90706';
            else if (option === 8) userBankCode = '40021';
            else if (option === 9) userBankCode = '40044';
            else if (option === 10) userBankCode = '40036';
            else if (option === 11) userBankCode = '40058';
            else if (option === 12) userBankCode = '40659';
            else if (option === 13) userBankCode = '40655';
            
            if (userBankCode === '99999') {
                await sock.sendMessage(remoteJid, { text: '❌ Opción inválida. Responde con un número de la lista.' });
                return true;
            }

            session.userBankCode = userBankCode;
            session.step = 3;
            
            await sock.sendMessage(remoteJid, { text: '🔄 Buscando la mejor bóveda para tu depósito...' });
            
            try {
                const res = await axios.post('https://megaunlockphone-panel.alwaysdata.net/api/fund/route', {
                    amount: session.amount,
                    bankCode: session.userBankCode,
                    serverId: session.serverId,
                    botSecret: 'MEGA_BOT_SECRET_2026'
                }, { headers: { 'Authorization': 'Bearer ' + linkedUserId } });
                
                const routeInfo = res.data;

                if (routeInfo.error) {
                    delete sessionManager.autoFundSessions[remoteJid];
                    await sock.sendMessage(remoteJid, { text: `❌ ${routeInfo.error}` });
                    return true;
                }
                
                session.routeInfo = routeInfo;
                
                let depMsg = `✅ *Bóveda Asignada*\n\nPor favor realiza una *Transferencia SPEI* por exactamente *$${session.amount.toFixed(2)} MXN* a la siguiente cuenta:\n\n`;
                depMsg += `🏦 *Banco:* ${routeInfo.account.bankName}\n`;
                depMsg += `👤 *Nombre:* ${routeInfo.account.ownerName}\n`;
                depMsg += `💳 *CLABE:* ${routeInfo.account.clabe}\n\n`;
                depMsg += `⚠️ *IMPORTANTE:* LAS CUENTAS CAMBIAN CONTINUAMENTE, si transfieres a una cuenta anterior el saldo se puede perder. Por favor asegúrate de enviar exactamente a esta cuenta.\n\n`;
                depMsg += `_Una vez realizada la transferencia, responde a este mensaje con la *Clave de Rastreo* de Banxico o el folio SPEI para abonar tu saldo._`;
                
                await sock.sendMessage(remoteJid, { text: depMsg });
            } catch (e) {
                delete sessionManager.autoFundSessions[remoteJid];
                await sock.sendMessage(remoteJid, { text: '❌ Ocurrió un error al asignar bóveda. Intenta de nuevo más tarde.' });
            }
            return true;
        } else if (session.step === 3) {
            const trackingNumber = text.trim();
            if (!trackingNumber || trackingNumber.length < 5) {
                await sock.sendMessage(remoteJid, { text: '❌ Clave de rastreo muy corta. Intenta de nuevo.' });
                return true;
            }
            
            await sock.sendMessage(remoteJid, { text: '🔍 *Verificando transferencia en Banxico...* Esto puede tomar hasta 30 segundos.' });
            
            try {
                const res = await axios.post('https://megaunlockphone-panel.alwaysdata.net/api/fund/verify', {
                    amount: session.amount,
                    bankCode: session.userBankCode,
                    trackingNumber: trackingNumber,
                    accountId: session.routeInfo.account.id,
                    providerKey: session.routeInfo.account.providerKey,
                    serverId: session.serverId,
                    botSecret: 'MEGA_BOT_SECRET_2026'
                }, { headers: { 'Authorization': 'Bearer ' + linkedUserId } });
                
                await sock.sendMessage(remoteJid, { text: res.data.message });
                delete sessionManager.autoFundSessions[remoteJid];
            } catch (e) {
                const errText = e.response?.data?.error || 'Error de conexión. Intenta enviar tu clave de rastreo nuevamente en unos minutos.';
                await sock.sendMessage(remoteJid, { text: `❌ ${errText}` });
            }
            return true;
        }
    }
    
    return false;
}

module.exports = recargar;
