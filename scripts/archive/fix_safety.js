const fs = require('fs');

let serverContent = fs.readFileSync('server.js', 'utf8');

// For /api/bot/search
serverContent = serverContent.replace(
    /resellerCost = Math\.ceil\(realCost \+ activeMarkup\);\s*\}\s*results\.push\(\{ id: serviceid/g,
    'resellerCost = Math.ceil(realCost + activeMarkup);\n          }\n          if (isNaN(resellerCost) || resellerCost < realCost) resellerCost = Math.ceil(realCost);\n          results.push({ id: serviceid'
);

// For /api/bot/order (processOrder)
serverContent = serverContent.replace(
    /resellerCost = Math\.ceil\(realCost \+ activeMarkup\);\s*\}\s*let clientPrice = 0;/g,
    'resellerCost = Math.ceil(realCost + activeMarkup);\n    }\n    if (isNaN(resellerCost) || resellerCost < realCost) resellerCost = Math.ceil(realCost);\n    let clientPrice = 0;'
);

// For /api/bot/service_details
serverContent = serverContent.replace(
    /resellerCost = Math\.ceil\(realCost \+ activeMarkup\);\s*\}\s*const requiresImei =/g,
    'resellerCost = Math.ceil(realCost + activeMarkup);\n        }\n        if (isNaN(resellerCost) || resellerCost < realCost) resellerCost = Math.ceil(realCost);\n        const requiresImei ='
);

fs.writeFileSync('server.js', serverContent);
