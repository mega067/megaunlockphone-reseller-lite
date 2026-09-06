const fs = require('fs');
const code = fs.readFileSync('server.js', 'utf8');
const match = code.match(/catalogCache = \{[\s\S]*?\};/);
console.log(match ? match[0] : 'Not found');
