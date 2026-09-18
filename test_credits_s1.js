const axios = require('axios');
const fs = require('fs');

async function testApi() {
    const dbData = JSON.parse(fs.readFileSync('/home/megaunlockphone-panel/www/data/settings.json', 'utf8'));
    const settings = dbData.server1 || dbData;
    const { apiaccesskey, username, endpoint } = settings;
    let targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';
    
    console.log(`Fetching credits from Server 1 (${targetUrl})...`);
    
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('apiaccesskey', apiaccesskey);
    params.append('action', 'accountinfo');
    params.append('requestformat', 'JSON');
    
    try {
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
