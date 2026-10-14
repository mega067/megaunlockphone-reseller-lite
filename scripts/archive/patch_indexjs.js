const fs = require('fs');
let code = fs.readFileSync('public/index.js', 'utf8');

code = code.replace(
    "const hasCustomImeiName = raw && (raw.IMEINAME || raw.CUSTOM_IMEI);",
    "const hasCustomImeiName = raw && (raw.IMEINAME || raw.CUSTOM_IMEI);\n\n  if (window.globalDisableImei) {\n    imeiInputGroup.classList.add('hidden');\n    imeiInput.removeAttribute('required');\n    imeiInput.removeAttribute('minlength');\n    imeiInput.removeAttribute('maxlength');\n    imeiAutoGenerate.checked = true;\n  } else {"
);

code = code.replace(
    "const sNameLower = sName.toLowerCase();",
    "}\n\n      const sNameLower = sName.toLowerCase();"
);

code = code.replace(
    "fetch('/api/status').then(r => r.json()).then(data => {\n      if (data.version && data.version > localCatalogVersion) {",
    "fetch('/api/status').then(r => r.json()).then(data => {\n      window.globalDisableImei = !!data.disableImei;\n      if (data.version && data.version > localCatalogVersion) {"
);

fs.writeFileSync('public/index.js', code);
