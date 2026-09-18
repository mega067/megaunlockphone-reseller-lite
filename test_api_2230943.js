const axios = require('axios');
const fs = require('fs');

async function testApi() {
    const dbData = JSON.parse(fs.readFileSync('/home/megaunlockphone-panel/www/data/settings.json', 'utf8'));
    const settings = dbData.server1 || dbData; // Assuming server 1 for now, let's check what it uses
    const { apiaccesskey, username, endpoint } = settings;
    let targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';
    
    console.log(`Checking order 2230943 on ${targetUrl}...`);
    
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('apiaccesskey', apiaccesskey);
    params.append('action', 'getimeiorder');
    params.append('requestformat', 'JSON');
    params.append('parameters', '<PARAMETERS><ID>2230943</ID></PARAMETERS>');
    
    try {
        const response = await axios.post(targetUrl, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        console.log(JSON.stringify(response.data, null, 2));
    } catch(e) {
        console.error(e.message);
    }
}
testApi();
