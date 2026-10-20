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
            try {
                await sock.sendMessage(remoteJid, {
                    poll: {
                        name: '🖥️ Selecciona el Servidor para tu recarga:',
                        values: ['1️⃣ MEGA SERVER', '3️⃣ OMEGA SERVER'],
                        selectableCount: 1
                    }
                });
            } catch (pErr) {
                let serverText = '🖥️ *Selecciona el servidor al que deseas agregar saldo*\nResponde con el número de la lista:\n\n1️⃣ Mega Server\n3️⃣ Omega Server';
                await sock.sendMessage(remoteJid, { text: serverText });
            }
            return true;
        } else if (session.step === 1.5) {
            const rawVal = text.trim().toLowerCase();
            let opt = null;
            if (rawVal === '3' || rawVal.includes('omega') || rawVal.includes('3️⃣')) {
                opt = 3;
            } else if (rawVal === '1' || /(^|\s|1️⃣)mega(\s|$|server)/i.test(rawVal) || rawVal.includes('1️⃣')) {
                opt = 1;
            }

            if (!opt) {
               await sock.sendMessage(remoteJid, { text: '❌ Opción inválida. Pulsa una opción en la encuesta o responde 1 para Mega Server o 3 para Omega Server.' });
               return true;
            }
            session.serverId = String(opt);
            
            // Dynamic bank fetching from the new engine
            await sock.sendMessage(remoteJid, { text: '🔄 Conectando con la bóveda del servidor para obtener bancos disponibles...' });
            
            try {
                const res = await axios.get(`https://megaunlockphone-panel.alwaysdata.net/api/fund/banks/${session.serverId}`, {
                    headers: { 
                        'Authorization': 'Bearer ' + linkedUserId,
                        'x-bot-secret': process.env.MEGA_BOT_SECRET || 'MEGA_BOT_SECRET_2026'
                    }
                });
                
                if (res.data && res.data.success && res.data.banks) {
                    const allBanks = res.data.banks;
                    
                    // Filter popular banks to avoid spamming WhatsApp with 97 banks
                    const popularBankCodes = ['40012', '40072', '40014', '40127', '40002', '40638', '90728', '40021', '40044', '40036', '40058', '90722'];
                    const popularBanks = allBanks.filter(b => popularBankCodes.includes(b.code));
                    
                    // If popular filter returns empty (shouldn't happen), use top 10
                    session.availableBanks = popularBanks.length > 0 ? popularBanks : allBanks.slice(0, 10);
                    
                    session.step = 2;
                    let bankText = '🏦 *Selecciona tu Banco de Origen*\nResponde con el número de la lista:\n\n';
                    session.availableBanks.forEach((b, index) => {
                        bankText += `${index + 1}️⃣ ${b.name}\n`;
                    });
                    
                    await sock.sendMessage(remoteJid, { text: bankText });
                } else {
                    delete sessionManager.autoFundSessions[remoteJid];
                    await sock.sendMessage(remoteJid, { text: '❌ Ocurrió un error al cargar los bancos del servidor. Intenta de nuevo más tarde.' });
                }
            } catch (e) {
                delete sessionManager.autoFundSessions[remoteJid];
                await sock.sendMessage(remoteJid, { text: '❌ Error de conexión al obtener bancos. Intenta de nuevo más tarde.' });
            }
            
            return true;
        } else if (session.step === 2) {
            const option = parseInt(text.trim());
            const selectedBank = session.availableBanks ? session.availableBanks[option - 1] : null;
            
            if (!selectedBank) {
                await sock.sendMessage(remoteJid, { text: '❌ Opción inválida. Responde con un número válido de la lista.' });
                return true;
            }

            session.userBankCode = selectedBank.code;
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
