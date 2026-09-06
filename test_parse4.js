const fs = require('fs');
const data = JSON.parse(fs.readFileSync('catalog_server_3.json'));
let found = null;
function search(obj) {
    if (found) return;
    if (Array.isArray(obj)) {
        obj.forEach(search);
    } else if (obj && typeof obj === 'object') {
        if (obj.SERVICEID === '339' || obj.SERVICEID === 339) {
            found = obj;
            return;
        }
        Object.values(obj).forEach(search);
    }
}
search(data);
console.log(JSON.stringify(found, null, 2));
