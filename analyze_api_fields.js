const fs = require('fs');

const files = ['catalog_server_1.json', 'catalog_server_2.json', 'catalog_server_3.json'];
const keys = new Set();
const customKeys = new Set();

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  const rawData = JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = rawData.SUCCESS && rawData.SUCCESS[0] ? rawData.SUCCESS[0].LIST : rawData;
  
  for (const groupId in list) {
    const services = list[groupId].SERVICES || {};
    for (const serviceId in services) {
      const service = services[serviceId];
      for (const k in service) {
        keys.add(k);
      }
      if (service.CUSTOM) {
        for (const k in service.CUSTOM) {
           customKeys.add(k);
        }
      }
    }
  }
});

fs.writeFileSync('analysis_out.txt', "=== TOP LEVEL ===\n" + Array.from(keys).sort().join('\n') + "\n\n=== CUSTOM ===\n" + Array.from(customKeys).sort().join('\n'));
