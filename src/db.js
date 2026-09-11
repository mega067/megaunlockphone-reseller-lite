const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

let dbCache = {};

function readDB(file) {
  if (dbCache[file] !== undefined) return dbCache[file];
  const filepath = path.join(DATA_DIR, file);
  if (!fs.existsSync(filepath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    dbCache[file] = data;
    return data;
  } catch (e) {
    return null;
  }
}

function writeDB(file, data) {
  dbCache[file] = data;
  // Write synchronously to guarantee data integrity across worker reloads
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

module.exports = {
  readDB,
  writeDB,
  DATA_DIR
};
