import pexpect
cmd = "ssh -o StrictHostKeyChecking=no megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net 'cat > www/test_api_dhru.js && cd www && node test_api_dhru.js'"
child = pexpect.spawn(cmd, encoding='utf-8')
child.expect('assword:')
child.sendline('angel067L')
script = """
const axios = require('axios');
const fs = require('fs');
const settingsDb = JSON.parse(fs.readFileSync('data/settings.json', 'utf8'));

async function test(serverId, action) {
  const settings = settingsDb['server' + serverId];
  if (!settings) return;
  const username = settings.username;
  const apiaccesskey = settings.apiaccesskey;
  const endpoint = settings.endpoint;
  let targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';
  const params = new URLSearchParams();
  params.append('username', username);
  params.append('apiaccesskey', apiaccesskey);
  params.append('action', action);
  params.append('requestformat', 'JSON');
  params.append('parameters', '<PARAMETERS><ID>110111</ID><QNT>1</QNT></PARAMETERS>');
  try {
    const response = await axios.post(targetUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000
    });
    console.log(`Server ${serverId} [${action}] =>`, response.data);
  } catch (e) {
    console.log(`Server ${serverId} [${action}] Error =>`, e.message);
  }
}

async function run() {
  for (let i of [1, 2, 3]) {
    await test(i, 'placeimeiorder');
    await test(i, 'placeserverorder');
  }
}
run();
"""
child.send(script)
child.send('\x04') # EOF
child.expect(pexpect.EOF, timeout=30)
print(child.before)
