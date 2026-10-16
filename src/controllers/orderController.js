const axios = require('axios');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { readDB, writeDB, DATA_DIR } = require('../db');
const { getServerId, getServerSettings, getUserCredit, setUserCredit, callGsmThemeApi, getServerDisplayName, calculateMarkup, calculateGroupMarkup, processRefund, generateValidLuhnImei, isValidLuhnImei } = require('../helpers');
const { catalogCache, incrementHistoryVersion } = require('../cacheManager');
const { enqueueWhatsApp, enqueueWhatsAppAdmin } = require('../whatsappQueue');
const { fetchBulkOrdersStatus } = require('../syncService');

const ipv4Agent = new https.Agent({ family: 4 });

const BACKUP_DIR = path.join(DATA_DIR, 'backups');

function createAutoBackup(reason) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeReason = reason.replace(/[^a-zA-Z0-9_]/g, '_');
    const filename = `autobackup_${timestamp}_${safeReason}.json`;
    const filepath = path.join(BACKUP_DIR, filename);
    
    const dbFiles = ['users.json', 'prices.json', 'custom_prices.json', 'history.json', 'settings.json', 'user_custom_prices.json', 'coupons.json'];
    const backupData = {};
    
    dbFiles.forEach(file => {
      backupData[file] = readDB(file);
    });
    
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));
    
    let files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json') && f.startsWith('autobackup_'));
    if (files.length > 2) {
      files.sort().reverse();
      const filesToDelete = files.slice(2);
      filesToDelete.forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
    }
  } catch (e) {
    console.error('Error creating auto-backup:', e);
  }
}


exports.processOrder = async (req, res) => {
  const { serviceid, imei, custom_fields, serviceType, serviceName, qnt = 1 } = req.body;
  
  let finalImei = imei ? String(imei).trim() : '';
  if (custom_fields && typeof custom_fields === 'object') {
    const targetKeys = ['numero', 'referencia', 'telefono', 'linea', 'celular', 'phone', 'number', 'ref', 'playerid', 'id'];
    const customKeys = Object.keys(custom_fields);
    const keyToCopy = customKeys.find(k => targetKeys.includes(k.toLowerCase().replace(/[^a-z0-9]/g, '')));
    if (keyToCopy && custom_fields[keyToCopy]) {
      const val = String(custom_fields[keyToCopy]).trim();
      const isDummyImei = !finalImei || 
                          finalImei === '111111111111111' || 
                          (finalImei.length >= 13 && /^\d+$/.test(finalImei) && !isValidLuhnImei(finalImei));
      if (isDummyImei && val.length <= 15) {
        finalImei = val;
      }
    }
  }

  // If finalImei is empty or a non-Luhn dummy, generate a valid 15-digit Luhn IMEI
  if (!finalImei || finalImei === '111111111111111' || (finalImei.length === 15 && !isValidLuhnImei(finalImei) && /^\d+$/.test(finalImei) && finalImei.startsWith('17'))) {
    finalImei = generateValidLuhnImei();
  }

  const quantity = Math.max(1, parseInt(qnt) || 1);
  const serverId = getServerId(req);
  const settingsDb = readDB('settings.json');
  const settings = getServerSettings(settingsDb, serverId);
  const users = readDB('users.json') || [];
  const prices = readDB('prices_' + serverId + '.json') || {};
  const history = readDB('history.json') || [];
  
  if (!settings || !serviceid) return res.status(400).json({ error: 'Missing serviceid or server settings.' });
  
  const userIndex = users.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
  const user = users[userIndex];

  let realCost = prices[serviceid] !== undefined ? prices[serviceid] : null;
  const serverKey = 'server' + serverId;
  let serviceGroupKey = null;
  
  if (catalogCache[serverKey] && catalogCache[serverKey].data) {
     const list = catalogCache[serverKey].data;
     for (const g in list) {
       if (list[g].SERVICES) {
          let s = null;
          if (Array.isArray(list[g].SERVICES)) {
              s = list[g].SERVICES.find(x => x && (x.SERVICEID == serviceid || x.serviceid == serviceid));
          } else {
              s = list[g].SERVICES[serviceid] || Object.values(list[g].SERVICES).find(x => x && (x.SERVICEID == serviceid || x.serviceid == serviceid));
          }
          if (s) {
              serviceGroupKey = g;
              if (realCost === null) {
                const exchangeRate = parseFloat(settingsDb.exchangeRate || 17.60);
                const rate = serverId === '3' ? 1 : exchangeRate;
                realCost = parseFloat(s.CREDIT || '0') * rate;
                prices[serviceid] = realCost;
                writeDB('prices_' + serverId + '.json', prices);
              }
              break;
          }
       }
     }
  }

  if (realCost === null) {
    return res.status(400).json({ error: 'El catálogo se está sincronizando en el servidor. Por favor, espera 5 segundos y vuelve a intentarlo.' });
  }

  const allCustomPrices = readDB('custom_prices.json') || {};
  const customPrices = allCustomPrices['server' + serverId] || {};
  const allUserCustomPrices = readDB('user_custom_prices.json') || {};
  const serverUserCustomPrices = allUserCustomPrices['server' + serverId] || {};
  const allGroupMarkups = readDB('group_markups.json') || {};
  const serverGroupMarkups = allGroupMarkups['server' + serverId] || {};
  const allowedFreeDb = readDB('allowed_free_services.json') || {};
  const allowedFreeList = allowedFreeDb['server' + serverId] || [];
  const isAllowedFree = allowedFreeList.includes(String(serviceid));

  // If upstream cost is 0, only allow purchase if either custom price exists or allowed_free is enabled
  if (realCost === 0 && !customPrices[serviceid] && !isAllowedFree) {
    return res.status(400).json({ error: 'Este servicio requiere asignación de precio manual o activación por el administrador antes de comprar.' });
  }
  const groupMarkupObj = serviceGroupKey ? serverGroupMarkups[serviceGroupKey] : null;
  
  let resellerCost;
  const ucp = serverUserCustomPrices[serviceid] && serverUserCustomPrices[serviceid][user.id];

  if (ucp && ucp.resellerPrice !== undefined) {
    resellerCost = parseFloat(ucp.resellerPrice);
  } else if (customPrices[serviceid]) {
    resellerCost = parseFloat(customPrices[serviceid].resellerPrice);
  } else {
    let activeMarkup = 0;
    if (user.markup !== null && user.markup !== undefined && !isNaN(user.markup)) {
      activeMarkup = parseFloat(user.markup);
    } else {
      const servicesData = catalogCache[serverKey] ? catalogCache[serverKey].data : null;
      const groupObj = servicesData && Array.isArray(servicesData.SUCCESS) ? servicesData.SUCCESS.find(i => i.serviceid == serviceid || i.SERVICEID == serviceid) : null;
      const groupName = groupObj ? (groupObj.GROUPNAME || groupObj.group || groupObj.GROUP) : null;
      
      let groupMarkupObj = null;
      if (groupName) {
        groupMarkupObj = serverGroupMarkups[groupName] || serverGroupMarkups[serviceGroupKey];
      } else {
        groupMarkupObj = serverGroupMarkups[serviceGroupKey];
      }

      let rMarkup = calculateGroupMarkup(realCost, groupMarkupObj, false, settings);
      if (rMarkup === null) rMarkup = calculateMarkup(realCost, settings.resellerTier1, settings.resellerTier2, settings.resellerTier3);
      activeMarkup = rMarkup;
    }
    resellerCost = Math.ceil(realCost + activeMarkup);
  }
  
  const profit = resellerCost - realCost;
  const isReseller = user.role !== 'admin';
  const finalCostToDeduct = (isReseller ? resellerCost : realCost) * quantity;
  const baseCostToDeduct = isReseller ? resellerCost : realCost;

  const currentCredit = getUserCredit(user, serverId);
  if (isReseller && currentCredit < finalCostToDeduct) {
    return res.status(400).json({ error: `Saldo insuficiente. Tienes $${currentCredit.toFixed(2)} y el pedido cuesta $${finalCostToDeduct.toFixed(2)} (Cantidad: ${quantity} x $${baseCostToDeduct.toFixed(2)})` });
  } else if (!isReseller) {
    try {
        let targetUrl = settings.endpoint;
        if (!targetUrl) {
            targetUrl = serverId === '3' ? 'https://megaunlockphone-panel.alwaysdata.net/api/index.php' : 'https://latamgsm.com/dhru/';
        }
        if (!targetUrl.includes('/api/')) {
          targetUrl = targetUrl.endsWith('/') ? `${targetUrl}api/index.php` : `${targetUrl}/api/index.php`;
        } else if (targetUrl.endsWith('/api/')) {
          targetUrl += 'index.php';
        }
        
        const params = new URLSearchParams();
        params.append('username', settings.username);
        params.append('apiaccesskey', settings.apiaccesskey);
        params.append('action', 'accountinfo');
        params.append('requestformat', 'JSON');
        
        const response = await axios.post(targetUrl, params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' },
          timeout: 10000
        });
        
        const exRate = parseFloat(settingsDb.exchangeRate || 17.60);
        const rate = serverId === '3' ? 1 : exRate;
        const real = parseFloat(response.data?.SUCCESS?.[0]?.AccountInfo?.creditraw || 0) * rate;
        
        let cedido = 0;
        users.forEach(u => {
          if (u.role !== 'admin' && u['credits_' + serverId]) {
            cedido += parseFloat(u['credits_' + serverId]);
          }
        });
        
        const disp = real - cedido;
        if (disp < finalCostToDeduct) {
            return res.status(400).json({ error: `Saldo disponible insuficiente. Tienes $${disp.toFixed(2)} disponibles reales (sin el saldo cedido a usuarios) y el pedido cuesta $${finalCostToDeduct.toFixed(2)}.` });
        }
    } catch(e) {
        return res.status(400).json({ error: `Error verificando saldo del admin: ${e.message}` });
    }
  }

  const { apiaccesskey, username, endpoint } = settings;
  let targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';

  try {
    let responseData;
    let orderId = 'Desconocido';
    let msg = 'Exitoso';

    if (serverId === '1' || serverId === '3') {
      let customXmlBase64 = '';
      let customXmlRaw = '';
      if (custom_fields && typeof custom_fields === 'object' && Object.keys(custom_fields).length > 0) {
        const cleanedFields = {};
        for (const [key, val] of Object.entries(custom_fields)) {
          if (key.trim() !== '') {
            cleanedFields[key] = val;
          }
        }
        if (Object.keys(cleanedFields).length > 0) {
          const b64 = Buffer.from(JSON.stringify(cleanedFields)).toString('base64');
          customXmlBase64 = `<CUSTOMFIELD>${b64}</CUSTOMFIELD>`;
          
          let rawXml = '';
          for (const [key, val] of Object.entries(cleanedFields)) {
            const cleanKey = key.toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (cleanKey) rawXml += `<${cleanKey}>${val}</${cleanKey}>`;
          }
          customXmlRaw = `<CUSTOMFIELD>${rawXml}</CUSTOMFIELD>`;
        }
      }

      const notes = req.body.notes || '';
      let notesXml = '';
      if (notes.trim() !== '') {
        notesXml = '<NOTES>' + notes.trim() + '</NOTES>';
      }

      const resolvedImei = finalImei && finalImei.trim() !== '' ? finalImei.trim() : generateValidLuhnImei();
      const baseParameters = '<ID>' + serviceid + '</ID><IMEI>' + resolvedImei + '</IMEI>' + (quantity > 1 || serviceType === 'SERVER' || serviceType === 'server' ? '<QNT>' + quantity + '</QNT>' : '');

      let primaryAction = (serviceType === 'SERVER' || serviceType === 'server') ? 'placeserverorder' : 'placeimeiorder';
      let secondaryAction = primaryAction === 'placeserverorder' ? 'placeimeiorder' : 'placeserverorder';

      const sendDhruRequest = async (currentAction, currentCustomXml) => {
        const xmlParameters = `<PARAMETERS>${baseParameters}${currentCustomXml}${notesXml}</PARAMETERS>`;
        const params = new URLSearchParams();
        params.append('username', username);
        params.append('apiaccesskey', apiaccesskey);
        params.append('action', currentAction);
        params.append('requestformat', 'JSON');
        params.append('parameters', xmlParameters);
        
        const response = await axios.post(targetUrl, params.toString(), {
          headers: { 
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'Dhru-Fusion-Web-Client/1.0'
          }, 
          timeout: 20000
        });
        return response.data;
      };

      const combinations = [
        { action: primaryAction, xml: customXmlBase64 },
        { action: secondaryAction, xml: customXmlBase64 },
        { action: primaryAction, xml: customXmlRaw },
        { action: secondaryAction, xml: customXmlRaw }
      ];

      for (const combo of combinations) {
        responseData = await sendDhruRequest(combo.action, combo.xml);
        
        if (responseData && responseData.SUCCESS) {
          break;
        }

        if (responseData && responseData.ERROR && responseData.ERROR.length > 0) {
          let errorMsg = '';
          if (typeof responseData.ERROR[0] === 'object') {
            errorMsg = responseData.ERROR[0].MESSAGE || responseData.ERROR[0].message || responseData.ERROR[0].Error || responseData.ERROR[0].error || '';
          } else if (typeof responseData.ERROR[0] === 'string') {
            errorMsg = responseData.ERROR[0];
          }
          
          if (errorMsg !== 'Invalid Action' && errorMsg !== 'Command Not Found') {
            break;
          }
        }
      }

      if (responseData && responseData.ERROR && responseData.ERROR.length > 0) {
        if (typeof responseData.ERROR[0] === 'object') {
           responseData.ERROR[0].MESSAGE = `Todos los intentos (Base64/Raw, IMEI/Server) fallaron. Original: ` + (responseData.ERROR[0].MESSAGE || responseData.ERROR[0].Error || '');
        } else if (typeof responseData.ERROR[0] === 'string') {
           responseData.ERROR[0] = `Todos los intentos (Base64/Raw, IMEI/Server) fallaron. Original: ` + responseData.ERROR[0];
        }
      }

    } else {
      let gsmParams = { ID: serviceid };
      
      gsmParams.IMEI = finalImei && finalImei.trim() !== '' ? finalImei : '111111111111111';
      
      if (serviceType === 'SERVER' || serviceType === 'server') {
        gsmParams.QNT = quantity;
      }
      
      if (custom_fields && typeof custom_fields === 'object' && Object.keys(custom_fields).length > 0) {
        gsmParams.CUSTOMFIELD = Buffer.from(JSON.stringify(custom_fields)).toString('base64');
      }
      if (req.body.notes && req.body.notes.trim() !== '') {
        gsmParams.NOTES = req.body.notes.trim();
      }
      const action = (serviceType === 'SERVER' || serviceType === 'server') ? 'placeserverorder' : 'placeimeiorder';
      const response = await callGsmThemeApi(targetUrl, action, gsmParams, username, apiaccesskey);
      responseData = response.data;
    }

    if (responseData && responseData.SUCCESS) {
      if (isReseller) {
        const uCredit = getUserCredit(users[userIndex], serverId);
        setUserCredit(users[userIndex], serverId, uCredit - finalCostToDeduct);
        settingsDb.adminProfitBalance = (settingsDb.adminProfitBalance || 0) + profit;
      }
      
      writeDB('users.json', users);
      writeDB('settings.json', settingsDb);
      
      const successItem = Array.isArray(responseData.SUCCESS) ? responseData.SUCCESS[0] : responseData.SUCCESS;
      orderId = successItem.REFERENCEID || successItem.ORDERID || successItem.ID || 'Desconocido';
      msg = successItem.MESSAGE || 'Exitoso';

      let imeiDataString = finalImei || 'N/A';
      if (custom_fields && typeof custom_fields === 'object') {
        const customKeys = Object.keys(custom_fields);
        if (customKeys.length > 0) {
          imeiDataString += ' (';
          customKeys.forEach((key, index) => {
            imeiDataString += key + ': ' + custom_fields[key] + (index < customKeys.length - 1 ? ', ' : '');
          });
          imeiDataString += ')';
        }
      }

      history.unshift({
        id: 'txn_' + Date.now(),
        serverId: serverId,
        userId: user.id,
        username: user.username,
        date: new Date().toISOString(),
        serviceId: serviceid,
        serviceName: serviceName || 'Servicio',
        serviceType: serviceType || 'IMEI',
        imei: imeiDataString,
        costCharged: finalCostToDeduct,
        resellerCost: resellerCost,
        realCost: realCost,
        profit: isReseller ? profit : 0,
        orderId,
        status: 'pending',
        msg,
        statusText: msg,
        notes: req.body.notes || ''
      });
      if (history.length > 500) history.pop();
      writeDB('history.json', history);
      incrementHistoryVersion();
      
      createAutoBackup('Nuevo_Pedido_S' + serverId);

      const userNameDisplay = user.role === 'admin' ? 'Admin #1' : user.username;
      const adminMsg = `🛒 NUEVO PEDIDO RECIBIDO\n━━━━━━━━━━━━━━━━━━━━━━\n#️⃣ Orden: #${orderId}\n👨🏽💻 Usuario: ${userNameDisplay}\n🔧 Servicio: ${serviceName || 'N/A'}\n🔍 Detalles: ${imeiDataString}\n💲 Precio: $${parseFloat(resellerCost).toFixed(2)} MXN\n🖥️ Servidor: ${getServerDisplayName(serverId)}\n━━━━━━━━━━━━━━━━━━━━━━\n🛡️ MegaUnlockPhone`;
      enqueueWhatsAppAdmin(adminMsg);
      
      const groupMsg = `🛒 NUEVO PEDIDO RECIBIDO\n━━━━━━━━━━━━━━━━━━━━━━\n#️⃣ Orden: #${orderId}\n👨🏽💻 Usuario: ID ${user.id}\n🔧 Servicio: ${serviceName || 'N/A'}\n🖥️ Servidor: ${getServerDisplayName(serverId)}\n━━━━━━━━━━━━━━━━━━━━━━\n🌐 MegaUnlockPhone`;
      enqueueWhatsApp('group', groupMsg);

      const clientMsg = `📨 ORDEN EN PROCESO\n\n🆔 Orden: #${orderId}\n📱 IMEI: ${imeiDataString || 'N/A'}\n🔧 Servicio: ${serviceName || 'Servicio'}\n💲 Costo: $${parseFloat(resellerCost).toFixed(2)} MXN\n🔑 Código / Respuesta: Procesando...\n🎉 Estado: En proceso\n\n━━━━━━━━━━━━━━\n🌐 MegaUnlockPhone`;
      enqueueWhatsApp('private', clientMsg, user.id);

      return res.json(responseData);
    } else if (responseData && responseData.ERROR) {
      return res.json(responseData);
    } else {
      return res.status(500).json({ error: 'Respuesta inválida del servidor remoto.' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Fallo al comunicarse con el proveedor.', details: error.message });
  }
};

exports.getOrderStatus = async (req, res) => {
  const { orderid } = req.body;
  if (!orderid) return res.status(400).json({ error: 'Order ID is required.' });

  const serverId = getServerId(req);
  const settingsDb = readDB('settings.json');
  const settings = getServerSettings(settingsDb, serverId);
  if (!settings) return res.status(500).json({ error: 'Server misconfigured' });
  const { apiaccesskey, username, endpoint } = settings;

  let targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';

  try {
    let responseData;
    if (serverId === '1' || serverId === '3') {
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('apiaccesskey', apiaccesskey);
      params.append('action', 'getimeiorder');
      params.append('requestformat', 'JSON');
      params.append('parameters', '<PARAMETERS><ID>' + orderid + '</ID></PARAMETERS>');

      const response = await axios.post(targetUrl, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000, httpsAgent: ipv4Agent
      });
      responseData = response.data;
    } else {
      const response = await callGsmThemeApi(targetUrl, 'getimeiorder', { ID: orderid }, username, apiaccesskey);
      responseData = response.data;
    }

    if (responseData) {
      return res.json(responseData);
    } else {
      return res.status(500).json({ error: 'No response data received.' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch order status.', details: error.message });
  }
};

exports.getBulkOrderStatus = async (req, res) => {
  const { ids, items } = req.body;
  if (!ids && !items) return res.status(400).json({ error: 'ids or items are required.' });

  const serverId = getServerId(req);
  const settingsDb = readDB('settings.json');
  if (!settingsDb) return res.status(500).json({ error: 'Server misconfigured' });
  const settings = getServerSettings(settingsDb, serverId);
  if (!settings) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    let syncList = [];
    if (items && Array.isArray(items)) {
      syncList = items.filter(item => item && item.id);
    } else if (ids) {
      syncList = ids.split(',').map(id => ({ id: id.trim(), type: 'IMEI' })).filter(item => item.id);
    }

    const results = await fetchBulkOrdersStatus(syncList, settings, serverId);
    return res.json({ SUCCESS: results });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch bulk statuses.', details: error.message });
  }
};

exports.syncPendingOrders = async (req, res) => {
  const serverId = getServerId(req);
  const settingsDb = readDB('settings.json');
  if (!settingsDb) return res.status(500).json({ error: 'Configuración no encontrada' });
  const settings = getServerSettings(settingsDb, serverId);
  if (!settings || !settings.endpoint) return res.status(500).json({ error: 'Servidor no configurado' });

  const history = readDB('history.json') || [];
  const users = readDB('users.json') || [];
  const currentUser = users.find(u => String(u.id) === String(req.user.id)) || req.user;

  // Filter pending orders
  const pendingOrders = history.filter(o => {
    const isMatchingServer = String(o.serverId || '1') === serverId;
    const isPending = o.status === 'pending';
    const isOwnerOrAdmin = req.user.role === 'admin' || String(o.userId) === String(req.user.id);
    return isMatchingServer && isPending && isOwnerOrAdmin && o.orderId && o.orderId !== 'Error';
  });

  if (pendingOrders.length === 0) {
    const userCredits = getUserCredit(currentUser, serverId);
    return res.json({
      success: true,
      updated: false,
      count: 0,
      remainingPending: 0,
      userCredits
    });
  }

  try {
    const syncList = pendingOrders.map(o => ({ id: o.orderId, type: o.serviceType }));
    const results = await fetchBulkOrdersStatus(syncList, settings, serverId);

    let updatedCount = 0;
    const updatedOrderIds = [];

    for (const r of results) {
      if (!r || !r.orderid) continue;
      if (r.status === 'success' || r.status === 'failed') {
        const idx = history.findIndex(h => String(h.orderId) === String(r.orderid) && String(h.serverId || '1') === serverId);
        if (idx !== -1 && history[idx].status !== r.status) {
          history[idx].status = r.status;
          history[idx].statusText = r.statusText;
          history[idx].updateTimestamp = new Date().toLocaleString('es-MX');
          updatedCount++;
          updatedOrderIds.push(history[idx].orderId);

          const isSuccess = r.status === 'success';
          const isRejected = r.status === 'failed';

          // Auto Refund if rejected
          if (isRejected && !history[idx].isRefunded) {
            processRefund(history[idx]);
          }

          const costToUse = parseFloat(history[idx].resellerCost || history[idx].costCharged || 0);
          const cleanMsg = String(r.statusText || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();

          if (isSuccess) {
            const privateMsg = `✅ SERVICIO COMPLETADO\n\n🆔 Orden: #${history[idx].orderId}\n📱 IMEI: ${history[idx].imei || 'N/A'}\n🔧 Servicio: ${history[idx].serviceName}✅\n💲 Costo: $${costToUse.toFixed(2)} MXN\n🔑 Código / Respuesta: ${cleanMsg}\n🎉 Estado: Completado\n\n━━━━━━━━━━━━━━\n🌐 MegaUnlockPhone`;
            enqueueWhatsApp('private', privateMsg, history[idx].userId);
          } else if (isRejected) {
            const privateMsg = `❌ SERVICIO RECHAZADO\n\n🆔 Orden: #${history[idx].orderId}\n📱 IMEI: ${history[idx].imei || 'N/A'}\n🔧 Servicio: ${history[idx].serviceName}❌\n❗ Motivo: ${cleanMsg}\n💲 Costo: $${costToUse.toFixed(2)} MXN\n💸 Créditos: Reembolsados\n🎉 Estado: Rechazado\n\n━━━━━━━━━━━━━━\n🌐 MegaUnlockPhone`;
            enqueueWhatsApp('private', privateMsg, history[idx].userId);
          }

          const usersList = readDB('users.json') || [];
          const orderUser = usersList.find(u => String(u.id) === String(history[idx].userId));
          const userNameDisplay = (orderUser && orderUser.role === 'admin') ? 'Admin #1' : (orderUser?.username || history[idx].username);

          const statusStr = isSuccess ? '✅ Completado' : '❌ Rechazado';
          const adminMsg = `🔄 ACTUALIZACIÓN AUTOMÁTICA\n━━━━━━━━━━━━━━━━━━━━━━\n#️⃣ Orden: #${history[idx].orderId}\n👨🏽💻 Usuario: ${userNameDisplay}\n🔧 Servicio: ${history[idx].serviceName}\n📊 Estado: ${statusStr}\n🔑 Respuesta: ${cleanMsg}\n🖥️ Servidor: ${getServerDisplayName(serverId)}\n━━━━━━━━━━━━━━━━━━━━━━\n🛡️ MegaUnlockPhone`;
          enqueueWhatsAppAdmin(adminMsg);

          const groupMsg = `🔄 ACTUALIZACIÓN DE ORDEN\n━━━━━━━━━━━━━━━━━━━━━━\n#️⃣ Orden: #${history[idx].orderId}\n👨🏽💻 Cliente: ID ${history[idx].userId}\n🔧 Servicio: ${history[idx].serviceName}\n📊 Estado: ${statusStr}\n🖥️ Servidor: ${getServerDisplayName(serverId)}\n━━━━━━━━━━━━━━━━━━━━━━\n🌐 MegaUnlockPhone`;
          enqueueWhatsApp('group', groupMsg);
        }
      }
    }

    if (updatedCount > 0) {
      writeDB('history.json', history);
      incrementHistoryVersion();
    }

    const freshUsers = readDB('users.json') || [];
    const freshCurrentUser = freshUsers.find(u => String(u.id) === String(req.user.id)) || req.user;
    const currentCredits = getUserCredit(freshCurrentUser, serverId);

    const remainingPending = history.filter(o => {
      const isMatchingServer = String(o.serverId || '1') === serverId;
      const isPending = o.status === 'pending';
      const isOwnerOrAdmin = req.user.role === 'admin' || String(o.userId) === String(req.user.id);
      return isMatchingServer && isPending && isOwnerOrAdmin && o.orderId && o.orderId !== 'Error';
    }).length;

    const serverHistory = history.filter(h => (h.serverId || '1') === serverId);
    const visibleHistory = req.user.role === 'admin' ? serverHistory : serverHistory.filter(h => h.userId === req.user.id);

    return res.json({
      success: true,
      updated: updatedCount > 0,
      count: updatedCount,
      updatedOrderIds,
      remainingPending,
      userCredits: currentCredits,
      history: visibleHistory
    });
  } catch (err) {
    console.error('Error in syncPendingOrders:', err);
    return res.status(500).json({ error: 'Error al sincronizar pedidos pendientes', details: err.message });
  }
};

exports.createAutoBackup = createAutoBackup;
