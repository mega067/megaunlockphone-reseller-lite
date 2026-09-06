const fs = require('fs');
let found = 0;
for (let i = 1; i <= 3; i++) {
  const data = JSON.parse(fs.readFileSync(`catalog_server_${i}.json`, 'utf8'));
  let list = data.SUCCESS[0].LIST;
  for (const group in list) {
    for (const id in list[group].SERVICES) {
      const s = list[group].SERVICES[id];
      if (s.IMEINAME || s.CUSTOM_IMEI) {
        console.log('IMEINAME/CUSTOM_IMEI in:', s.SERVICENAME, s.IMEINAME, s.CUSTOM_IMEI);
        found++;
        if (found > 5) process.exit();
      }
    }
  }
}
