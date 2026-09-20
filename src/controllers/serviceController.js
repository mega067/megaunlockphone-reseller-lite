const { readDB, writeDB } = require('../db');
const { getServerId } = require('../helpers');
const { incrementCatalogVersion } = require('../cacheManager');

exports.toggleService = (req, res) => {
  const { serviceid, disabled } = req.body;
  const serverId = getServerId(req);
  if (!serviceid) return res.status(400).json({ error: 'Falta serviceid' });

  const disabledDb = readDB('disabled_services.json') || {};
  if (!disabledDb['server' + serverId]) disabledDb['server' + serverId] = [];
  
  if (disabled) {
    if (!disabledDb['server' + serverId].includes(serviceid.toString())) {
      disabledDb['server' + serverId].push(serviceid.toString());
    }
  } else {
    disabledDb['server' + serverId] = disabledDb['server' + serverId].filter(id => id !== serviceid.toString());
  }

  writeDB('disabled_services.json', disabledDb);
  incrementCatalogVersion();
  res.json({ success: true, disabled });
};

exports.setProductPrice = (req, res) => {
  const { serviceid, resellerPrice, clientPrice, bulk } = req.body;
  const serverId = getServerId(req);
  const allCustomPrices = readDB('custom_prices.json') || {};
  const serverKey = 'server' + serverId;
  const prices = readDB('prices_' + serverId + '.json') || {};
  if (!allCustomPrices[serverKey]) allCustomPrices[serverKey] = {};

  if (bulk && Array.isArray(bulk)) {
    for (const item of bulk) {
      if (item.serviceId && item.resellerPrice !== undefined && item.clientPrice !== undefined) {
        const rp = parseFloat(item.resellerPrice);
        const cp = parseFloat(item.clientPrice);
        
        if (isNaN(rp) || isNaN(cp)) continue; // Skip empty/invalid prices in bulk mode
        
        const realCost = prices[item.serviceId] || 0;
        if (rp < realCost || cp < realCost) {
          return res.status(400).json({ error: `El precio para ${item.serviceId} no puede ser menor al costo API ($${realCost}).` });
        }
        allCustomPrices[serverKey][item.serviceId] = {
          resellerPrice: rp,
          clientPrice: cp
        };
      }
    }
    writeDB('custom_prices.json', allCustomPrices);
    incrementCatalogVersion();
    return res.json({ success: true, count: bulk.length });
  }

  if (!serviceid || resellerPrice === undefined || clientPrice === undefined) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const rp = parseFloat(resellerPrice);
  const cp = parseFloat(clientPrice);
  
  if (isNaN(rp) || isNaN(cp)) {
     return res.status(400).json({ error: 'Precio inválido. Usa el botón de restablecer (auto) si deseas borrar el precio.' });
  }

  const realCost = prices[serviceid] || 0;
  if (rp < realCost || cp < realCost) {
    return res.status(400).json({ error: `El precio no puede ser menor al costo API ($${realCost}).` });
  }

  allCustomPrices[serverKey][serviceid] = {
    resellerPrice: rp,
    clientPrice: cp
  };

  writeDB('custom_prices.json', allCustomPrices);
  incrementCatalogVersion();
  res.json({ success: true, prices: allCustomPrices[serverKey][serviceid] });
};

exports.deleteProductPrice = (req, res) => {
  const { serviceid } = req.params;
  const serverId = getServerId(req);
  const allCustomPrices = readDB('custom_prices.json') || {};
  const serverKey = 'server' + serverId;

  if (allCustomPrices[serverKey] && allCustomPrices[serverKey][serviceid]) {
    delete allCustomPrices[serverKey][serviceid];
    writeDB('custom_prices.json', allCustomPrices);
    incrementCatalogVersion();
  }
  res.json({ success: true });
};

exports.getUserProductPrices = (req, res) => {
  const { serviceid } = req.params;
  const serverId = getServerId(req);
  const allUserCustomPrices = readDB('user_custom_prices.json') || {};
  
  const serverPrices = allUserCustomPrices['server' + serverId] || {};
  const servicePrices = serverPrices[serviceid] || {};
  
  res.json(servicePrices);
};

exports.setUserProductPrices = (req, res) => {
  const { serviceid } = req.params;
  const { userPrices } = req.body;
  const serverId = getServerId(req);
  
  if (!userPrices || typeof userPrices !== 'object') {
    return res.status(400).json({ error: 'Invalid userPrices object' });
  }

  const allUserCustomPrices = readDB('user_custom_prices.json') || {};
  const serverKey = 'server' + serverId;
  
  if (!allUserCustomPrices[serverKey]) {
    allUserCustomPrices[serverKey] = {};
  }
  
  allUserCustomPrices[serverKey][serviceid] = userPrices;
  
  writeDB('user_custom_prices.json', allUserCustomPrices);
  incrementCatalogVersion();
  res.json({ success: true });
};
