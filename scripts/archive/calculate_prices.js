const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

function readDB(file) {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function writeDB(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

function calculateSmartPrice(apiCost, isClient) {
  let markup = 0;
  
  if (apiCost === 0) {
    markup = isClient ? 20 : 10; // Free services remain free, but charge a bit for management in MXN
  } else if (apiCost < 20) {
    markup = isClient ? (apiCost * 0.40) : (apiCost * 0.20);
  } else if (apiCost < 100) {
    markup = isClient ? (apiCost * 0.30) : (apiCost * 0.15);
  } else if (apiCost < 300) {
    markup = isClient ? (apiCost * 0.20) : (apiCost * 0.10);
  } else {
    markup = isClient ? (apiCost * 0.15) : (apiCost * 0.08);
  }
  
  // Ensure a minimum profit margin in MXN
  if (markup < 5 && apiCost > 0) markup = 5;
  
  return apiCost + markup;
}

const servers = ['1', '2', '3'];
let allCustomPrices = readDB('custom_prices.json') || {};
let updatedCount = 0;

for (const serverId of servers) {
  const priceCache = readDB(`prices_${serverId}.json`);
  if (!priceCache) continue;

  const serverKey = 'server' + serverId;
  if (!allCustomPrices[serverKey]) allCustomPrices[serverKey] = {};

  for (const [serviceId, realCostStr] of Object.entries(priceCache)) {
    const apiCost = parseFloat(realCostStr);
    
    const resellerPrice = calculateSmartPrice(apiCost, false);
    const clientPrice = calculateSmartPrice(apiCost, true);
    
    allCustomPrices[serverKey][serviceId] = {
      resellerPrice: parseFloat(resellerPrice.toFixed(2)),
      clientPrice: parseFloat(clientPrice.toFixed(2))
    };
    updatedCount++;
  }
}

writeDB('custom_prices.json', allCustomPrices);

console.log(`Script finished. Updated ${updatedCount} prices across ${servers.length} servers.`);
