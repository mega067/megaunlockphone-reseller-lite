const fs = require('fs');
const { callGsmThemeApi } = require('./src/helpers'); // Assuming it's there, wait I'll just use raw axios

const axios = require('axios');
const crypto = require('crypto');

async function testApi() {
    const dbData = JSON.parse(fs.readFileSync('/home/megaunlockphone-panel/www/data/settings.json', 'utf8'));
    const settings = dbData.server2 || dbData;
    const { apiaccesskey, username, endpoint } = settings;
    let targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';
    
    console.log(`Fetching credits from Server 2 (${targetUrl})...`);
    
    try {
        const payloadObj = { accountinfo: '' };
        const payloadBase64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
        const signature = crypto.createHmac('sha256', apiaccesskey).update(payloadBase64).digest('hex');
        
        const params = new URLSearchParams();
        params.append('public_key', username);
        params.append('action', 'accountinfo');
        params.append('payload', payloadBase64);
        params.append('signature', signature);
        
        const response = await axios.post(targetUrl, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000
        });
        console.log(JSON.stringify(response.data, null, 2));
    } catch(e) {
        console.error(e.message);
    }
}
testApi();
