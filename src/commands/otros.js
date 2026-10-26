const path = require('path');
const { readDB, writeDB } = require('../../src/db');
const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const WHATSAPP_USERS_FILE = path.join(DATA_DIR, 'whatsapp_users.json');
const WHATSAPP_SETTINGS_FILE = path.join(DATA_DIR, 'whatsapp_settings.json');

async function otros(context) {
    const { sock, remoteJid, firstWord, text, args, msg, isGroup, wusers, wsettings } = context;
    const linkedUserId = context.linkedUserId != null ? context.linkedUserId : wusers[remoteJid];
    const users = readDB(USERS_FILE) || [];
    const cleanId = String(linkedUserId || '').replace(/\.0+$/, '');
    let user = users.find(u => String(u.id).replace(/\.0+$/, '') === cleanId || (cleanId && String(u.id) === cleanId));

    if (!user && linkedUserId) {
        try {
            const sqliteDb = require('../../src/database');
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
                             `🏦 *Cuenta de Destino:* ${selectedAccount}\n` +
                             `💲 *Cobrado al Cliente:* $${chargedAmount.toFixed(2)} MXN\n` +
                             `📉 *Costo del Servidor:* $${costAmount.toFixed(2)} MXN\n` +
                             `💰 *Ganancia Bruta:* $${recorded.grossProfit.toFixed(2)} MXN\n` +
                             `━━━━━━━━━━━━━━━━━━━━━━\n` +
                             `📦 *Apartar en Cajita Nu:* $${totalToApartar.toFixed(2)} MXN\n` +
                             `   ↳ _Recuperar inversión Servidor: $${costAmount.toFixed(2)}_\n` +
                             `   ↳ _Fondo Reinversión (${recorded.reinvestPercent}%): $${recorded.reinvestAmount.toFixed(2)}_\n` +
                             `💵 *Tu Ganancia Real (Bolsillo):* $${recorded.netProfit.toFixed(2)} MXN\n` +
                             `━━━━━━━━━━━━━━━━━━━━━━\n` +
                             `_¡Registrado exitosamente en tu Panel de Finanzas!_ 🚀`;
                await sock.sendMessage(remoteJid, { text: finMsg });
            }

            delete context.sessionManager.ticketSessions[remoteJid];
            return true;
        }
    }
    
    // configticket routing
    const configticket = require('./configticket');
    if (context.sessionManager.configTicketSessions[remoteJid] || ['/configticket', '!configticket', 'configticket'].includes(cmd)) {
        const handled = await configticket(context);
        if (handled) return true;
    }

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

    if (['/perfil', '!perfil', 'perfil'].includes(cmd)) {
        if (user) {
            const role = user.role === 'admin' ? '👑 Administrador' : (user.role === 'reseller' ? '💼 Revendedor' : '👤 Usuario');
            const profileMsg = `👤 *PERFIL MEGAUNLOCK* 👤\n━━━━━━━━━━━━━━━━━━━━━━\n📛 *Usuario:* ${user.username}\n🛡️ *Rol:* ${role}\n#️⃣ *ID de Cuenta:* ${user.id}\n━━━━━━━━━━━━━━━━━━━━━━\n_Tu cuenta está conectada de forma segura._`;
            await sock.sendMessage(remoteJid, { text: profileMsg });
        }
        return true;
    }

    // COMANDOS DE SILENCIAR / ACTIVAR NOTIFICACIONES (Sin exigir barra '/')
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

    if (['/desvincular', '!desvincular', 'desvincular'].includes(cmd)) {
        delete wusers[remoteJid];
        writeDB(WHATSAPP_USERS_FILE, wusers);
        await sock.sendMessage(remoteJid, { text: '🔌 *¡Desconectado!* Tu cuenta ha sido desvinculada de este WhatsApp. \n\n¡Te echaré de menos! 😢' });
        return true;
    }

    if (['!setgroup', '/setgroup'].includes(cmd)) {
        if (isGroup) {
            const senderJid = msg.key.participant || remoteJid;
            const linkedUserId = wusers[senderJid];
            if (linkedUserId) {
                const groupUser = users.find(u => u.id === linkedUserId);
                if (groupUser && groupUser.role === 'admin') {
                    wsettings.adminGroupId = remoteJid;
                    writeDB(WHATSAPP_SETTINGS_FILE, wsettings);
                    await sock.sendMessage(remoteJid, { text: '✅ Este grupo ha sido configurado como el Grupo de Administradores para recibir notificaciones.' });
                }
            }
        }
        return true;
    }

    if (['/finanzas', '!finanzas', 'finanzas', '/ganancias', '!ganancias', 'ganancias'].includes(cmd)) {
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

    if (['/info', '!info'].includes(cmd)) {
        await sock.sendMessage(remoteJid, { text: '🤖 *MegaUnlock Bot*\n\nSoy el asistente oficial del panel. Para consultar saldos y pedidos, envíame un mensaje privado directo para proteger tu privacidad.' });
        return true;
    }

    if (['/servicios', '!servicios'].includes(cmd)) {
        await sock.sendMessage(remoteJid, { text: '🚀 *Servicios MegaUnlock*\n\nOfrecemos desbloqueos, liberaciones y recargas al mejor precio. ¡Regístrate en nuestro panel web para ver el catálogo completo y hacer tus pedidos!' });
        return true;
    }

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

    if (['/soporte', '!soporte', 'soporte', '/contacto', '!contacto', 'contacto'].includes(cmd)) {
        const vcard = 'BEGIN:VCARD\n' // metadata of the contact card
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

    return false;
}

module.exports = otros;
