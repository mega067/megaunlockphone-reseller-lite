import pexpect
import time

cmd = """ssh -o StrictHostKeyChecking=no megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net "cat << 'INNEREOF' > ~/www/list_ff.js
const axios = require('axios');
const fs = require('fs');
const https = require('https');
const ipv4Agent = new https.Agent({ family: 4 });

const settings = JSON.parse(fs.readFileSync(__dirname + '/data/settings.json', 'utf8'));
const { username, apiaccesskey, endpoint } = settings.server1;
let targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';

async function run() {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('apiaccesskey', apiaccesskey);
    params.append('action', 'imeiservicelist');
    params.append('requestformat', 'JSON');
    
    try {
        const response = await axios.post(targetUrl, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'MegaUnlock/1.0' },
            httpsAgent: ipv4Agent
        });
        const list = response.data.SUCCESS[0].LIST;
        for (const g in list) {
            const srvs = list[g].SERVICES;
            for (const k in srvs) {
                if (srvs[k].SERVICENAME.toLowerCase().includes('free fire')) {
                    console.log(JSON.stringify(srvs[k]));
                }
            }
        }
    } catch(e) {}
}
run();
INNEREOF
cd ~/www && node list_ff.js"
"""
child = pexpect.spawn(cmd, encoding='utf-8')
i = child.expect(['(?i)assword', '(?i)contrase.a', '(?i)passe', pexpect.EOF], timeout=10)
if i in (0, 1, 2):
    child.sendline('angel067L')
    child.expect(pexpect.EOF, timeout=30)
print(child.before)
