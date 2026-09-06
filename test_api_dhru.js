const axios = require('axios');
const fs = require('fs');
const settingsDb = JSON.parse(fs.readFileSync('data/settings.json', 'utf8'));
const serverId = '1';
const settings = settingsDb['server' + serverId];
const username = settings.username;
const apiaccesskey = settings.apiaccesskey;
const endpoint = settings.endpoint;

async function test(action) {
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
    console.log(action, "=>", response.data);
  } catch (e) {
    console.log(action, "Error:", e.message);
  }
}

async function run() {
  await test('placeimeiorder');
  await test('placeserverorder');
}
run();
