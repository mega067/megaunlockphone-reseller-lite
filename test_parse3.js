const fs = require('fs');
const data = JSON.parse(fs.readFileSync('catalog_server_3.json'));
let service339 = null;
if (data.SUCCESS && data.SUCCESS[0] && data.SUCCESS[0].LIST) {
  data.SUCCESS[0].LIST.forEach(group => {
     if (group.DATALIST) {
        group.DATALIST.forEach(s => {
           if (s.SERVICEID === '339' || s.SERVICEID === 339) service339 = s;
        });
     }
  });
}
console.log(JSON.stringify(service339, null, 2));
