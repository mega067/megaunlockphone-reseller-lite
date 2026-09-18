const fs = require('fs');
let p = {};
try {
  p = JSON.parse(fs.readFileSync('data/prices_3.json', 'utf8'));
} catch (e) {
  console.log("No prices_3.json or invalid JSON");
  process.exit();
}
let nanCount = 0;
let nullCount = 0;
let stringCount = 0;
for (const id in p) {
  if (p[id] === null) nullCount++;
  else if (typeof p[id] === 'string') stringCount++;
  else if (isNaN(p[id])) nanCount++;
}
console.log(`Prices count: ${Object.keys(p).length}`);
console.log(`Null count: ${nullCount}`);
console.log(`NaN count: ${nanCount}`);
console.log(`String count: ${stringCount}`);
