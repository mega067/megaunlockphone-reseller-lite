const fs = require('fs');
const c = JSON.parse(fs.readFileSync('data/custom_prices.json', 'utf8'))['server3'] || {};
for (const id in c) {
  if (isNaN(parseFloat(c[id].resellerPrice))) {
    console.log("Invalid custom price for:", id, "value:", c[id].resellerPrice);
  }
}
const u = JSON.parse(fs.readFileSync('data/user_custom_prices.json', 'utf8'))['server3'] || {};
for (const id in u) {
  for (const uid in u[id]) {
    if (isNaN(parseFloat(u[id][uid].resellerPrice))) {
      console.log("Invalid user custom price for:", id, "uid:", uid, "value:", u[id][uid].resellerPrice);
    }
  }
}
