const axios = require('axios');
const fs = require('fs');

const settings = JSON.parse(fs.readFileSync('./data/settings.json', 'utf8'));
const targetUrl = 'https://latamgsm.com/dhru/api/index.php';
const username = 'angeljuares067@gmail.com';
const apiaccesskey = 'pk60-qXSs-xXsF-qZPa';

async function testApi(action) {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('apiaccesskey', apiaccesskey);
    params.append('action', action);
    params.append('requestformat', 'JSON');
    try {
        const response = await axios.post(targetUrl, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        if (response.data.SUCCESS) {
           console.log(`Action ${action} succeeded. Items:`, response.data.SUCCESS[0].LIST ? Object.keys(response.data.SUCCESS[0].LIST).length : 0);
           const list = response.data.SUCCESS[0].LIST;
           for (const g in list) {
               const srvs = list[g].SERVICES;
               for (const k in srvs) {
                   if (srvs[k].SERVICEID == '154') {
                       console.log(`FOUND 154 IN ${action}!`);
                       console.log(JSON.stringify(srvs[k], null, 2));
                   }
               }
           }
        } else {
           console.log(`Action ${action} failed:`, response.data.ERROR);
        }
    } catch(e) {
        console.error(e.message);
    }
}
async function run() {
    await testApi('imeiorderservices');
    await testApi('serverorderservices');
}
run();
