const axios = require('axios');
const https = require('https');
const http = require('http');
const { readDB, writeDB } = require('../db');
const { getServerId, getServerSettings, callGsmThemeApi, calculateMarkup, calculateGroupMarkup } = require('../helpers');
const { catalogCache, CACHE_TTL } = require('../cacheManager');

const ipv4Agent = new https.Agent({ family: 4 });

// Pre-populate in-memory cache from persistent disk cache on startup
['1', '2', '3'].forEach(sId => {
  try {
    const diskCached = readDB('catalog_cache_server' + sId + '.json');
    if (diskCached && typeof diskCached === 'object' && Object.keys(diskCached).length > 0) {
      catalogCache['server' + sId].data = diskCached;
      catalogCache['server' + sId].lastFetch = Date.now();
    }
  } catch (e) {}
});

exports.getProducts = async (req, res) => {
  const settingsDb = readDB('settings.json');
  const serverId = getServerId(req);
  const settings = getServerSettings(settingsDb, serverId);
  
  if (!settings || !settings.username || !settings.apiaccesskey) {
    return res.status(400).json({ error: 'Settings misconfigured for Server ' + serverId });
  }

  const { apiaccesskey, username, endpoint, resellerTier1, resellerTier2, resellerTier3, clientTier1, clientTier2, clientTier3 } = settings;
  const targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';

  try {
    let mergedList = {};
    let hasSuccess = false;
    
    const serverKey = 'server' + serverId;
    const forceSync = req.query.forceSync === 'true';
    const now = Date.now();
    
    // 1. Use Cache if valid
    if (!forceSync && catalogCache[serverKey].data && (now - catalogCache[serverKey].lastFetch < CACHE_TTL)) {
       mergedList = JSON.parse(JSON.stringify(catalogCache[serverKey].data));
       hasSuccess = true;
    } else {
      // 2. Fetch from External API
      try {
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

          const paramsFile = new URLSearchParams();
          paramsFile.append('username', username);
          paramsFile.append('apiaccesskey', apiaccesskey);
          paramsFile.append('action', 'fileservicelist');
          paramsFile.append('requestformat', 'JSON');

          const [resImei, resServer, resFile] = await Promise.all([
            axios.post(targetUrl, paramsImei.toString(), {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' },
              timeout: 15000, httpsAgent: ipv4Agent
            }).catch(e => ({ data: { ERROR: e.message } })),
            axios.post(targetUrl, paramsServer.toString(), {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' },
              timeout: 15000, httpsAgent: ipv4Agent
            }).catch(e => ({ data: { ERROR: e.message } })),
            axios.post(targetUrl, paramsFile.toString(), {
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

          if (resFile.data && resFile.data.SUCCESS && resFile.data.SUCCESS[0] && resFile.data.SUCCESS[0].LIST) {
            const fileList = resFile.data.SUCCESS[0].LIST;
            for (const g in fileList) {
              for (const s in fileList[g].SERVICES || {}) {
                fileList[g].SERVICES[s]._SERVICE_TYPE = 'FILE';
              }
              if (mergedList[g]) {
                 mergedList[g].SERVICES = { ...mergedList[g].SERVICES, ...fileList[g].SERVICES };
              } else {
                 mergedList[g] = fileList[g];
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
      } catch (fetchErr) {
        console.warn(`[Catalog] External API error for Server ${serverId}:`, fetchErr.message);
      }

      if (hasSuccess && Object.keys(mergedList).length > 0) {
        catalogCache[serverKey].data = JSON.parse(JSON.stringify(mergedList));
        catalogCache[serverKey].lastFetch = Date.now();
        // Persist to disk so restarts or future API errors never drop catalog
        try {
          writeDB('catalog_cache_server' + serverId + '.json', mergedList);
        } catch (e) {
          console.error('Error saving disk catalog cache:', e.message);
        }
      }
    }

    // 3. Fallback Safety Net: If external API failed, recover from memory or disk cache!
    if (!hasSuccess || Object.keys(mergedList).length === 0) {
      if (catalogCache[serverKey].data && Object.keys(catalogCache[serverKey].data).length > 0) {
        mergedList = JSON.parse(JSON.stringify(catalogCache[serverKey].data));
        hasSuccess = true;
        console.warn(`[Catalog] External API unavailable for Server ${serverId}. Using in-memory fallback.`);
      } else {
        try {
          const diskData = readDB('catalog_cache_server' + serverId + '.json');
          if (diskData && typeof diskData === 'object' && Object.keys(diskData).length > 0) {
            mergedList = JSON.parse(JSON.stringify(diskData));
            catalogCache[serverKey].data = JSON.parse(JSON.stringify(diskData));
            catalogCache[serverKey].lastFetch = Date.now();
            hasSuccess = true;
            console.warn(`[Catalog] External API unavailable for Server ${serverId}. Restored from persistent disk cache.`);
          }
        } catch (e) {
          console.error('Error reading disk catalog cache:', e.message);
        }
      }
    }

    if (hasSuccess && Object.keys(mergedList).length > 0) {
      const priceCache = {};
      const fallbackPrices = readDB('prices_' + serverId + '.json') || {};
      const allCustomPrices = readDB('custom_prices.json') || {};
      const customPrices = allCustomPrices['server' + serverId] || {};
      const users = readDB('users.json') || [];
      const dbUser = users.find(u => u.id === req.user.id) || req.user;
      
      const allUserCustomPrices = readDB('user_custom_prices.json') || {};
      const serverUserCustomPrices = allUserCustomPrices['server' + serverId] || {};
      const allGroupMarkups = readDB('group_markups.json') || {};
      const serverGroupMarkups = allGroupMarkups['server' + serverId] || {};
      const allWarnings = readDB('service_warnings.json') || {};
      const serverWarnings = allWarnings['server' + serverId] || {};
      const allDisabledImei = readDB('disabled_imei.json') || {};
      const serverDisabledImei = allDisabledImei['server' + serverId] || [];
      const disabledDb = readDB('disabled_services.json') || {};
      const disabledServicesForServer = disabledDb['server' + serverId] || [];
      const allowedFreeDb = readDB('allowed_free_services.json') || {};
      const allowedFreeForServer = allowedFreeDb['server' + serverId] || [];
      
      const allCustomGroups = readDB('custom_groups.json') || {};
      const serverCustomGroups = allCustomGroups['server' + serverId] || {};

      for (const groupKey in mergedList) {
        const groupObj = mergedList[groupKey];
        const groupName = groupObj.GROUPNAME || groupKey;
        const groupMarkupObj = serverGroupMarkups[groupName] || serverGroupMarkups[groupKey];
        
        if (groupMarkupObj) {
            if (groupMarkupObj.isHot) groupObj._IS_HOT = true;
            if (groupMarkupObj.logo) groupObj._LOGO = groupMarkupObj.logo;
        }
        
        for (const serviceKey in mergedList[groupKey].SERVICES || {}) {
          const service = mergedList[groupKey].SERVICES[serviceKey];
          const realServiceId = service.SERVICEID || service.serviceid || serviceKey;
          
          const assignedCustomGroup = serverCustomGroups[realServiceId] || 
                                      serverCustomGroups[String(realServiceId)] || 
                                      (service.SERVICEID && serverCustomGroups[String(service.SERVICEID)]) || 
                                      (serviceKey && serverCustomGroups[String(serviceKey)]);

          service._ORIGINAL_GROUP = groupName;

          if (assignedCustomGroup) {
              service._CUSTOM_GROUP = assignedCustomGroup;
              const customMarkup = serverGroupMarkups[service._CUSTOM_GROUP];
              if (customMarkup) {
                  if (customMarkup.isHot) service._IS_HOT_OVERRIDE = true;
                  if (customMarkup.logo) service._LOGO_OVERRIDE = customMarkup.logo;
              }
          }
          
          if (disabledServicesForServer.includes(String(realServiceId))) {
             service._DISABLED = true;
          }

          if (allowedFreeForServer.includes(String(realServiceId))) {
             service._ALLOW_FREE = true;
          }
          
          if (serverDisabledImei.includes(String(realServiceId))) {
             service._NO_IMEI = true;
          }

          if (serverWarnings[realServiceId]) {
            service._WARNING = serverWarnings[realServiceId];
          } else if (service.desc || service.features || service.info || service.descripcion || service.description || service.Descripción || service.Descripcion) {
            service._WARNING = service.desc || service.features || service.info || service.descripcion || service.description || service.Descripción || service.Descripcion;
          }

          const exchangeRate = parseFloat(settingsDb.exchangeRate || 17.60);
          const rate = serverId === '3' ? 1 : exchangeRate;
          const rawCreditStr = service.CREDIT ?? service.credit ?? service.CREDITS ?? service.credits ?? service.Credits ?? service.PRICE ?? service.price ?? service.Price ?? service.AMOUNT ?? service.amount ?? service.Amount ?? service.COST ?? service.cost ?? service.Cost ?? '0';
          let realCredit = (parseFloat(rawCreditStr) || 0) * rate;

          // If upstream returns 0/empty, check if we have a known cached real cost for this service
          if (realCredit <= 0 && fallbackPrices[realServiceId]) {
            const cachedCost = parseFloat(fallbackPrices[realServiceId]) || 0;
            if (cachedCost > 0) realCredit = cachedCost;
          }
          
          if (realCredit > 0) {
            priceCache[realServiceId] = realCredit;
          } else if (fallbackPrices[realServiceId] && parseFloat(fallbackPrices[realServiceId]) > 0) {
            priceCache[realServiceId] = parseFloat(fallbackPrices[realServiceId]);
          }

          // Los precios y comisiones se calculan estrictamente con el grupo real del proveedor (groupMarkupObj).
          // El grupo custom (_CUSTOM_GROUP) es exclusivamente para organización visual y búsqueda.
          const activeGroupMarkup = groupMarkupObj;

          let resellerCost = 0, clientPrice = 0;
          let isNoPrice = false;

          const isManager = req.user.role === 'admin' || req.user.role === 'colaborador';
          const isReseller = req.user.role === 'reseller';
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
            
            let cMarkup = calculateGroupMarkup(resellerCost, activeGroupMarkup, true, settings);
            if (cMarkup === null) cMarkup = calculateMarkup(resellerCost, clientTier1, clientTier2, clientTier3);
            
            clientPrice = ucp.clientPrice !== undefined ? parseFloat(ucp.clientPrice) :
                (customPrices[realServiceId] ? parseFloat(customPrices[realServiceId].clientPrice) : Math.ceil(resellerCost + cMarkup));
          } else if (customPrices[realServiceId]) {
            resellerCost = parseFloat(customPrices[realServiceId].resellerPrice);
            clientPrice = parseFloat(customPrices[realServiceId].clientPrice);
          } else if (realCredit > 0) {
            let activeMarkup = 0;
            if (dbUser.markup !== null && dbUser.markup !== undefined && String(dbUser.markup).trim() !== '' && !isNaN(dbUser.markup)) {
              activeMarkup = parseFloat(dbUser.markup);
            } else {
              let rMarkup = calculateGroupMarkup(realCredit, activeGroupMarkup, false, settings);
              if (rMarkup === null) rMarkup = calculateMarkup(realCredit, resellerTier1, resellerTier2, resellerTier3);
              activeMarkup = rMarkup;
            }
            resellerCost = Math.ceil(realCredit + activeMarkup);
            
            let cMarkup = calculateGroupMarkup(resellerCost, activeGroupMarkup, true, settings);
            if (cMarkup === null) cMarkup = calculateMarkup(resellerCost, clientTier1, clientTier2, clientTier3);
            clientPrice = Math.ceil(resellerCost + cMarkup);
          } else if (service._ALLOW_FREE) {
            isNoPrice = false;
            resellerCost = 0;
            clientPrice = 0;
          } else {
            isNoPrice = true;
            resellerCost = 0;
            clientPrice = 0;
          }
          
          if (!isNoPrice) {
            // Enforce minimum price (must be at least API cost)
            if (isNaN(resellerCost) || (realCredit > 0 && resellerCost < realCredit)) resellerCost = Math.ceil(realCredit);
            if (isNaN(clientPrice) || (clientPrice < resellerCost && resellerCost > 0)) clientPrice = resellerCost;
          }

          if (service._ALLOW_FREE) {
            service._IS_FREE = true;
          } else {
            delete service._IS_FREE;
          }
          service._NO_PRICE = isNoPrice;
          service._RESELLER_COST = resellerCost.toString();
          service._CLIENT_PRICE = clientPrice.toString();

          // User role pricing display:
          // Admins, colaboradores and resellers see resellerCost as primary credit.
          // Clients and unauthenticated guests ("sin cuenta") see clientPrice!
          const displayPrice = (isReseller || isManager) ? resellerCost : clientPrice;
          service.CREDIT = displayPrice.toString();

          if (isManager) {
            service._REAL_COST = realCredit.toFixed(2);
          }
        }
      }

      // DigitalPass filtering (Streaming, AI, Digital accounts, Gaming, etc.)
      const isDigitalPass = req.query.digitalPass === 'true' || req.headers['x-digital-pass'] === 'true';
      if (isDigitalPass) {
        const streamingKeywords = [
          'stream', 'streaming', 'netflix', 'disney', 'prime video', 'amazon prime', 'youtube', 'paramount', 'max', 'hbo', 
          'spotify', 'apple music', 'crunchyroll', 'deezer', 'tidal', 'vix', 'magis', 'magistv', 'iptv', 
          'chatgpt', 'openai', 'claude', 'midjourney', 'canva', 'capcut', 'gemini', 'copilot', 'inteligencia artificial',
          'plex', 'tele latino', 'flujo tv', 'oleada tv', 'stella tv', 'cine-moon', 'optimus tv', 'emby',
          'playstation', 'xbox', 'game pass', 'free fire', 'pubg', 'roblox', 'steam', 'nintendo',
          'combo plus', 'star+', 'star plus', 'directv', 'dgo', 'viki', 'rakuten', 'plex pass', 'office 365', 'windows key',
          'antivirus', 'vpn', 'nordvpn', 'surfshark', 'expressvpn', 'duolingo'
        ];

        // Specific keywords regex matching full words or exact brands
        const streamingRegex = new RegExp(
          '\\b(streaming|netflix|disney|prime|amazon|youtube|paramount|max|hbo|spotify|apple music|crunchyroll|deezer|tidal|vix|magis|iptv|chatgpt|openai|claude|midjourney|canva|capcut|gemini|copilot|ai pro|ia pro|plex|emby|playstation|xbox|nintendo|steam|roblox|free fire|duolingo|vpn|office 365)\\b',
          'i'
        );

        const nonStreamingBlacklist = [
          'bypass', 'icloud', 'frp', 'imei repair', 'cpid', 'unlock', 'liberacion', 'motorola', 'samsung unlock',
          'xiaomi qualcomm', 'xiaomi mediatek', 't-mobile', 'tracfone', 'at&t', 'att usa', 'cricket usa',
          'esim data plan', 'tiempo aire', 'recarga saldo', 'recargas saldo', 'recargas axios',
          'registro líneas', 'jailbreak', 'seguridad email', 'mac os email', 'repair fix auth',
          'check apple', 'fmi off', 'clean carrier', 'sim mágico', 'sim magico', 'ramdisk',
          'mdm', 'carrier', 'blacklist', 'gsma', 'server token', 'auth tool', 'networks', 'network',
          'apple id locked', 'serial apple', 'a12a13', 'ihello', 'viapass', 'rootmagisk', 'xinzhizao',
          'reseller policy', 'vodafone', 'claro', 'o2 | tesco'
        ];

        const filteredList = {};
        for (const gKey in mergedList) {
          const gObj = mergedList[gKey];
          const gName = (gObj.GROUPNAME || gKey).toLowerCase();

          // If entire group is a phone carrier or unlock service, skip unless custom group assigned
          const isGroupBlacklisted = nonStreamingBlacklist.some(bl => gName.includes(bl));

          const matchedServices = {};
          for (const sKey in gObj.SERVICES || {}) {
            const sObj = gObj.SERVICES[sKey];
            const sName = (sObj.SERVICENAME || sObj.service || '').toLowerCase();
            const customG = (sObj._CUSTOM_GROUP || '').toLowerCase();

            // If user explicitly marked this service in custom_groups.json or assigned it to custom group
            const hasCustomMatch = customG && (streamingRegex.test(customG) || customG.includes('digital') || customG.includes('pass') || customG.includes('stream'));
            
            // Check whitelist match
            const matchesKeyword = streamingRegex.test(sName) || (!isGroupBlacklisted && streamingKeywords.some(kw => gName.includes(kw) || sName.includes(kw)));
            const isServiceBlacklisted = nonStreamingBlacklist.some(bl => sName.includes(bl));

            if (hasCustomMatch || (matchesKeyword && !isServiceBlacklisted && !isGroupBlacklisted)) {
              matchedServices[sKey] = sObj;
            }
          }

          if (Object.keys(matchedServices).length > 0) {
            filteredList[gKey] = {
              ...gObj,
              SERVICES: matchedServices
            };
          }
        }
        mergedList = filteredList;
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
