const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// Replace /api/me
code = code.replace(
  /app\.get\('\/api\/me', requireAuth, \(req, res\) => \{[\s\S]*?res\.json\(\{ username: user\.username, role: user\.role, credits: user\.credits \}\);\n\}\);/,
  `app.get('/api/me', requireAuth, (req, res) => {
  const users = readDB('users.json') || [];
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const serverId = getServerId(req);
  const credits = serverId === '2' ? user.credits_2 : user.credits_1;
  sessions[req.headers['authorization'].split(' ')[1]] = user;
  res.json({ username: user.username, role: user.role, credits: credits });
});`
);

const parts = code.split('// API proxy endpoint for Products');
const afterProducts = parts[1].split('// Submit Order to API');
if(parts.length === 2 && afterProducts.length === 2) {
  const newProducts = `
app.get('/api/products', requireAuth, async (req, res) => {
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

    if (serverId === '1') {
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
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion/1.0' },
          timeout: 15000
        }).catch(e => ({ data: { ERROR: e.message } })),
        axios.post(targetUrl, paramsServer.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion/1.0' },
          timeout: 15000
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
      // Server 2 GSM Theme API
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
      const priceCache = {};
      const allCustomPrices = readDB('custom_prices.json') || {};
      const customPrices = allCustomPrices['server' + serverId] || {};
      
      for (const groupKey in mergedList) {
        for (const serviceId in mergedList[groupKey].SERVICES || {}) {
          const service = mergedList[groupKey].SERVICES[serviceId];
          const realCredit = parseFloat(service.CREDIT || '0') * 17.60;
          priceCache[serviceId] = realCredit;
          
          let resellerCost, clientPrice;
          if (customPrices[serviceId]) {
            resellerCost = parseFloat(customPrices[serviceId].resellerPrice);
            clientPrice = parseFloat(customPrices[serviceId].clientPrice);
          } else {
            resellerCost = Math.ceil(realCredit + resellerMarkup);
            clientPrice = Math.ceil(resellerCost + clientMarkup);
          }
          service._RESELLER_COST = resellerCost;
          service._CLIENT_PRICE = clientPrice;
        }
      }

      writeDB('products_cache_' + serverId + '.json', priceCache);
      writeDB('dhru_cache_' + serverId + '.json', { SUCCESS: [{ LIST: mergedList }] });
      
      let productsArray = [];
      for (const groupKey in mergedList) {
        for (const serviceId in mergedList[groupKey].SERVICES || {}) {
          const service = mergedList[groupKey].SERVICES[serviceId];
          productsArray.push({
            GROUPNAME: mergedList[groupKey].GROUPNAME,
            SERVICEID: service.SERVICEID,
            SERVICENAME: service.SERVICENAME,
            TIME: service.TIME,
            _RESELLER_COST: service._RESELLER_COST,
            _CLIENT_PRICE: service._CLIENT_PRICE,
            _SERVICE_TYPE: service._SERVICE_TYPE,
            REQUIRES_IMEI: service.requires_imei || '1'
          });
        }
      }

      return res.json(productsArray);
    } else {
      const cacheData = readDB('dhru_cache_' + serverId + '.json');
      if (cacheData) {
         return res.json([]);
      }
      return res.status(500).json({ error: 'Failed to fetch from API', details: 'No cache fallback available' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

`;

  code = parts[0] + '// API proxy endpoint for Products\n' + newProducts + '\n// Submit Order to API' + afterProducts[1];
  fs.writeFileSync('server.js', code);
  console.log('Products API updated.');
} else {
  console.log('Failed to split code');
}
