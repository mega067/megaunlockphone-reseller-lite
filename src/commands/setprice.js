const axios = require('axios');

async function setprice(context) {
    const { sock, msg, remoteJid, firstWord, args, text, sessionManager } = context;
    const cmd = firstWord.toLowerCase();
    
    // Check if it's an ongoing session
    if (sessionManager.setPriceSessions[remoteJid]) {
        const session = sessionManager.setPriceSessions[remoteJid];
        
        if (text.toLowerCase() === 'cancelar') {
            sessionManager.clearSession(remoteJid);
            await sock.sendMessage(remoteJid, { text: '🚫 Configuración de precios cancelada.' });
            return true;
        }
        
        if (session.step === 'select_server') {
            const rawInput = text.trim().toLowerCase();
            let sId = null;
            if (rawInput === 'mega' || rawInput === '1') sId = '1';
            else if (rawInput === 'omega' || rawInput === '3') sId = '3';
            else if (rawInput === '2') sId = '2';

            if (!sId) {
                await sock.sendMessage(remoteJid, { text: '❌ Servidor inválido. Responde con 1, 2, 3 o Mega/Omega.' });
                return true;
            }
            session.serverId = sId;
            session.step = 'select_group';
            
            await sock.sendMessage(remoteJid, { text: '⏳ Obteniendo categorías...' });
            try {
                const res = await axios.post('https://megaunlockphone-panel.alwaysdata.net/api/bot/groups', {
                    botSecret: 'MEGA_BOT_SECRET_2026',
                    serverId: sId
                });
                const groups = res.data.groups;
                if (!groups || groups.length === 0) {
                    await sock.sendMessage(remoteJid, { text: '❌ No hay categorías en este servidor.' });
                    sessionManager.clearSession(remoteJid);
                    return true;
                }
                session.groups = groups;
                let txt = '📂 *Selecciona una Categoría*\n\nResponde con el número de la categoría:\n\n';
                groups.forEach((g, idx) => {
                    txt += `${idx + 1}️⃣ ${g}\n`;
                });
                await sock.sendMessage(remoteJid, { text: txt });
            } catch (e) {
                await sock.sendMessage(remoteJid, { text: '❌ Error al obtener categorías.' });
                sessionManager.clearSession(remoteJid);
            }
            return true;
        } else if (session.step === 'select_group') {
            const num = parseInt(text.trim()) - 1;
            if (isNaN(num) || num < 0 || num >= session.groups.length) {
                await sock.sendMessage(remoteJid, { text: '❌ Número de categoría inválido. Intenta de nuevo.' });
                return true;
            }
            const groupName = session.groups[num];
            
            await sock.sendMessage(remoteJid, { text: `⏳ Obteniendo productos de *${groupName}*...` });
            try {
                const res = await axios.post('https://megaunlockphone-panel.alwaysdata.net/api/bot/products', {
                    botSecret: 'MEGA_BOT_SECRET_2026',
                    serverId: session.serverId,
                    groupName: groupName
                });
                const products = res.data.products;
                if (!products || products.length === 0) {
                    await sock.sendMessage(remoteJid, { text: '❌ No hay productos en esta categoría.' });
                    sessionManager.clearSession(remoteJid);
                    return true;
                }
                session.products = products;
                session.currentIndex = 0;
                session.step = 'iterate_products';
                
                await sendProductPrompt(sock, remoteJid, session);
            } catch (e) {
                await sock.sendMessage(remoteJid, { text: '❌ Error al obtener productos.' });
                sessionManager.clearSession(remoteJid);
            }
            return true;
        } else if (session.step === 'iterate_products') {
            const input = text.trim().toUpperCase();
            if (input === 'S') {
                session.currentIndex++;
            } else if (input === 'R') {
                if (session.currentIndex > 0) {
                    session.currentIndex--;
                } else {
                    await sock.sendMessage(remoteJid, { text: '⚠️ Ya estás en el primer producto.' });
                    return true;
                }
            } else {
                const parts = input.split(' ');
                if (parts.length >= 2) {
                    const rp = parseFloat(parts[0]);
                    const cp = parseFloat(parts[1]);
                    if (isNaN(rp) || isNaN(cp)) {
                        await sock.sendMessage(remoteJid, { text: '❌ Precios inválidos. Usa el formato: `[precio_reseller] [precio_final]` (ej. `120.5 150`)' });
                        return true;
                    }
                    
                    const p = session.products[session.currentIndex];
                    if (rp < p.realCost || cp < p.realCost) {
                        await sock.sendMessage(remoteJid, { text: `❌ El precio no puede ser menor al costo de API ($${p.realCost}). Intenta de nuevo:` });
                        return true;
                    }
                    
                    await sock.sendMessage(remoteJid, { text: '⏳ Guardando precio...' });
                    try {
                        const res = await axios.post('https://megaunlockphone-panel.alwaysdata.net/api/bot/setprice', {
                            botSecret: 'MEGA_BOT_SECRET_2026',
                            serverId: session.serverId,
                            serviceid: p.id,
                            resellerPrice: rp,
                            clientPrice: cp
                        });
                        
                        if (res.data.error) {
                            await sock.sendMessage(remoteJid, { text: `❌ Error: ${res.data.error}` });
                            return true;
                        }
                        
                        p.resellerPrice = rp;
                        p.clientPrice = cp;
                        await sock.sendMessage(remoteJid, { text: '✅ Precio actualizado correctamente.' });
                        session.currentIndex++;
                    } catch (e) {
                        await sock.sendMessage(remoteJid, { text: '❌ Error al guardar.' });
                        return true;
                    }
                } else {
                    await sock.sendMessage(remoteJid, { text: '❌ Formato inválido. Responde con `[precio_reseller] [precio_final]` o `S` para saltar.' });
                    return true;
                }
            }
            
            if (session.currentIndex >= session.products.length) {
                await sock.sendMessage(remoteJid, { text: '🎉 Has terminado de configurar esta categoría.' });
                sessionManager.clearSession(remoteJid);
            } else {
                await sendProductPrompt(sock, remoteJid, session);
            }
            return true;
        } else if (session.step === 'direct_product') {
            const input = text.trim().toUpperCase();
            const parts = input.split(' ');
            if (parts.length >= 2) {
                const rp = parseFloat(parts[0]);
                const cp = parseFloat(parts[1]);
                if (isNaN(rp) || isNaN(cp)) {
                    await sock.sendMessage(remoteJid, { text: '❌ Precios inválidos. Usa el formato: `[precio_reseller] [precio_final]`' });
                    return true;
                }
                
                if (session.realCost !== undefined) {
                    if (rp < session.realCost || cp < session.realCost) {
                        await sock.sendMessage(remoteJid, { text: `❌ El precio no puede ser menor al costo API ($${parseFloat(session.realCost).toFixed(2)}). Intenta de nuevo:` });
                        return true;
                    }
                }
                
                await sock.sendMessage(remoteJid, { text: '⏳ Guardando precio...' });
                try {
                    const res = await axios.post('https://megaunlockphone-panel.alwaysdata.net/api/bot/setprice', {
                        botSecret: 'MEGA_BOT_SECRET_2026',
                        serverId: session.serverId,
                        serviceid: session.productId,
                        resellerPrice: rp,
                        clientPrice: cp
                    });
                    
                    if (res.data.error) {
                        await sock.sendMessage(remoteJid, { text: `❌ Error: ${res.data.error}` });
                    } else {
                        await sock.sendMessage(remoteJid, { text: '✅ Precio actualizado correctamente.' });
                    }
                } catch (e) {
                    await sock.sendMessage(remoteJid, { text: '❌ Error al guardar.' });
                }
                sessionManager.clearSession(remoteJid);
            } else {
                await sock.sendMessage(remoteJid, { text: '❌ Formato inválido. Responde con `[precio_reseller] [precio_final]`.' });
            }
            return true;
        }
    }

    // Trigger command parsing
    if (['/setprice', '!setprice', 'setprice'].includes(cmd)) {
        if (args.length >= 3) {
            // Direct setprice: /setprice server productid
            let sIdRaw = args[1].toLowerCase();
            let sId = null;
            if (sIdRaw === 'mega' || sIdRaw === '1') sId = '1';
            else if (sIdRaw === 'omega' || sIdRaw === '3') sId = '3';
            else if (sIdRaw === '2') sId = '2';
            
            if (!sId) {
                await sock.sendMessage(remoteJid, { text: '❌ Servidor inválido. Usa 1, 2, 3 o Mega/Omega.' });
                return true;
            }
            
            const pId = args[2];
            sessionManager.setPriceSessions[remoteJid] = {
                step: 'direct_product',
                serverId: sId,
                productId: pId
            };
            
            await sock.sendMessage(remoteJid, { text: `⏳ Obteniendo información del producto...` });
            try {
                const res = await axios.post('https://megaunlockphone-panel.alwaysdata.net/api/bot/products', {
                    botSecret: 'MEGA_BOT_SECRET_2026',
                    serverId: sId,
                    productId: pId
                });
                const products = res.data.products;
                if (!products || products.length === 0) {
                    await sock.sendMessage(remoteJid, { text: '❌ No se encontró el producto o el ID es inválido.' });
                    sessionManager.clearSession(remoteJid);
                    return true;
                }
                const p = products[0];
                sessionManager.setPriceSessions[remoteJid].realCost = p.realCost;
                
                let txt = `🔧 *Configuración Directa*\n`;
                txt += `Servidor: ${sId === '1' ? 'Mega' : (sId === '3' ? 'Omega' : sId)} | ID Producto: ${pId}\n`;
                txt += `*Producto:* ${p.name}\n`;
                txt += `*Costo API:* $${parseFloat(p.realCost).toFixed(2)}\n`;
                txt += `*Precio Reseller Actual:* $${parseFloat(p.resellerPrice).toFixed(2)}\n`;
                txt += `*Precio Final Actual:* $${parseFloat(p.clientPrice).toFixed(2)}\n\n`;
                txt += `Por favor ingresa los nuevos precios con el formato:\n*[precio_reseller] [precio_final]*\n(ejemplo: \`150 200\`)`;
                
                await sock.sendMessage(remoteJid, { text: txt });
            } catch(e) {
                await sock.sendMessage(remoteJid, { text: '❌ Error al obtener la información del producto.' });
                sessionManager.clearSession(remoteJid);
            }
        } else {
            sessionManager.setPriceSessions[remoteJid] = { step: 'select_server' };
            let srvText = '🛍️ *CONFIGURACIÓN DE PRECIOS*\n\n¿En qué servidor deseas modificar precios?\nResponde con el número o nombre del servidor:\n\n1️⃣ MEGA SERVER\n2️⃣ SERVIDOR 2\n3️⃣ OMEGA SERVER\n\n(Escribe *cancelar* para salir)';
            await sock.sendMessage(remoteJid, { text: srvText });
        }
        return true;
    }
    
    return false;
}

async function sendProductPrompt(sock, remoteJid, session) {
    const p = session.products[session.currentIndex];
    const total = session.products.length;
    let txt = `🔧 *Configurando Precios (${session.currentIndex + 1}/${total})*\n\n`;
    txt += `*Producto:* ${p.name}\n`;
    txt += `*ID:* ${p.id}\n`;
    txt += `*Costo API:* $${parseFloat(p.realCost).toFixed(2)}\n`;
    txt += `*Precio Reseller Actual:* $${parseFloat(p.resellerPrice).toFixed(2)}\n`;
    txt += `*Precio Final Actual:* $${parseFloat(p.clientPrice).toFixed(2)}\n\n`;
    txt += `Escribe los nuevos precios así: *[reseller] [final]* (ej. \`120 150\`)\n`;
    txt += `Otras opciones:\n- Escribe *S* para Skip (omitir y pasar al siguiente)\n`;
    if (session.currentIndex > 0) {
        txt += `- Escribe *R* para Regresar al producto anterior\n`;
    }
    txt += `- Escribe *cancelar* para salir.`;
    await sock.sendMessage(remoteJid, { text: txt });
}

module.exports = setprice;
