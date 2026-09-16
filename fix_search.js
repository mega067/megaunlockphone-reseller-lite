const fs = require('fs');

// Fix server.js
let serverContent = fs.readFileSync('server.js', 'utf8');
serverContent = serverContent.replace(
    'results.push({ id: serviceid, name: s.SERVICENAME || s.SERVICE_NAME || s.name, price: resellerCost });',
    'results.push({ id: serviceid, name: s.SERVICENAME || s.SERVICE_NAME || s.name, price: isNaN(resellerCost) ? 0 : resellerCost });'
);
fs.writeFileSync('server.js', serverContent);

// Fix whatsappBot.js
let botContent = fs.readFileSync('whatsappBot.js', 'utf8');
botContent = botContent.replace(
    'msgTxt += `${prefix} ID: ${r.id} | ${r.name} | 💰 $${r.price.toFixed(2)} MXN\\n\\n`;',
    'const validPrice = (typeof r.price === "number" && !isNaN(r.price)) ? r.price : 0;\n                        msgTxt += `${prefix} ID: ${r.id} | ${r.name} | 💰 $${validPrice.toFixed(2)} MXN\\n\\n`;'
);
fs.writeFileSync('whatsappBot.js', botContent);

