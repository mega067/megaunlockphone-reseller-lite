const fs = require('fs');
const data = JSON.parse(fs.readFileSync('catalog_server_3.json', 'utf8'));
const list = data.SUCCESS[0].LIST;

for (const group in list) {
  for (const id in list[group].SERVICES) {
    const s = list[group].SERVICES[id];
    if (s.SERVICENAME.toLowerCase().includes('acta de nacimiento')) {
      console.log('FOUND:', s.SERVICENAME);
      console.log(JSON.stringify(s, null, 2));
    }
  }
}
