import pexpect

cmd = """ssh -o StrictHostKeyChecking=no megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net "cat << 'INNEREOF' > ~/www/test_local.js
const axios = require('axios');
const fs = require('fs');
const https = require('https');

const settings = JSON.parse(fs.readFileSync(__dirname + '/data/settings.json', 'utf8'));
const { username, apiaccesskey, endpoint } = settings.server1;
let targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';

const ipv4Agent = new https.Agent({ family: 4 });

async function test(action, xml) {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('apiaccesskey', apiaccesskey);
    params.append('action', action);
    params.append('requestformat', 'JSON');
    if (xml) params.append('parameters', xml);
    
    try {
        const response = await axios.post(targetUrl, params.toString(), {
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Dhru-Fusion-Web-Client/1.0'
            },
            httpsAgent: ipv4Agent
        });
        console.log(action, xml ? xml : '', '=>', JSON.stringify(response.data));
        return response.data;
    } catch(e) {
        console.error('Error:', e.message);
    }
}

async function run() {
    console.log('Testing authentication with IPv4...');
    await test('accountinfo', null);
    
    console.log('Testing placeimeiorder with PlayerID in IMEI...');
    await test('placeimeiorder', '<PARAMETERS><ID>154</ID><IMEI>14720326388</IMEI></PARAMETERS>');
    
    console.log('Testing placeimeiorder with PlayerID in custom field...');
    await test('placeimeiorder', '<PARAMETERS><ID>154</ID><IMEI>111111111111111</IMEI><CUSTOMFIELD><PlayerID>14720326388</PlayerID></CUSTOMFIELD></PARAMETERS>');
    
    console.log('Testing placeimeiorder with PlayerID in custom field (with asterisk)...');
    await test('placeimeiorder', '<PARAMETERS><ID>154</ID><IMEI>111111111111111</IMEI><CUSTOMFIELD><PlayerID_>14720326388</PlayerID_></CUSTOMFIELD></PARAMETERS>');

    console.log('Testing placeserverorder...');
    await test('placeserverorder', '<PARAMETERS><ID>154</ID><QNT>1</QNT><CUSTOMFIELD><PlayerID>14720326388</PlayerID></CUSTOMFIELD></PARAMETERS>');
}
run();
INNEREOF
cd ~/www && node test_local.js"
"""
child = pexpect.spawn(cmd, encoding='utf-8')
i = child.expect(['(?i)assword', '(?i)contrase.a', '(?i)passe', pexpect.EOF], timeout=10)
if i in (0, 1, 2):
    child.sendline('angel067L')
    child.expect(pexpect.EOF, timeout=30)
print(child.before)
