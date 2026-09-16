const fs = require('fs');

const serverId = '3';
const query = 'tsm';
const q = query.toLowerCase();

const fullList = JSON.parse(fs.readFileSync('catalog_server_3.json', 'utf8'));
const list = fullList.SUCCESS[0].LIST;

const settingsDb = JSON.parse(fs.readFileSync('data/settings.json', 'utf8'));
const prices = fs.existsSync('data/prices_3.json') ? JSON.parse(fs.readFileSync('data/prices_3.json', 'utf8')) : {};
const customPrices = fs.existsSync('data/custom_prices.json') ? (JSON.parse(fs.readFileSync('data/custom_prices.json', 'utf8'))['server3'] || {}) : {};
const userCustomPrices = fs.existsSync('data/user_custom_prices.json') ? (JSON.parse(fs.readFileSync('data/user_custom_prices.json', 'utf8'))['server3'] || {}) : {};

const req = { user: { id: 1, markup: 0 } };
const settings = settingsDb.server3;

const results = [];
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
        
        let resellerCost;
        const ucp = userCustomPrices[serviceid] && userCustomPrices[serviceid][req.user.id];
        if (ucp && ucp.resellerPrice !== undefined) {
          resellerCost = parseFloat(ucp.resellerPrice);
        } else if (customPrices[serviceid]) {
          resellerCost = parseFloat(customPrices[serviceid].resellerPrice);
        } else {
          const activeMarkup = (req.user.markup !== null && req.user.markup !== undefined && !isNaN(req.user.markup)) ? parseFloat(req.user.markup) : parseFloat(settings.resellerMarkup || 0);
          resellerCost = Math.ceil(realCost + activeMarkup);
        }
        
        results.push({ id: serviceid, name: s.SERVICENAME || s.SERVICE_NAME || s.name, price: resellerCost });
      }
    }
  }
}

results.sort((a, b) => a.price - b.price);
const topResults = results.slice(0, 20);

console.log("Found:", topResults.length);
try {
    let msgTxt = "";
    topResults.forEach((r, i) => {
        msgTxt += `ID: ${r.id} | ${r.name} | $${r.price.toFixed(2)}\n`;
    });
    console.log(msgTxt);
} catch (e) {
    console.error("Format Error:", e);
}
