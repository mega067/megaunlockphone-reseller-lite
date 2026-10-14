const fs = require('fs');
let code = fs.readFileSync('src/controllers/adminController.js', 'utf8');

code = code.replace(
    'exchangeRate: settings.exchangeRate || 17.60,\n    creditCushion: settings.creditCushion || 0\n  };',
    'exchangeRate: settings.exchangeRate || 17.60,\n    creditCushion: settings.creditCushion || 0,\n    disableImei: settings.disableImei || false\n  };'
);

code = code.replace(
    'const { server1, server2, server3, exchangeRate, creditCushion } = req.body;',
    'const { server1, server2, server3, exchangeRate, creditCushion, disableImei } = req.body;'
);

code = code.replace(
    'settings.creditCushion = parseFloat(creditCushion) || 0;\n  }',
    'settings.creditCushion = parseFloat(creditCushion) || 0;\n  }\n  if (disableImei !== undefined) {\n    settings.disableImei = !!disableImei;\n  }'
);

fs.writeFileSync('src/controllers/adminController.js', code);
