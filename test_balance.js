const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function testApi() {
    const DATA_DIR = path.join(__dirname, 'data');
    const settingsDb = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'settings.json'), 'utf8'));

    for (let sId of [1, 2, 3]) {
        const conf = settingsDb['server' + sId];
        if (!conf || !conf.apiaccesskey) {
            console.log(`Server ${sId}: Not configured`);
            continue;
        }
        
        let targetUrl = conf.endpoint || 'https://latamgsm.com/dhru/';
        if (!targetUrl.includes('/api/')) {
            targetUrl = targetUrl.endsWith('/') ? `${targetUrl}api/index.php` : `${targetUrl}/api/index.php`;
        } else if (targetUrl.endsWith('/api/')) {
            targetUrl += 'index.php';
        }

        console.log(`Server ${sId} Target URL:`, targetUrl);
        
        try {
            const params = new URLSearchParams();
            params.append('username', conf.username);
            params.append('apiaccesskey', conf.apiaccesskey);
            params.append('action', 'accountinfo');
            params.append('requestformat', 'JSON');
            
            const res = await axios.post(targetUrl, params.toString(), { 
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded', 
                    'User-Agent': 'Dhru-Fusion-Web-Client/1.0' 
                }, 
                timeout: 10000 
            });
            
            console.log(`Server ${sId} Response:`, JSON.stringify(res.data).substring(0, 200));
            const real = parseFloat(res.data?.SUCCESS?.[0]?.AccountInfo?.creditraw || 0);
            console.log(`Server ${sId} Parsed Real Credit:`, real);
        } catch (e) {
            console.error(`Server ${sId} Error:`, e.message);
        }
    }
}
testApi();
