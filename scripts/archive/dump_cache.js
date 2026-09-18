const fs = require('fs');
const axios = require('axios');
const settingsDb = JSON.parse(fs.readFileSync('data/settings.json', 'utf8'));
const settings = settingsDb.server3;
const targetUrl = settings.endpoint + 'api/index.php';

async function test() {
    const paramsServer = new URLSearchParams();
    paramsServer.append('username', settings.username);
    paramsServer.append('apiaccesskey', settings.apiaccesskey);
    paramsServer.append('action', 'serverservicelist');
    paramsServer.append('requestformat', 'JSON');
    const res = await axios.post(targetUrl, paramsServer.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }});
    const list = res.data.SUCCESS[0].LIST;
    for (const g in list) {
        const srvs = list[g].SERVICES;
        for (const s in srvs) {
            const service = srvs[s];
            if (service.SERVICEID === "71033" || service.SERVICEID === 71033) {
                console.log("FOUND 71033:", service);
            }
        }
    }
}
test();
