const fs = require('fs');
const path = require('path');
const dataPath = path.join(__dirname, 'data', 'prices_1.json');
console.log("File exists?", fs.existsSync(dataPath));
if (fs.existsSync(dataPath)) {
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log("Keys count:", Object.keys(data).length);
  console.log("Has 40361:", data['40361'] !== undefined);
}
