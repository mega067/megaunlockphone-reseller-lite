const fs = require('fs');
let code = fs.readFileSync('public/js/admin.js', 'utf8');

code = code.replace(
    "inputCreditCushion.value = parseFloat(set.creditCushion || 0).toFixed(0);\n      }",
    "inputCreditCushion.value = parseFloat(set.creditCushion || 0).toFixed(0);\n      }\n      const inputDisableImei = document.getElementById('inputDisableImei');\n      if (inputDisableImei) {\n        inputDisableImei.checked = !!set.disableImei;\n      }"
);

code = code.replace(
    "let payload = { exchangeRate: parseFloat(exchangeRate), creditCushion: parseInt(creditCushion) };",
    "const disableImei = document.getElementById('inputDisableImei') ? document.getElementById('inputDisableImei').checked : false;\n      let payload = { exchangeRate: parseFloat(exchangeRate), creditCushion: parseInt(creditCushion), disableImei: disableImei };"
);

fs.writeFileSync('public/js/admin.js', code);
