const { callGsmThemeApi } = require('./src/helpers.js');
require('dotenv').config();
const settingsDb = require('./src/db.js').readDB('settings.json') || {};
const server1 = settingsDb.server1;
(async () => {
    try {
        const res = await callGsmThemeApi(server1.endpoint, 'imeiservicelist', {}, server1.username, server1.apiaccesskey);
        // Print the first service inside the first group
        console.log(JSON.stringify(res.SUCCESS[0].SERVICES[0], null, 2));
    } catch(e) { console.error(e) }
})();
