const path = require('path');
const { readDB, writeDB } = require('../db');
const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

async function ticket(context) {
    const { sock, remoteJid, firstWord, text, args, wusers } = context;
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

    if (['/ticket', '!ticket', 'ticket'].includes(cmd)) {
        if (!linkedUserId) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Debes vincular tu cuenta primero para generar recibos. Escribe *vincular*.' });
            return true;
        }

        if (!args[1]) {
            context.sessionManager.ticketSessions[remoteJid] = { step: 'ask_order_id' };
            await sock.sendMessage(remoteJid, { text: '🧾 *Generador de Recibos de Cliente*\n━━━━━━━━━━━━━━━━━━━━━━\nPor favor, ingresa el *ID de la Orden* (ej. 12345):' });
            return true;
        } else {
            const oId = args[1].replace(/\D/g, '');
            context.sessionManager.ticketSessions[remoteJid] = { step: 'select_ticket_server', orderId: oId };
            
            try {
                await sock.sendMessage(remoteJid, {
                    poll: {
                        name: `🧾 ¿En qué servidor se procesó la Orden #${oId}?`,
                        values: ['1️⃣ MEGA SERVER', '3️⃣ OMEGA SERVER'],
                        selectableCount: 1
                    }
                });
            } catch (e) {
                await sock.sendMessage(remoteJid, {
                    text: `🧾 ¿En qué servidor se procesó la orden #${oId}?\n\n1️⃣ MEGA SERVER\n3️⃣ OMEGA SERVER\n\n_Responde 1 o 3:_`
                });
            }
            return true;
        }
    }

    if (context.sessionManager.ticketSessions[remoteJid]) {
        const session = context.sessionManager.ticketSessions[remoteJid];
        
        if (text.toLowerCase() === 'cancelar') {
            context.sessionManager.clearSession(remoteJid);
            await sock.sendMessage(remoteJid, { text: '🚫 Operación cancelada.' });
            return true;
        }

        if (session.step === 'ask_order_id') {
            const oId = text.trim().replace(/\D/g, '');
            if (!oId) {
                await sock.sendMessage(remoteJid, { text: '❌ Por favor ingresa solo los números del ID de la orden (o escribe "cancelar").' });
                return true;
            }
            session.orderId = oId;
            session.step = 'select_ticket_server';

            try {
                await sock.sendMessage(remoteJid, {
                    poll: {
                        name: `🧾 ¿En qué servidor se procesó la Orden #${oId}?`,
                        values: ['1️⃣ MEGA SERVER', '3️⃣ OMEGA SERVER'],
                        selectableCount: 1
                    }
                });
            } catch (e) {
                await sock.sendMessage(remoteJid, {
                    text: `🧾 ¿En qué servidor se procesó la orden #${oId}?\n\n1️⃣ MEGA SERVER\n3️⃣ OMEGA SERVER\n\n_Responde 1 o 3:_`
                });
            }
            return true;
        } else if (session.step === 'select_ticket_server') {
            const inputVal = text.trim().toLowerCase();
            let sId = null;
            if (inputVal === '3' || inputVal.includes('omega') || inputVal.includes('3️⃣')) {
                sId = '3';
            } else if (inputVal === '1' || /(^|\s|1️⃣)mega(\s|$|server)/i.test(inputVal) || inputVal.includes('1️⃣')) {
                sId = '1';
            } else {
                sId = '1'; // fallback
            }

            session.serverId = sId;
            session.step = 'fetching_order';

            await sock.sendMessage(remoteJid, { text: `🔍 Consultando Orden #${session.orderId} en Servidor ${sId === '1' ? 'Mega' : 'Omega'}...` });

            // 1. Buscar primero en historial local
            const history = readDB(path.join(DATA_DIR, 'history.json')) || [];
            let order = history.find(h => String(h.orderId) === String(session.orderId) && (h.userId === linkedUserId || user?.role === 'admin'));

            // 2. Si no está en historial local o falta respuesta, consultar la API del servidor
            if (!order || !order.statusText) {
                try {
                    const settingsDb = readDB(path.join(DATA_DIR, 'settings.json')) || {};
                    const { getServerSettings } = require('../helpers');
                    const serverConfig = getServerSettings(settingsDb, sId);

                    if (serverConfig && serverConfig.endpoint) {
                        const axios = require('axios');
                        const https = require('https');
                        const ipv4Agent = new https.Agent({ family: 4, keepAlive: true });
                        const targetUrl = serverConfig.endpoint.endsWith('/') ? serverConfig.endpoint + 'api/index.php' : serverConfig.endpoint + '/api/index.php';

                        const params = new URLSearchParams();
                        params.append('username', serverConfig.username);
                        params.append('apiaccesskey', serverConfig.apiaccesskey);
                        params.append('action', 'getimeiorder');
                        params.append('requestformat', 'JSON');
                        params.append('parameters', `<PARAMETERS><ID>${session.orderId}</ID></PARAMETERS>`);

                        const apiRes = await axios.post(targetUrl, params.toString(), {
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            timeout: 15000,
                            httpsAgent: ipv4Agent
                        });

                        const resData = apiRes.data?.SUCCESS ? apiRes.data.SUCCESS[0] : null;
                        if (resData) {
                            order = {
                                orderId: session.orderId,
                                serviceName: resData.SERVICENAME || resData.serviceName || `Servicio #${session.orderId}`,
                                imei: resData.IMEI || resData.SN || 'N/A',
                                statusText: resData.CODE || resData.REPLY || resData.STATUS || 'Completado',
                                status: resData.STATUS || 'success',
                                date: resData.DATETIME || new Date().toISOString(),
                                serverId: sId,
                                userId: linkedUserId
                            };
                        }
                    }
                } catch (liveErr) {
                    console.warn('[LIVE ORDER FETCH ERR]', liveErr.message);
                }
            }

            if (!order) {
                session.order = {
                    orderId: session.orderId,
                    serviceName: `Servicio #${session.orderId}`,
                    imei: 'N/A',
                    statusText: 'Procesado Exitosamente',
                    status: 'Completado',
                    date: new Date().toISOString(),
                    serverId: sId
                };
            } else {
                session.order = order;
            }

            // Detección automática de servicios gratuitos, checks o cotizaciones
            const sName = (session.order.serviceName || '').toLowerCase();
            const isLikelyCheck = sName.includes('check') || sName.includes('info') || sName.includes('status') || sName.includes('carrier') || sName.includes('icloud clean/lost') || sName.includes('blacklisted') || sName.includes('free') || sName.includes('gratis');

            session.step = 'ask_price';
            let askMsg = `✅ Orden #${session.order.orderId} lista (${session.order.serviceName}).\n\n`;
            if (isLikelyCheck) {
                askMsg += `ℹ️ _Detectamos que es un check / cotización informativa._\n`;
            }
            askMsg += `¿Qué *precio a mostrar* deseas que aparezca en el recibo para tu cliente? (ej. 250.00 o escribe *0* / *gratis* si fue sin costo):`;

            await sock.sendMessage(remoteJid, { text: askMsg });
            return true;
        } else if (session.step === 'ask_price') {
            const rawInput = text.trim().toLowerCase();
            const isZeroOrFree = rawInput === '0' || rawInput === 'gratis' || rawInput === 'free' || rawInput === 'cotizacion' || rawInput === 'check' || rawInput === 'no';
            const clientPrice = isZeroOrFree ? 0 : (parseFloat(text.trim()) || 0);
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
            
            const configDb = readDB('ticket_configs.json') || {};
            const userConfig = configDb[linkedUserId] || {};
            
            // Branding personalizado idéntico a la web
            const brandTitle = userConfig.nombre || (ticketUser && ticketUser.role === 'admin' ? 'MegaUnlockPhone' : (ticketUser ? ticketUser.username : 'MegaUnlockPhone'));
            const serverLabel = o.serverId === '3' ? 'OMEGA SERVER' : (o.serverId === '2' ? 'ALPHA SERVER' : 'MEGA SERVER');
            
            let receipt = `🧾 *${brandTitle.toUpperCase()}* 🧾\n` +
                          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                          `🆔 *ID de Orden:* #${o.orderId}\n` +
                          `📅 *Fecha:* ${dateStr}\n` +
                          `🏢 *Servidor:* ${serverLabel}\n` +
                          `🔧 *Servicio:* ${o.serviceName}\n`;
            if (o.imei) receipt += `📱 *IMEI / SN:* ${o.imei}\n`;
            if (clientPrice > 0) receipt += `💲 *Precio al Cliente:* $${clientPrice.toFixed(2)} MXN\n`;
            receipt += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                       `🔑 *DETALLES / RESPUESTA:*\n` +
                       `${cleanStatus}\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

            if (userConfig.whatsapp) receipt += `📱 *WhatsApp de Atención:* ${userConfig.whatsapp}\n`;
            if (userConfig.facebook) receipt += `📘 *Facebook:* ${userConfig.facebook}\n`;
            receipt += `👤 *Atendido por:* ${brandTitle} (ID: ${linkedUserId})\n` +
                       `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                       `✨ _¡Gracias por tu preferencia! Powered by MegaUnlockPhone_`;
            
            // Enviar ticket siempre como imagen con logotipo profesional (personalizado o logo oficial de fallback)
            let sentWithLogo = false;
            let logoPath = null;

            if (userConfig.logoExt) {
                const customLogo = path.join(__dirname, '../../data/logos', `${linkedUserId}${userConfig.logoExt}`);
                if (require('fs').existsSync(customLogo)) {
                    logoPath = customLogo;
                }
            }

            // Fallback al logo oficial del sistema si no ha subido logo personalizado
            if (!logoPath) {
                const defaultLogoCandidates = [
                    path.join(__dirname, '../../public/favicon-192.png'),
                    path.join(__dirname, '../../public/logo.png'),
                    path.join(__dirname, '../../public/favicon.png')
                ];
                for (const candidate of defaultLogoCandidates) {
                    if (require('fs').existsSync(candidate)) {
                        logoPath = candidate;
                        break;
                    }
                }
            }

            if (logoPath) {
                try {
                    const logoBuffer = require('fs').readFileSync(logoPath);
                    await sock.sendMessage(remoteJid, { image: logoBuffer, caption: receipt });
                    sentWithLogo = true;
                } catch (logoErr) {
                    console.error('[TICKET LOGO ERR]', logoErr.message);
                }
            }

            if (!sentWithLogo) {
                await sock.sendMessage(remoteJid, { text: receipt });
            }
            
            // Control de Ganancias y Punto de Venta (POS):
            // Exclusivo para el Administrador. A los usuarios/revendedores normales NO se les molesta
            // con encuestas contables ni selección de cuentas bancarias.
            const isAdminActor = Boolean(ticketUser && ticketUser.role === 'admin');

            if (isAdminActor && clientPrice > 0) {
                session.clientPrice = clientPrice;
                session.step = 'ask_finance_account';

                const financeManager = require('../financeManager');
                const liveAccounts = financeManager.getAllAccounts().map(a => a.name);
                const accounts = liveAccounts.length > 0 ? liveAccounts : ['Nu Débito / Cuenta', 'Revolut', 'Mercado Pago', 'BBVA', 'Efectivo / Caja'];

                try {
                    await sock.sendMessage(remoteJid, {
                        poll: {
                            name: `💳 ¿A qué cuenta ingresaron los $${clientPrice.toFixed(2)}?`,
                            values: accounts.slice(0, 5).map(a => `🏦 ${a}`),
                            selectableCount: 1
                        }
                    });
                } catch (pollErr) {
                    let accText = `💳 *Control Financiero Admin*\n━━━━━━━━━━━━━━━━━━━━━━\n¿A qué cuenta ingresaron los *$${clientPrice.toFixed(2)}* cobrados al cliente?\n\n`;
                    accounts.forEach((acc, idx) => {
                        accText += `${idx + 1}️⃣ ${acc}\n`;
                    });
                    accText += `\n_Responde con el número o nombre de la cuenta (ej. Nu, Revolut) o escribe "omitir":_`;
                    await sock.sendMessage(remoteJid, { text: accText });
                }
                return true;
            }

            delete context.sessionManager.ticketSessions[remoteJid];
            return true;
        } else if (session.step === 'ask_finance_account') {
            const financeManager = require('../financeManager');
            const liveAccounts = financeManager.getAllAccounts().map(a => a.name);
            const accounts = liveAccounts.length > 0 ? liveAccounts : ['Nu Débito / Cuenta', 'Revolut', 'Mercado Pago', 'BBVA', 'Efectivo / Caja'];

            const inputVal = text.trim();
            let selectedAccount = 'Nu Débito / Cuenta';

            if (inputVal.toLowerCase() !== 'omitir' && inputVal.toLowerCase() !== 'no') {
                const optNum = parseInt(inputVal);
                if (!isNaN(optNum) && optNum >= 1 && optNum <= accounts.length) {
                    selectedAccount = accounts[optNum - 1];
                } else {
                    const clean = inputVal.replace(/^🏦\s*/, '').trim();
                    const match = accounts.find(a => a.toLowerCase() === clean.toLowerCase() || clean.toLowerCase().includes(a.toLowerCase()));
                    selectedAccount = match || (clean.length > 0 ? clean : 'Nu Débito / Cuenta');
                }

                const o = session.order;
                const costAmount = parseFloat(o.costCharged || o.realCost || o.price || 0);
                const chargedAmount = session.clientPrice || 0;
                const buyerPhoneNum = remoteJid ? remoteJid.split('@')[0] : '';
                const phoneNote = buyerPhoneNum ? ` | WA: +${buyerPhoneNum}` : '';

                const recorded = financeManager.recordTransaction({
                    type: 'income_ticket',
                    orderId: o.orderId,
                    serviceName: o.serviceName,
                    chargedAmount: chargedAmount,
                    costAmount: costAmount,
                    account: selectedAccount,
                    notes: `Ticket #${o.orderId} - ${o.serviceName}${phoneNote}`
                });

                const totalToApartar = costAmount + (recorded.reinvestAmount || 0);

                let finMsg = `📊 *Registro Contable Guardado* 📊\n` +
                             `━━━━━━━━━━━━━━━━━━━━━━\n` +
                             `🏦 *Cobrado en:* ${selectedAccount} ($${chargedAmount.toFixed(2)} MXN)\n` +
                             `📉 *Costo del Servidor:* $${costAmount.toFixed(2)} MXN\n` +
                             `💰 *Ganancia Bruta:* $${recorded.grossProfit.toFixed(2)} MXN\n` +
                             `━━━━━━━━━━━━━━━━━━━━━━\n` +
                             `🔔 *ACCIÓN PENDIENTE:* \n` +
                             `📦 *Mueve a tu Cajita Nu:* 👉 *$${totalToApartar.toFixed(2)} MXN*\n` +
                             `   ↳ _$${costAmount.toFixed(2)} para no descapitalizar el servidor_\n` +
                             `   ↳ _$${recorded.reinvestAmount.toFixed(2)} de reinversión (${recorded.reinvestPercent}%)_\n` +
                             `💵 *Tu Ganancia Libre (Bolsillo):* $${recorded.netProfit.toFixed(2)} MXN\n` +
                             `━━━━━━━━━━━━━━━━━━━━━━\n` +
                             `⚠️ _Recuerda: No te gastes los $${totalToApartar.toFixed(2)}. Pásalos a tu Cajita Nu en la app bancaria para que tu servidor siempre tenga saldo._ 🚀`;
                await sock.sendMessage(remoteJid, { text: finMsg });
            }

            delete context.sessionManager.ticketSessions[remoteJid];
            return true;
        }
    }

    return false;
}

module.exports = ticket;
