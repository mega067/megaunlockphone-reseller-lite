import pexpect
import time

cmd = """ssh -o StrictHostKeyChecking=no megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net "cat << 'INNEREOF' > ~/www/brute_fields.js
const axios = require('axios');
const fs = require('fs');
const https = require('https');
const ipv4Agent = new https.Agent({ family: 4 });

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
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'MegaUnlock/1.0' },
            httpsAgent: ipv4Agent
        });
        return response.data;
    } catch(e) {
        return { error: e.message };
    }
}

async function run() {
    const tags = ['PlayerID', 'PLAYERID', 'playerid', 'Player_ID', 'PlayerID_', 'Player_ID_', 'ID', 'Id', 'PlayerId', 'PLAYER_ID', 'player_id', 'Player ID', 'PlayerID *'];
    
    for (const tag of tags) {
        let xml;
        if (tag.includes(' ')) {
            continue;
        } else {
            xml = '<PARAMETERS><ID>154</ID><IMEI>14720326388</IMEI><CUSTOMFIELD><' + tag + '>14720326388</' + tag + '></CUSTOMFIELD></PARAMETERS>';
        }
        const res = await test(xml);
        console.log('Tag: ' + tag + ' => ' + JSON.stringify(res));
    }
    
    console.log('Testing NO CUSTOM FIELD =>', JSON.stringify(await test('<PARAMETERS><ID>154</ID><IMEI>14720326388</IMEI></PARAMETERS>')));
    console.log('Testing QNT=1 =>', JSON.stringify(await test('<PARAMETERS><ID>154</ID><IMEI>14720326388</IMEI><QNT>1</QNT><CUSTOMFIELD><PlayerID>14720326388</PlayerID></CUSTOMFIELD></PARAMETERS>')));
    console.log('Testing ONLY CUSTOM FIELD NO IMEI =>', JSON.stringify(await test('<PARAMETERS><ID>154</ID><CUSTOMFIELD><PlayerID>14720326388</PlayerID></CUSTOMFIELD></PARAMETERS>')));
}
run();
INNEREOF
cd ~/www && node brute_fields.js"
"""
child = pexpect.spawn(cmd, encoding='utf-8')

i = child.expect(['(?i)assword', '(?i)contrase.a', '(?i)passe', pexpect.EOF], timeout=10)
if i in (0, 1, 2):
    child.sendline('angel067L')
    child.expect(pexpect.EOF, timeout=60)
print(child.before)
