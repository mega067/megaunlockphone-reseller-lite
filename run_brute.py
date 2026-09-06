import pexpect

cmd = """ssh -o StrictHostKeyChecking=no megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net "cat << 'INNEREOF' > ~/www/brute_dhru.js
const axios = require('axios');
const fs = require('fs');

const settings = JSON.parse(fs.readFileSync(__dirname + '/data/settings.json', 'utf8'));
const { username, apiaccesskey, endpoint } = settings.server1;
let targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';

async function test(xml) {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('apiaccesskey', apiaccesskey);
    params.append('action', 'placeimeiorder');
    params.append('requestformat', 'JSON');
    params.append('parameters', xml);
    
    try {
        const response = await axios.post(targetUrl, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'MegaUnlock/1.0' }
        });
        return response.data;
    } catch(e) {
        return { error: e.message };
    }
}

async function run() {
    const tags = ['PlayerID', 'PLAYERID', 'playerid', 'Player_ID', 'PlayerID_', 'Player_ID_'];
    let results = {};
    for (const tag of tags) {
        results['test_15digits_' + tag] = await test(\`<PARAMETERS><ID>154</ID><IMEI>111111111111111</IMEI><CUSTOMFIELD><\${tag}>14720326388</\${tag}></CUSTOMFIELD></PARAMETERS>\`);
    }
    results['test_15digits_nocustom'] = await test('<PARAMETERS><ID>154</ID><IMEI>111111111111111</IMEI></PARAMETERS>');
    
    // Write results to a file we can curl!
    fs.writeFileSync(__dirname + '/public/brute_out.json', JSON.stringify(results));
}
run();
INNEREOF
cd ~/www && node brute_dhru.js"
"""
child = pexpect.spawn(cmd, encoding='utf-8')
i = child.expect(['(?i)assword', '(?i)contrase.a', '(?i)passe', pexpect.EOF], timeout=10)
if i in (0, 1, 2):
    child.sendline('angel067L')
    child.expect(pexpect.EOF, timeout=30)
print(child.before)
