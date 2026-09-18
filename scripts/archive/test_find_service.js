const fs = require('fs');
const list = JSON.parse(fs.readFileSync('out.json'));
let found = null;
for (const g in list) {
    if (list[g].SERVICES) {
        const srvs = Array.isArray(list[g].SERVICES) ? list[g].SERVICES : Object.values(list[g].SERVICES);
        const s = srvs.find(x => x && (x.SERVICEID == 47876 || x.serviceid == 47876));
        if (s) { found = s; break; }
    }
}
console.log(found);
