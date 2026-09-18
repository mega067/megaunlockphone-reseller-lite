const axios = require('axios');
const https = require('https');
const http = require('http');
const { readDB, writeDB } = require('../db');
const { getServerId, getServerSettings, callGsmThemeApi } = require('../helpers');
const { catalogCache, CACHE_TTL } = require('../cacheManager');

const ipv4Agent = new https.Agent({ family: 4 });

exports.getProducts = async (req, res) => {
  const settingsDb = readDB('settings.json');
  const serverId = getServerId(req);
  const settings = getServerSettings(settingsDb, serverId);
  
  if (!settings || !settings.username || !settings.apiaccesskey) {
    return res.status(400).json({ error: 'Settings misconfigured for Server ' + serverId });
  }

  const { apiaccesskey, username, endpoint, resellerMarkup, clientMarkup } = settings;
  const targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';

  try {
    let mergedList = {};
    let hasSuccess = false;
    
    const serverKey = 'server' + serverId;
    const forceSync = req.query.forceSync === 'true';
    const now = Date.now();
    
    // Use Cache if valid
    if (!forceSync && catalogCache[serverKey].data && (now - catalogCache[serverKey].lastFetch < CACHE_TTL)) {
       mergedList = JSON.parse(JSON.stringify(catalogCache[serverKey].data));
       hasSuccess = true;
    } else {
      // Fetch from External API
      if (serverId === '1' || serverId === '3') {
        const paramsImei = new URLSearchParams();
        paramsImei.append('username', username);
        paramsImei.append('apiaccesskey', apiaccesskey);
        paramsImei.append('action', 'imeiservicelist');
        paramsImei.append('requestformat', 'JSON');

        const paramsServer = new URLSearchParams();
        paramsServer.append('username', username);
        paramsServer.append('apiaccesskey', apiaccesskey);
        paramsServer.append('action', 'serverservicelist');
        paramsServer.append('requestformat', 'JSON');

        const [resImei, resServer] = await Promise.all([
          axios.post(targetUrl, paramsImei.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' },
            timeout: 15000, httpsAgent: ipv4Agent
          }).catch(e => ({ data: { ERROR: e.message } })),
          axios.post(targetUrl, paramsServer.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' },
            timeout: 15000, httpsAgent: ipv4Agent
          }).catch(e => ({ data: { ERROR: e.message } }))
        ]);

        if (resImei.data && resImei.data.SUCCESS && resImei.data.SUCCESS[0] && resImei.data.SUCCESS[0].LIST) {
          mergedList = { ...resImei.data.SUCCESS[0].LIST };
          for (const g in mergedList) {
            for (const s in mergedList[g].SERVICES || {}) {
               const t = mergedList[g].SERVICES[s].SERVICETYPE;
               mergedList[g].SERVICES[s]._SERVICE_TYPE = t ? t.toUpperCase() : 'IMEI';
            }
          }
          hasSuccess = true;
        }
        
        if (resServer.data && resServer.data.SUCCESS && resServer.data.SUCCESS[0] && resServer.data.SUCCESS[0].LIST) {
          const serverList = resServer.data.SUCCESS[0].LIST;
          for (const g in serverList) {
            for (const s in serverList[g].SERVICES || {}) {
              serverList[g].SERVICES[s]._SERVICE_TYPE = 'SERVER';
            }
            if (mergedList[g]) {
               mergedList[g].SERVICES = { ...mergedList[g].SERVICES, ...serverList[g].SERVICES };
            } else {
               mergedList[g] = serverList[g];
            }
          }
          hasSuccess = true;
        }
      } else {
        // SERVER 2: GSM THEME API
        const [resImei, resServer] = await Promise.all([
          callGsmThemeApi(targetUrl, 'imeiservicelist', null, username, apiaccesskey).catch(e => ({ data: { ERROR: e.message } })),
          callGsmThemeApi(targetUrl, 'serverservicelist', null, username, apiaccesskey).catch(e => ({ data: { ERROR: e.message } }))
        ]);

        if (resImei.data && resImei.data.SUCCESS && resImei.data.SUCCESS[0] && resImei.data.SUCCESS[0].LIST) {
          mergedList = { ...resImei.data.SUCCESS[0].LIST };
          for (const g in mergedList) {
            for (const s in mergedList[g].SERVICES || {}) {
               mergedList[g].SERVICES[s]._SERVICE_TYPE = 'IMEI';
            }
          }
          hasSuccess = true;
        }
        
        if (resServer.data && resServer.data.SUCCESS && resServer.data.SUCCESS[0] && resServer.data.SUCCESS[0].LIST) {
          const serverList = resServer.data.SUCCESS[0].LIST;
          for (const g in serverList) {
            for (const s in serverList[g].SERVICES || {}) {
              serverList[g].SERVICES[s]._SERVICE_TYPE = 'SERVER';
            }
            if (mergedList[g]) {
               mergedList[g].SERVICES = { ...mergedList[g].SERVICES, ...serverList[g].SERVICES };
            } else {
               mergedList[g] = serverList[g];
            }
          }
          hasSuccess = true;
        }
      }

      if (hasSuccess) {
        catalogCache[serverKey].data = JSON.parse(JSON.stringify(mergedList));
        catalogCache[serverKey].lastFetch = Date.now();
      }
    }

    if (hasSuccess) {
      const priceCache = {};
      const allCustomPrices = readDB('custom_prices.json') || {};
      const customPrices = allCustomPrices['server' + serverId] || {};
      const users = readDB('users.json') || [];
      const dbUser = users.find(u => u.id === req.user.id) || req.user;
      
      const allUserCustomPrices = readDB('user_custom_prices.json') || {};
      const serverUserCustomPrices = allUserCustomPrices['server' + serverId] || {};
      
      for (const groupKey in mergedList) {
        for (const serviceKey in mergedList[groupKey].SERVICES || {}) {
          const service = mergedList[groupKey].SERVICES[serviceKey];
          const realServiceId = service.SERVICEID || service.serviceid || serviceKey;
          
          const disabledDb = readDB('disabled_services.json') || {};
          const disabledServicesForServer = disabledDb['server' + serverId] || [];
          if (disabledServicesForServer.includes(realServiceId)) {
             service._DISABLED = true;
          }
          const exchangeRate = parseFloat(settingsDb.exchangeRate || 17.60);
          const rate = serverId === '3' ? 1 : exchangeRate;
          const realCredit = parseFloat(service.CREDIT || '0') * rate;
          priceCache[realServiceId] = realCredit;
          
          let resellerCost, clientPrice;
          const isManager = req.user.role === 'admin' || req.user.role === 'colaborador';
          const ucp = !isManager && serverUserCustomPrices[realServiceId] && serverUserCustomPrices[realServiceId][req.user.id];

          if (customPrices[realServiceId]) {
            service._CUSTOM_RESELLER = customPrices[realServiceId].resellerPrice != null ? customPrices[realServiceId].resellerPrice.toString() : '';
            service._CUSTOM_CLIENT = customPrices[realServiceId].clientPrice != null ? customPrices[realServiceId].clientPrice.toString() : '';
          } else {
            delete service._CUSTOM_RESELLER;
            delete service._CUSTOM_CLIENT;
          }

          if (ucp && ucp.resellerPrice !== undefined) {
            resellerCost = parseFloat(ucp.resellerPrice);
            clientPrice = ucp.clientPrice !== undefined ? parseFloat(ucp.clientPrice) : 
                (customPrices[realServiceId] ? parseFloat(customPrices[realServiceId].clientPrice) : Math.ceil(resellerCost + parseFloat(clientMarkup)));
          } else if (customPrices[realServiceId]) {
            resellerCost = parseFloat(customPrices[realServiceId].resellerPrice);
            clientPrice = parseFloat(customPrices[realServiceId].clientPrice);
          } else {
            const activeMarkup = (dbUser.markup !== null && dbUser.markup !== undefined && !isNaN(dbUser.markup)) ? parseFloat(dbUser.markup) : parseFloat(resellerMarkup);
            resellerCost = Math.ceil(realCredit + activeMarkup);
            clientPrice = Math.ceil(resellerCost + parseFloat(clientMarkup));
          }
          
          // Enforce minimum price (must be at least API cost)
          if (isNaN(resellerCost) || resellerCost < realCredit) resellerCost = Math.ceil(realCredit);
          if (isNaN(clientPrice) || clientPrice < resellerCost) clientPrice = resellerCost;

          service.CREDIT = resellerCost.toString();
          service._RESELLER_COST = resellerCost.toString();
          service._CLIENT_PRICE = clientPrice.toString();
          if (req.user.role === 'admin' || req.user.role === 'colaborador') {
            service._REAL_COST = realCredit.toFixed(2);
          }
        }
      }

      writeDB('prices_' + serverId + '.json', priceCache);
      
      const finalData = { SUCCESS: [ { LIST: mergedList } ] };
      return res.json(finalData);
    } else {
      if (serverId === '1') {
         return res.status(200).json({ error_msg: 'El servidor de la API está bloqueando la conexión por su Firewall (Error 403). Contacta a su soporte para que permitan la conexión.' });
      }
      return res.status(200).json({ error_msg: 'Fallo al obtener el catálogo de servicios de la API.' });
    }
  } catch (error) {
    console.error('API Proxy Error:', error.message);
    if (serverId === '1' && error.message && error.message.includes('403')) {
        return res.status(200).json({ error_msg: 'El servidor de la API está bloqueando la conexión por su Firewall (Error 403).' });
    }
    return res.status(200).json({ error_msg: 'Error interno del servidor al conectar con la API.' });
  }
};
