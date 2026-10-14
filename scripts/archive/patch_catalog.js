const fs = require('fs');
let code = fs.readFileSync('src/controllers/catalogController.js', 'utf8');

code = code.replace(
    "const allWarnings = readDB('service_warnings.json') || {};\n      const serverWarnings = allWarnings['server' + serverId] || {};",
    "const allWarnings = readDB('service_warnings.json') || {};\n      const serverWarnings = allWarnings['server' + serverId] || {};\n      const allDisabledImei = readDB('disabled_imei.json') || {};\n      const serverDisabledImei = allDisabledImei['server' + serverId] || [];"
);

code = code.replace(
    "if (serverWarnings[realServiceId]) {",
    "if (serverDisabledImei.includes(realServiceId)) {\n             service._NO_IMEI = true;\n          }\n\n          if (serverWarnings[realServiceId]) {"
);

fs.writeFileSync('src/controllers/catalogController.js', code);
