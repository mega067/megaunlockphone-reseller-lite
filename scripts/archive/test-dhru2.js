const { callGsmThemeApi } = require('./src/helpers.js');
require('dotenv').config();
const settingsDb = require('./src/db.js').readDB('settings.json') || {};
const server3 = settingsDb.server3;
(async () => {
    try {
        const res = await callGsmThemeApi(server3.endpoint, 'imeiservicelist', {}, server3.username, server3.apiaccesskey);
        console.log(JSON.stringify(res, null, 2));
    } catch(e) { console.error(e) }
})();
