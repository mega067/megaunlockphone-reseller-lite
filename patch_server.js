const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(
    "res.json({ version: getCatalogVersion() });",
    "const settings = require('./src/db').readDB('settings.json') || {};\n  res.json({ version: getCatalogVersion(), disableImei: !!settings.disableImei });"
);

fs.writeFileSync('server.js', code);
