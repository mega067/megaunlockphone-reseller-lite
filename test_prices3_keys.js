const fs = require('fs');
let p = {};
try {
  p = JSON.parse(fs.readFileSync('data/prices_3.json', 'utf8'));
} catch (e) {}
console.log("Has 111938:", p['111938']);
console.log("Has 71033:", p['71033']);
