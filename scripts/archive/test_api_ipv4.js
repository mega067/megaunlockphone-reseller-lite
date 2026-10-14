const axios = require('axios');
const fs = require('fs');
const https = require('https');
const ipv4Agent = new https.Agent({ family: 4 });

async function testApi() {
    const dbData = JSON.parse(fs.readFileSync('/home/megaunlockphone-panel/www/data/settings.json', 'utf8'));
    const settings = dbData.server3 || dbData;
    const { apiaccesskey, username, endpoint } = settings;
    let targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';
    
    console.log(`Checking order 2230943 on ${targetUrl} using IPv4...`);
    
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('apiaccesskey', apiaccesskey);
    params.append('action', 'getimeiorder');
    params.append('requestformat', 'JSON');
    params.append('parameters', '<PARAMETERS><ID>2230943</ID></PARAMETERS>');
    
    try {
        const response = await axios.post(targetUrl, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000,
            httpsAgent: ipv4Agent
        });
        console.log(JSON.stringify(response.data, null, 2));
    } catch(e) {
        console.error(e.message);
    }
}
testApi();
