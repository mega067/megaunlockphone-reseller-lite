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

exports.toggleAllowFree = (req, res) => {
  const { serviceid, allowed } = req.body;
  const serverId = getServerId(req);
  if (!serviceid) return res.status(400).json({ error: 'Falta serviceid' });

  const allowedDb = readDB('allowed_free_services.json') || {};
  const serverKey = 'server' + serverId;
  if (!allowedDb[serverKey]) allowedDb[serverKey] = [];

  const sid = serviceid.toString();
  if (allowed) {
    if (!allowedDb[serverKey].includes(sid)) {
      allowedDb[serverKey].push(sid);
    }
  } else {
    allowedDb[serverKey] = allowedDb[serverKey].filter(id => id !== sid);
  }

  writeDB('allowed_free_services.json', allowedDb);
  incrementCatalogVersion();
  res.json({ success: true, allowedFree: allowed });
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

exports.getCustomPrices = (req, res) => {
  const serverId = getServerId(req);
  const serverKey = 'server' + serverId;
  const allCustomPrices = readDB('custom_prices.json') || {};
  res.json({ success: true, serverKey, customPrices: allCustomPrices[serverKey] || {} });
};

exports.getMarketSuggestions = (req, res) => {
  const serverId = getServerId(req);
  const prices = readDB('prices_' + serverId + '.json') || {};
  const allCustomPrices = readDB('custom_prices.json') || {};
  const serverKey = 'server' + serverId;
  const serverCustom = allCustomPrices[serverKey] || {};

  const suggestions = {};
  for (const [sid, costVal] of Object.entries(prices)) {
    const cost = parseFloat(costVal) || 0;
    if (cost <= 0) continue;
    let reseller = 0;
    let retail = 0;
    if (cost <= 20) {
      reseller = Math.round(cost + 10);
      retail = 50;
    } else if (cost <= 40) {
      reseller = Math.round(cost + 12);
      retail = Math.round(cost + 35);
    } else if (cost <= 80) {
      reseller = Math.round(cost + 16);
      retail = Math.round(cost + 50);
    } else if (cost <= 160) {
      reseller = Math.round(cost + 25);
      retail = Math.round(cost + 70);
    } else if (cost <= 320) {
      reseller = Math.round(cost + 52);
      retail = 399;
    } else if (cost <= 500) {
      reseller = Math.round(cost + 87);
      retail = 666;
    } else if (cost <= 800) {
      reseller = Math.round(cost + 158);
      retail = 1050;
    } else if (cost <= 1400) {
      reseller = Math.round(cost + 200);
      retail = Math.round(cost + 420);
    } else {
      reseller = Math.round(cost * 1.15);
      retail = Math.round(cost * 1.35);
    }
    suggestions[sid] = {
      realCost: cost,
      suggestedReseller: reseller,
      suggestedRetail: retail,
      currentCustom: serverCustom[sid] || null
    };
  }
  res.json({ success: true, count: Object.keys(suggestions).length, suggestions });
};
