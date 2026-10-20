const axios = require('axios');

async function buscar(context) {
    const { sock, msg, remoteJid, isGroup, firstWord, args, text, sessionManager, wusers } = context;
    const senderJid = isGroup ? (msg.key.participant || remoteJid) : remoteJid;
    const linkedUser = wusers[senderJid] || 1;

        // Check if it's a bus session
    if (sessionManager.busSessions[remoteJid]) {
        const query = text.trim();
        if (query.toLowerCase() === 'cancelar') {
            sessionManager.clearSession(remoteJid);
            await sock.sendMessage(remoteJid, { text: '🚫 Búsqueda cancelada.' });
            return true;
        }

        const session = sessionManager.busSessions[remoteJid];
        
        if (session.step === 'ask_server') {
            const val = query.toLowerCase();
            let sId = null;
            if (val === 'mega' || val === '1' || val.includes('mega server') || val.includes('1️⃣')) sId = '1';
            else if (val === 'omega' || val === '3' || val.includes('omega server') || val.includes('3️⃣')) sId = '3';
            else if (val === '2') sId = '2';
            
            if (!sId) {
                await sock.sendMessage(remoteJid, { text: '❌ Servidor inválido. Pulsa una opción en la encuesta o responde *1* para Mega o *3* para Omega.' });
                return true;
            }
            
            session.serverId = sId;
            session.step = 'ask_query';
            await sock.sendMessage(remoteJid, { text: `🔎 *Búsqueda en Servidor ${sId === '1' ? '1️⃣ MEGA SERVER' : (sId === '3' ? '3️⃣ OMEGA SERVER' : sId)}*\n\nPor favor ingresa la palabra clave para buscar el servicio (ej. "iPhone Claro") o escribe "cancelar".` });
            return true;
        } else {
            const sId = session.serverId;
            delete sessionManager.busSessions[remoteJid];
            await executeSearch(sId, query, sock, msg, remoteJid, isGroup, linkedUser);
            return true;
        }
    }

    const busMatch = firstWord.match(/^[\/!]?bus(mega|omega|1|2|3)?$/i);
    if (!busMatch) return false;

    let sIdRaw = busMatch[1];
    let sId = null;
    let query = null;

    if (sIdRaw) {
        let raw = sIdRaw.toLowerCase();
        if (raw === 'mega') sId = '1';
        else if (raw === 'omega') sId = '3';
        else sId = raw;
        
        query = args.slice(1).join(' ').trim();
    } else {
        const arg1 = args[1] ? args[1].toLowerCase() : null;
        if (arg1 === 'mega') sId = '1';
        else if (arg1 === 'omega') sId = '3';
        else if (['1', '2', '3'].includes(arg1)) sId = arg1;

        if (sId) {
            query = args.slice(2).join(' ').trim();
        } else if (args.length > 1) {
            // User provided a query without a server, let's just use the query and ask for server later?
            // Or just treat the whole thing as needing a server first.
        }
    }

    if (sId) {
        if (query) {
            await executeSearch(sId, query, sock, msg, remoteJid, isGroup, linkedUser);
        } else {
            sessionManager.busSessions[remoteJid] = { serverId: sId, step: 'ask_query' };
            await sock.sendMessage(remoteJid, { text: `🔎 *Búsqueda en Servidor ${sId === '1' ? '1️⃣ MEGA SERVER' : (sId === '3' ? '3️⃣ OMEGA SERVER' : sId)}*\n\nPor favor ingresa la palabra clave para buscar el servicio (ej. "iPhone Claro") o escribe "cancelar".` });
        }
    } else {
        sessionManager.busSessions[remoteJid] = { step: 'ask_server' };
        try {
            await sock.sendMessage(remoteJid, {
                poll: {
                    name: '🔎 Selecciona el Servidor para buscar:',
                    values: ['1️⃣ MEGA SERVER', '3️⃣ OMEGA SERVER'],
                    selectableCount: 1
                }
            });
        } catch (pollErr) {
            let srvText = '🛍️ *SELECCIÓN DE SERVIDOR PARA BUSCAR*\n━━━━━━━━━━━━━━━━━━━━━━\n¿En qué servidor deseas buscar?\n\n1️⃣ MEGA SERVER\n3️⃣ OMEGA SERVER\n\n_(O escribe "cancelar" para salir)_';
            await sock.sendMessage(remoteJid, { text: srvText });
        }
    }
    return true; // handled
}

async function executeSearch(sId, query, sock, msg, remoteJid, isGroup, linkedUser) {
    try {
        const http = require('http');
        const https = require('https');
        const ipv4Agent = new https.Agent({ family: 4 });

        // Intentar primero vía API interna o endpoint AlwaysData con timeout de 8 segundos
        let results = null;
        try {
            const res = await axios.post('https://megaunlockphone-panel.alwaysdata.net/api/bot/search', {
                botSecret: 'MEGA_BOT_SECRET_2026',
                userId: linkedUser,
                serverId: sId,
                query: query
            }, {
                timeout: 8000,
                httpsAgent: ipv4Agent
            });
            results = res.data?.results;
        } catch (apiErr) {
            console.warn('[SEARCH] External API call failed, falling back to local database search:', apiErr.message);
            // Fallback directo a base de datos / cache local para no dejar colgado al usuario
            const botController = require('../controllers/botController');
            const mockReq = {
                body: { query, userId: linkedUser, serverId: sId },
                headers: { 'x-server-id': sId }
            };
            const mockRes = {
                status: () => mockRes,
                json: (data) => { results = data.results || []; }
            };
            await botController.searchProducts(mockReq, mockRes);
        }

        if (!results || results.length === 0) {
            await sock.sendMessage(remoteJid, { text: `🔎 No se encontraron servicios para "${query}" en el Servidor ${sId === '1' ? '1️⃣ MEGA' : (sId === '3' ? '3️⃣ OMEGA' : sId)}.` });
        } else {
            let msgTxt = `⚠️ _Tip: Escribe palabras clave claras (ej. "iPhone Claro") para que la búsqueda sea más rápida y precisa._\n\n🔎 *Resultados en Servidor ${sId === '1' ? '1️⃣ MEGA' : (sId === '3' ? '3️⃣ OMEGA' : sId)} para "${query}":*\n\n`;
            results.forEach((r, i) => {
                const emoji = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'][i];
                const prefix = emoji ? emoji : `*${i + 1}.*`;
                const parsedPrice = parseFloat(r.price); const validPrice = !isNaN(parsedPrice) ? parsedPrice : 0;
                msgTxt += `${prefix} ID: ${r.id} | ${r.name} | 💰 $${validPrice.toFixed(2)} MXN\n\n`;
            });
            msgTxt += `Para pedir escribe: /pedir${sId}`;
            await sock.sendMessage(remoteJid, { text: msgTxt });
        }
    } catch (e) {
        console.error('[SEARCH] Final catch error:', e.message);
        await sock.sendMessage(remoteJid, { text: '❌ Error al buscar servicios. Intenta con otra palabra clave.' });
    }
}

module.exports = buscar;
