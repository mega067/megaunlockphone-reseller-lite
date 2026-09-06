const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/prices_3.json'));
let service339 = null;
Object.values(data).forEach(group => {
  if (group && group.LIST && Array.isArray(group.LIST)) {
     group.LIST.forEach(s => {
       if (s.SERVICEID === '339' || s.SERVICEID === 339) service339 = s;
       if (s.DATALIST && Array.isArray(s.DATALIST)) {
           s.DATALIST.forEach(ss => {
               if (ss.SERVICEID === '339' || ss.SERVICEID === 339) service339 = ss;
           });
       }
     });
  }
});
if (!service339) {
  for (const k of Object.keys(data)) {
     const g = data[k];
     if (Array.isArray(g)) {
        g.forEach(s => {
            if (s.SERVICEID === '339' || s.SERVICEID === 339) service339 = s;
        });
     }
  }
}
console.log(JSON.stringify(service339, null, 2));
