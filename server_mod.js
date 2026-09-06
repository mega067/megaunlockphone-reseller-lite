const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'server.js');
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  "if (response.data) {",
  "if (response.data) {\n      fs.writeFileSync(path.join(__dirname, 'last_account.json'), JSON.stringify(response.data, null, 2));\n"
);
fs.writeFileSync(file, content);
