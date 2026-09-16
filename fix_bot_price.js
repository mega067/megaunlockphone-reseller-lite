const fs = require('fs');
let botContent = fs.readFileSync('whatsappBot.js', 'utf8');
botContent = botContent.replace(
    'const validPrice = (typeof r.price === "number" && !isNaN(r.price)) ? r.price : 0;',
    'const parsedPrice = parseFloat(r.price); const validPrice = !isNaN(parsedPrice) ? parsedPrice : 0;'
);
fs.writeFileSync('whatsappBot.js', botContent);
