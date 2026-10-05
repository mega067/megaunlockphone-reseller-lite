const axios = require('axios');
const https = require('https');
const { readDB, writeDB } = require('../db');
const { getServerId, getServerSettings, callGsmThemeApi, getServerDisplayName, calculateMarkup, calculateGroupMarkup } = require('../helpers');
const { catalogCache, incrementCatalogVersion } = require('../cacheManager');
const { enqueueWhatsApp } = require('../whatsappQueue');
const { logRecharge } = require('../history'); // Assuming logRecharge is exported, though it might need to be imported properly

const ipv4Agent = new https.Agent({ family: 4 });

exports.searchProducts = async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query' });
  
  const serverId = getServerId(req);
  const settingsDb = readDB('settings.json') || {};
  const settings = getServerSettings(settingsDb, serverId);
  const prices = readDB('prices_' + serverId + '.json') || {};
  const allCustomPrices = readDB('custom_prices.json') || {};
  const customPrices = allCustomPrices['server' + serverId] || {};
  const allUserCustomPrices = readDB('user_custom_prices.json') || {};
  const serverUserCustomPrices = allUserCustomPrices['server' + serverId] || {};
  const allGroupMarkups = readDB('group_markups.json') || {};
  const serverGroupMarkups = allGroupMarkups['server' + serverId] || {};
  
  const serverKey = 'server' + serverId;
  let list = (catalogCache[serverKey] && catalogCache[serverKey].data) ? catalogCache[serverKey].data : null;

  if (!list) {
    if (settings && settings.username && settings.apiaccesskey) {
        const { apiaccesskey, username, endpoint } = settings;
        let targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';
        try {
            let mergedList = {};
            let hasSuccess = false;
            if (serverId === '1' || serverId === '3') {
                const p1 = new URLSearchParams(); p1.append('username', username); p1.append('apiaccesskey', apiaccesskey); p1.append('action', 'imeiservicelist'); p1.append('requestformat', 'JSON');
                const p2 = new URLSearchParams(); p2.append('username', username); p2.append('apiaccesskey', apiaccesskey); p2.append('action', 'serverservicelist'); p2.append('requestformat', 'JSON');
                const [r1, r2] = await Promise.all([
                    axios.post(targetUrl, p1.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' }, timeout: 15000, httpsAgent: ipv4Agent }).catch(e=>({})),
                    axios.post(targetUrl, p2.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' }, timeout: 15000, httpsAgent: ipv4Agent }).catch(e=>({}))
                ]);
                if (r1.data && r1.data.SUCCESS && r1.data.SUCCESS[0] && r1.data.SUCCESS[0].LIST) {
                    mergedList = { ...r1.data.SUCCESS[0].LIST }; hasSuccess = true;
                }
                if (r2.data && r2.data.SUCCESS && r2.data.SUCCESS[0] && r2.data.SUCCESS[0].LIST) {
                    const sList = r2.data.SUCCESS[0].LIST;
                    for (const g in sList) {
                        if (mergedList[g]) mergedList[g].SERVICES = { ...mergedList[g].SERVICES, ...sList[g].SERVICES };
                        else mergedList[g] = sList[g];
                    }
                    hasSuccess = true;
                }
            } else {
                const [r1, r2] = await Promise.all([
                    callGsmThemeApi(targetUrl, 'imeiservicelist', null, username, apiaccesskey).catch(e=>({})),
                    callGsmThemeApi(targetUrl, 'serverservicelist', null, username, apiaccesskey).catch(e=>({}))
                ]);
                if (r1.data && r1.data.SUCCESS && r1.data.SUCCESS[0] && r1.data.SUCCESS[0].LIST) {
                    mergedList = { ...r1.data.SUCCESS[0].LIST }; hasSuccess = true;
                }
                if (r2.data && r2.data.SUCCESS && r2.data.SUCCESS[0] && r2.data.SUCCESS[0].LIST) {
                    const sList = r2.data.SUCCESS[0].LIST;
                    for (const g in sList) {
                        if (mergedList[g]) mergedList[g].SERVICES = { ...mergedList[g].SERVICES, ...sList[g].SERVICES };
                        else mergedList[g] = sList[g];
                    }
                    hasSuccess = true;
                }
            }
            if (hasSuccess) {
                catalogCache[serverKey].data = JSON.parse(JSON.stringify(mergedList));
                catalogCache[serverKey].lastFetch = Date.now();
                list = catalogCache[serverKey].data;
            } else {
                list = {};
            }
        } catch (e) {
            list = {};
        }
    } else {
        list = {};
    }
  }
  
  if (query === 'debug') {
      return res.json({ 
          results: [{ 
              id: '999', 
              name: `DEBUG: serverKey=${serverKey}, list_exists=${!!list}, groups=${list ? Object.keys(list).length : 0}`, 
              price: 0 
          }] 
      });
  }
  
  const results = [];
  const q = query.toLowerCase();
  
  for (const g in list) {
    if (list[g].SERVICES) {
      const srvs = Array.isArray(list[g].SERVICES) ? list[g].SERVICES : Object.values(list[g].SERVICES);
      for (const s of srvs) {
        if (!s) continue;
        const name = (s.SERVICENAME || s.SERVICE_NAME || s.name || '').toLowerCase();
        if (name.includes(q)) {
          const serviceid = s.SERVICEID || s.serviceid;
          
          let realCost = prices[serviceid] !== undefined ? prices[serviceid] : null;
          if (realCost === null) {
            const exchangeRate = parseFloat(settingsDb.exchangeRate || 17.60);
            const rate = serverId === '3' ? 1 : exchangeRate;
            realCost = parseFloat(s.CREDIT || '0') * rate;
          }
          
          const groupMarkupObj = serverGroupMarkups[g];
          let resellerCost;
          let activeMarkup = parseFloat(settings.resellerMarkup || 0);

          if (req.body.userId) {
            const users = readDB('users.json') || [];
            const reqUser = users.find(u => String(u.id) === String(req.body.userId));
            if (reqUser) {
              const ucp = serverUserCustomPrices[serviceid] && serverUserCustomPrices[serviceid][reqUser.id];
              if (ucp && ucp.resellerPrice !== undefined) {
                resellerCost = parseFloat(ucp.resellerPrice);
              } else if (customPrices[serviceid]) {
                resellerCost = parseFloat(customPrices[serviceid].resellerPrice);
              } else {
                let markupVal = 0;
                if (reqUser.markup !== null && reqUser.markup !== undefined && !isNaN(reqUser.markup)) {
                  markupVal = parseFloat(reqUser.markup);
                } else {
                  let rMarkup = calculateGroupMarkup(realCost, groupMarkupObj, false, settings);
                  if (rMarkup === null) rMarkup = calculateMarkup(realCost, settings.resellerTier1, settings.resellerTier2, settings.resellerTier3);
                  markupVal = rMarkup;
                }
                resellerCost = Math.ceil(realCost + markupVal);
              }
            }
          }
          
          if (resellerCost === undefined) {
             if (customPrices[serviceid]) {
                resellerCost = parseFloat(customPrices[serviceid].resellerPrice);
             } else {
                let defaultMarkup = calculateGroupMarkup(realCost, groupMarkupObj, false, settings);
                if (defaultMarkup === null) defaultMarkup = calculateMarkup(realCost, settings.resellerTier1, settings.resellerTier2, settings.resellerTier3);
                resellerCost = Math.ceil(realCost + defaultMarkup);
             }
          }

          results.push({ id: serviceid, name: s.SERVICENAME || s.SERVICE_NAME || s.name, price: resellerCost });
        }
      }
    }
  }
  
  results.sort((a, b) => a.price - b.price);
  return res.json({ results: results.slice(0, 20) });
};

exports.getCatalog = async (req, res) => {
  const serverId = getServerId(req);
  const settingsDb = readDB('settings.json') || {};
  const settings = getServerSettings(settingsDb, serverId);
  const serverKey = 'server' + serverId;
  let list = (catalogCache[serverKey] && catalogCache[serverKey].data) ? catalogCache[serverKey].data : null;
  
  if (!list) {
    if (settings && settings.username && settings.apiaccesskey) {
        const { apiaccesskey, username, endpoint } = settings;
        let targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';
        try {
            let mergedList = {};
            let hasSuccess = false;
            if (serverId === '1' || serverId === '3' || serverId === '2') {
                const [r1, r2] = await Promise.all([
                    callGsmThemeApi(targetUrl, 'imeiservicelist', null, username, apiaccesskey).catch(e=>({})),
                    callGsmThemeApi(targetUrl, 'serverservicelist', null, username, apiaccesskey).catch(e=>({}))
                ]);
                if (r1.data && r1.data.SUCCESS && r1.data.SUCCESS[0] && r1.data.SUCCESS[0].LIST) {
                    mergedList = { ...r1.data.SUCCESS[0].LIST }; hasSuccess = true;
                }
                if (r2.data && r2.data.SUCCESS && r2.data.SUCCESS[0] && r2.data.SUCCESS[0].LIST) {
                    const sList = r2.data.SUCCESS[0].LIST;
                    for (const g in sList) {
                        if (mergedList[g]) mergedList[g].SERVICES = { ...mergedList[g].SERVICES, ...sList[g].SERVICES };
                        else mergedList[g] = sList[g];
                    }
                    hasSuccess = true;
                }
            }
            if (hasSuccess) {
                if (!catalogCache[serverKey]) catalogCache[serverKey] = {};
                catalogCache[serverKey].data = JSON.parse(JSON.stringify(mergedList));
                catalogCache[serverKey].lastFetch = Date.now();
                list = catalogCache[serverKey].data;
            } else list = {};
        } catch (e) {
            console.error('[API/BOT/CATALOG] API Fetch Error:', e.message, e.response?.data);
            list = {};
        }
    } else {
        console.error('[API/BOT/CATALOG] Missing settings to fetch! Settings object:', settings);
        list = {};
    }
  }if (!list || Object.keys(list).length === 0) {
      console.error('[API/BOT/CATALOG] Catalog empty! ServerId:', serverId, 'Settings:', !!settings, 'Username:', settings?.username, 'Endpoint:', settings?.endpoint);
      return res.json({ catalog: [] });
  }
  
  const catalogArray = [];
  for (const g in list) {
      if (list[g].GROUP_NAME && list[g].SERVICES) {
          const servicesArray = [];
          for (const sid in list[g].SERVICES) {
              servicesArray.push(list[g].SERVICES[sid]);
          }
          catalogArray.push({
              GROUP_NAME: list[g].GROUP_NAME,
              SERVICES: servicesArray
          });
      }
  }
  return res.json({ catalog: catalogArray });
};

exports.getGroups = async (req, res) => {
  const serverId = getServerId(req);
  const serverKey = 'server' + serverId;
  let list = (catalogCache[serverKey] && catalogCache[serverKey].data) ? catalogCache[serverKey].data : null;
  if (!list) return res.json({ groups: [] });
  const groups = [];
  for (const g in list) {
    if (list[g].GROUP_NAME) {
      groups.push(list[g].GROUP_NAME);
    }
  }
  res.json({ groups });
};

exports.getProductsByGroup = async (req, res) => {
  const { groupName, productId } = req.body;
  const serverId = getServerId(req);
  const serverKey = 'server' + serverId;
  let list = (catalogCache[serverKey] && catalogCache[serverKey].data) ? catalogCache[serverKey].data : null;
  if (!list) return res.json({ products: [] });
  
  const allCustomPrices = readDB('custom_prices.json') || {};
  const customPrices = allCustomPrices[serverKey] || {};
  const pricesApi = readDB('prices_' + serverId + '.json') || {};

  let products = [];
  for (const g in list) {
    if (list[g].SERVICES) {
      if (groupName && list[g].GROUP_NAME !== groupName) continue;
      
      for (const sid in list[g].SERVICES) {
        let s = list[g].SERVICES[sid];
        
        if (productId && String(s.SERVICEID) !== String(productId)) continue;

        const realCost = pricesApi[s.SERVICEID] || s.CREDIT || 0;
        let resellerPrice = realCost;
        let clientPrice = realCost;
        if (customPrices[s.SERVICEID]) {
            resellerPrice = customPrices[s.SERVICEID].resellerPrice;
            clientPrice = customPrices[s.SERVICEID].clientPrice;
        } else {
            resellerPrice = parseFloat(s._CLIENT_PRICE || s.CREDIT);
            clientPrice = resellerPrice;
        }
        products.push({
            id: s.SERVICEID,
            name: s.SERVICENAME,
            realCost: realCost,
            resellerPrice: resellerPrice,
            clientPrice: clientPrice
        });
        
        if (productId) break;
      }
      if (productId && products.length > 0) break;
      if (groupName && list[g].GROUP_NAME === groupName) break;
    }
  }
  res.json({ products });
};

exports.setPrice = async (req, res) => {
  const { serviceid, resellerPrice, clientPrice } = req.body;
  const serverId = getServerId(req);
  const serverKey = 'server' + serverId;
  
  if (!serviceid || resellerPrice === undefined || clientPrice === undefined) {
      return res.status(400).json({ error: 'Missing parameters' });
  }

  const allCustomPrices = readDB('custom_prices.json') || {};
  const pricesApi = readDB('prices_' + serverId + '.json') || {};
  if (!allCustomPrices[serverKey]) allCustomPrices[serverKey] = {};

  const rp = parseFloat(resellerPrice);
  const cp = parseFloat(clientPrice);
  const realCost = pricesApi[serviceid] || 0;
  
  if (rp < realCost || cp < realCost) {
      return res.json({ error: `El precio no puede ser menor al costo API ($${realCost}).` });
  }
  
  allCustomPrices[serverKey][serviceid] = {
      resellerPrice: rp,
      clientPrice: cp
  };
  
  writeDB('custom_prices.json', allCustomPrices);
  incrementCatalogVersion();
  res.json({ success: true });
};

exports.getServiceInfo = async (req, res) => {
  const { serviceid } = req.body;
  if (!serviceid) return res.status(400).json({ error: 'Missing serviceid' });
  
  const serverId = getServerId(req);
  const serverKey = 'server' + serverId;
  let list = (catalogCache[serverKey] && catalogCache[serverKey].data) ? catalogCache[serverKey].data : null;
  
  if (!list) {
    const settingsDb = readDB('settings.json') || {};
    const settings = getServerSettings(settingsDb, serverId);
    if (settings && settings.username && settings.apiaccesskey) {
        const { apiaccesskey, username, endpoint } = settings;
        let targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';
        try {
            let mergedList = {};
            let hasSuccess = false;
            if (serverId === '1' || serverId === '3') {
                const p1 = new URLSearchParams(); p1.append('username', username); p1.append('apiaccesskey', apiaccesskey); p1.append('action', 'imeiservicelist'); p1.append('requestformat', 'JSON');
                const p2 = new URLSearchParams(); p2.append('username', username); p2.append('apiaccesskey', apiaccesskey); p2.append('action', 'serverservicelist'); p2.append('requestformat', 'JSON');
                const [r1, r2] = await Promise.all([
                    axios.post(targetUrl, p1.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }).catch(e=>({})),
                    axios.post(targetUrl, p2.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }).catch(e=>({}))
                ]);
                if (r1.data && r1.data.SUCCESS && r1.data.SUCCESS[0] && r1.data.SUCCESS[0].LIST) {
                    mergedList = { ...r1.data.SUCCESS[0].LIST }; hasSuccess = true;
                }
                if (r2.data && r2.data.SUCCESS && r2.data.SUCCESS[0] && r2.data.SUCCESS[0].LIST) {
                    const sList = r2.data.SUCCESS[0].LIST;
                    for (const g in sList) {
                        if (mergedList[g]) mergedList[g].SERVICES = { ...mergedList[g].SERVICES, ...sList[g].SERVICES };
                        else mergedList[g] = sList[g];
                    }
                    hasSuccess = true;
                }
            } else {
                const [r1, r2] = await Promise.all([
                    callGsmThemeApi(targetUrl, 'imeiservicelist', null, username, apiaccesskey).catch(e=>({})),
                    callGsmThemeApi(targetUrl, 'serverservicelist', null, username, apiaccesskey).catch(e=>({}))
                ]);
                if (r1.data && r1.data.SUCCESS && r1.data.SUCCESS[0] && r1.data.SUCCESS[0].LIST) {
                    mergedList = { ...r1.data.SUCCESS[0].LIST }; hasSuccess = true;
                }
                if (r2.data && r2.data.SUCCESS && r2.data.SUCCESS[0] && r2.data.SUCCESS[0].LIST) {
                    const sList = r2.data.SUCCESS[0].LIST;
                    for (const g in sList) {
                        if (mergedList[g]) mergedList[g].SERVICES = { ...mergedList[g].SERVICES, ...sList[g].SERVICES };
                        else mergedList[g] = sList[g];
                    }
                    hasSuccess = true;
                }
            }
            if (hasSuccess) {
                if (!catalogCache[serverKey]) catalogCache[serverKey] = {};
                catalogCache[serverKey].data = JSON.parse(JSON.stringify(mergedList));
                list = catalogCache[serverKey].data;
            } else {
                list = {};
            }
        } catch (e) {
            list = {};
        }
    } else {
        list = {};
    }
  }
  
  for (const g in list) {
    if (list[g].SERVICES) {
      const srvs = Array.isArray(list[g].SERVICES) ? list[g].SERVICES : Object.values(list[g].SERVICES);
      const s = srvs.find(x => x && (x.SERVICEID == serviceid || x.serviceid == serviceid));
      if (s) {
        const settingsDb = readDB('settings.json') || {};
        const settings = getServerSettings(settingsDb, serverId);
        const prices = readDB('prices_' + serverId + '.json') || {};
        const allCustomPrices = readDB('custom_prices.json') || {};
        const customPrices = allCustomPrices['server' + serverId] || {};
        const allUserCustomPrices = readDB('user_custom_prices.json') || {};
        const serverUserCustomPrices = allUserCustomPrices['server' + serverId] || {};
        
        const allGroupMarkups = readDB('group_markups.json') || {};
        const serverGroupMarkups = allGroupMarkups['server' + serverId] || {};
        const groupMarkupObj = serverGroupMarkups[g];

        let realCost = prices[serviceid] !== undefined ? prices[serviceid] : null;
        if (realCost === null) {
          const exchangeRate = parseFloat(settingsDb.exchangeRate || 17.60);
          const rate = serverId === '3' ? 1 : exchangeRate;
          realCost = parseFloat(s.CREDIT || '0') * rate;
        }

        let resellerCost;
        const ucp = serverUserCustomPrices[serviceid] && serverUserCustomPrices[serviceid][req.user.id];
        if (ucp && ucp.resellerPrice !== undefined) {
          resellerCost = parseFloat(ucp.resellerPrice);
        } else if (customPrices[serviceid]) {
          resellerCost = parseFloat(customPrices[serviceid].resellerPrice);
        } else {
          let activeMarkup = 0;
          if (req.user.markup !== null && req.user.markup !== undefined && String(req.user.markup).trim() !== '' && !isNaN(req.user.markup)) {
            activeMarkup = parseFloat(req.user.markup);
          } else {
            let rMarkup = calculateGroupMarkup(realCost, groupMarkupObj, false, settings);
            if (rMarkup === null) rMarkup = calculateMarkup(realCost, settings.resellerTier1, settings.resellerTier2, settings.resellerTier3);
            activeMarkup = rMarkup;
          }
          resellerCost = Math.ceil(realCost + activeMarkup);
        }
        
        const requiresImei = s.REQUIRES_IMEI === "1" || s.requires_imei === "1" || s.requires_imei === true || (s.service_type && s.service_type.toLowerCase() === 'imei');
        const requiresSn = s.REQUIRES_SN === "1" || s.requires_sn === "1" || s.requires_sn === true || (s.service_type && s.service_type.toLowerCase() === 'sn');
        let serviceType = requiresImei ? 'IMEI' : (requiresSn ? 'SN' : 'DATA');
        
        let customField = null;
        let customArr = s['Requires.Custom'] || s.requires_custom || s['REQUIRES.CUSTOM'];
        if (customArr && Array.isArray(customArr) && customArr.length > 0) {
            customField = customArr[0].fieldname || customArr[0].name;
        }
        
        const advancedParams = {
            QNT: s.QNT || "0",
            MINQNT: s.MINQNT || "1",
            MAXQNT: s.MAXQNT || "9999",
            CUSTOM: s.CUSTOM || {},
            IMEINAME: s.IMEINAME || s.CUSTOM_IMEI || null
        };

        return res.json({ id: serviceid, name: s.SERVICENAME || s.SERVICE_NAME || s.name, price: resellerCost, type: serviceType, customField, ...advancedParams });
      }
    }
  }
  return res.status(404).json({ error: 'Service not found' });
};

exports.getSaldo = async (req, res) => {
  try {
    const { botSecret, userId } = req.body;
    if (botSecret !== 'MEGA_BOT_SECRET_2026') return res.status(403).json({ error: 'Unauthorized bot' });

    const users = readDB('users.json') || [];
    const user = users.find(u => u.id === userId);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized user' });

    const settingsDb = readDB('settings.json') || {};
    let balances = {};

    for (let sId of ['1', '2', '3']) {
      const conf = settingsDb['server' + sId];
      if (!conf || !conf.apiaccesskey) {
        balances[sId] = { error: 'No configurado' };
        continue;
      }
      
      let targetUrl = conf.endpoint;
      if (!targetUrl) {
          targetUrl = sId === '3' ? 'https://megaunlockphone-panel.alwaysdata.net/api/index.php' : 'https://latamgsm.com/dhru/';
      }
      if (!targetUrl.includes('/api/')) {
        targetUrl = targetUrl.endsWith('/') ? `${targetUrl}api/index.php` : `${targetUrl}/api/index.php`;
      } else if (targetUrl.endsWith('/api/')) {
        targetUrl += 'index.php';
      }

      try {
        const params = new URLSearchParams();
        params.append('username', conf.username);
        params.append('apiaccesskey', conf.apiaccesskey);
        params.append('action', 'accountinfo');
        params.append('requestformat', 'JSON');
        
        const response = await axios.post(targetUrl, params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' },
          timeout: 10000
        });
        
        const exRate = parseFloat(settingsDb.exchangeRate || 17.60);
        const rate = sId === '3' ? 1 : exRate;
        const real = parseFloat(response.data?.SUCCESS?.[0]?.AccountInfo?.creditraw || 0) * rate;
        
        let cedido = 0;
        users.forEach(u => {
          if (u.role !== 'admin' && u['credits_' + sId]) {
            cedido += parseFloat(u['credits_' + sId]);
          }
        });
        
        balances[sId] = { real, cedido, disp: real - cedido };
      } catch (e) {
        balances[sId] = { error: 'Error de conexión' };
      }
    }

    res.json({ balances });
  } catch (globalError) {
    res.status(500).json({ error: 'Crash Server: ' + globalError.message, stack: globalError.stack });
  }
};

exports.addMoney = async (req, res) => {
  try {
    const { botSecret, adminId, resellerId, serverId, amount } = req.body;
    if (botSecret !== 'MEGA_BOT_SECRET_2026') return res.status(403).json({ error: 'Unauthorized bot' });

    let users = readDB('users.json') || [];
    const adminUser = users.find(u => u.id === adminId && u.role === 'admin');
    if (!adminUser) return res.status(403).json({ error: 'Unauthorized admin' });

    const resellerIdx = users.findIndex(u => u.id === resellerId && u.role !== 'admin');
    if (resellerIdx === -1) return res.status(404).json({ error: 'Reseller not found' });

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount === 0) return res.status(400).json({ error: 'Monto inválido' });

    const creditKey = 'credits_' + serverId;
    let currentCredit = parseFloat(users[resellerIdx][creditKey] || 0);
    
    if (currentCredit + numAmount < 0) return res.status(400).json({ error: 'El usuario no tiene suficiente saldo para descontar esa cantidad.' });

    users[resellerIdx][creditKey] = currentCredit + numAmount;
    
    writeDB('users.json', users);
    
    let msgToReseller = '';
    let groupMsg = '';
    if (numAmount > 0) {
        msgToReseller = `💰 *¡RECARGA EXITOSA!*\n\nTu administrador ha agregado *+$${numAmount.toFixed(2)} MXN* a tu saldo en ${getServerDisplayName(serverId)}.\n\n💳 *Saldo actual (${getServerDisplayName(serverId)}):* $${users[resellerIdx][creditKey].toFixed(2)} MXN\n\n_¡A desbloquear se ha dicho!_ 🚀`;
        groupMsg = `💰 *RECARGA APROBADA*\n━━━━━━━━━━━━━━━━━━━━━━\n👮 *Admin:* ${adminUser.username}\n👤 *Revendedor:* ID ${users[resellerIdx].id}\n🏢 *Servidor:* ${getServerDisplayName(serverId)}\n💲 *Monto:* +$${numAmount.toFixed(2)} MXN\n━━━━━━━━━━━━━━━━━━━━━━`;
    } else {
        msgToReseller = `📉 *REDUCCIÓN DE SALDO*\n\nTu administrador ha descontado *-$${Math.abs(numAmount).toFixed(2)} MXN* de tu saldo en ${getServerDisplayName(serverId)}.\n\n💳 *Saldo actual (${getServerDisplayName(serverId)}):* $${users[resellerIdx][creditKey].toFixed(2)} MXN`;
        groupMsg = `📉 *RETIRO DE SALDO*\n━━━━━━━━━━━━━━━━━━━━━━\n👮 *Admin:* ${adminUser.username}\n👤 *Revendedor:* ID ${users[resellerIdx].id}\n🏢 *Servidor:* ${getServerDisplayName(serverId)}\n💲 *Monto:* -$${Math.abs(numAmount).toFixed(2)} MXN\n━━━━━━━━━━━━━━━━━━━━━━`;
    }
    enqueueWhatsApp('private', msgToReseller, users[resellerIdx].id);
    enqueueWhatsApp('group', groupMsg);

    if (numAmount > 0 && typeof logRecharge === 'function') {
      logRecharge(users[resellerIdx].id, users[resellerIdx].username, numAmount, 'MANUAL_BOT', adminUser.username, serverId);
    }

    res.json({ success: true, newBalance: users[resellerIdx][creditKey], resellerName: users[resellerIdx].username });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.getServiceInfoDirect = async (req, res) => {
  const { botSecret, userId, serverId, serviceid } = req.body;
  if (botSecret !== 'MEGA_BOT_SECRET_2026') return res.status(403).json({ error: 'Unauthorized bot' });

  const users = readDB('users.json') || [];
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(403).json({ error: 'Unauthorized user' });

  const settingsDb = readDB('settings.json') || {};
  let targetUrl, username, apiaccesskey, markup = 0;

  if (serverId === '3') {
    const conf = settingsDb.server3 || {};
    targetUrl = conf.endpoint;
    if (!targetUrl) return res.status(404).json({ error: 'Servidor no configurado' });
    username = conf.username;
    apiaccesskey = conf.apiaccesskey;
    if (!targetUrl.includes('/api/')) {
      targetUrl = targetUrl.endsWith('/') ? `${targetUrl}api/index.php` : `${targetUrl}/api/index.php`;
    } else if (targetUrl.endsWith('/api/')) {
      targetUrl += 'index.php';
    }
    markup = user.role === 'client' ? (conf.clientMarkup || 0) : (conf.resellerMarkup || 0);
  } else {
    const conf = serverId === '2' ? settingsDb.server2 : settingsDb.server1;
    if (!conf) return res.status(404).json({ error: 'Servidor no configurado' });
    targetUrl = conf.endpoint;
    username = conf.username;
    apiaccesskey = conf.apiaccesskey;
    if (!targetUrl) targetUrl = 'https://latamgsm.com/dhru/';
    if (!targetUrl.includes('/api/')) {
      targetUrl = targetUrl.endsWith('/') ? `${targetUrl}api/index.php` : `${targetUrl}/api/index.php`;
    } else if (targetUrl.endsWith('/api/')) {
      targetUrl += 'index.php';
    }
    markup = user.role === 'client' ? (conf.clientMarkup || 0) : (conf.resellerMarkup || 0);
  }

  try {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('apiaccesskey', apiaccesskey);
    params.append('action', 'serviceinfo');
    params.append('requestformat', 'JSON');
    params.append('parameters', `<PARAMETERS><SERVICEID>${serviceid}</SERVICEID></PARAMETERS>`);
    
    const response = await axios.post(targetUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' },
      timeout: 10000
    });
    
    if (response.data.ERROR) return res.status(400).json({ error: response.data.ERROR[0]?.MESSAGE || 'Error API' });
    
    const sInfo = response.data.SUCCESS?.[0]?.LIST;
    if (!sInfo) return res.status(404).json({ error: 'Servicio no encontrado' });

    const exchangeRate = parseFloat(settingsDb.exchangeRate || 17.60);
    const rate = serverId === '3' ? 1 : exchangeRate;
    
    const basePrice = parseFloat(sInfo.CREDIT || 0);
    const finalPrice = (basePrice + markup) * rate;

    let customField = null;
    let customArr = sInfo['Requires.Custom'] || sInfo.requires_custom || sInfo['REQUIRES.CUSTOM'];
    if (customArr && Array.isArray(customArr) && customArr.length > 0) {
      customField = customArr[0].fieldname || customArr[0].name;
    }

    res.json({
      id: sInfo.SERVICEID,
      name: sInfo.SERVICENAME,
      price: finalPrice,
      type: sInfo.TYPE || 'IMEI',
      customField: customField
    });
  } catch (e) {
    res.status(500).json({ error: 'Fallo al comunicarse con el proveedor' });
  }
};
