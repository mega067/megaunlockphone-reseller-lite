const fs = require('fs');
const list = JSON.parse(fs.readFileSync('catalog_server_3.json', 'utf8')).SUCCESS[0].LIST;
for (const g in list) {
  if (list[g].SERVICES) {
    for (const s of Object.values(list[g].SERVICES)) {
      if (s && s.SERVICENAME && s.SERVICENAME.toLowerCase().includes('tsm')) {
        console.log(`ID: ${s.SERVICEID || s.serviceid}, NAME: ${s.SERVICENAME}, CREDIT: "${s.CREDIT}"`);
      }
    }
  }
}
