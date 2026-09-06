const fs = require('fs');
const axios = require('axios');
const users = JSON.parse(fs.readFileSync('data/users.json'));
const user = users[0];

const express = require('express');
const app = express();
// We don't need a full app, we just need to test callGsmThemeApi!

async function testGsm() {
  const settings = JSON.parse(fs.readFileSync('data/settings.json'));
  const s2 = settings.server2;
  const targetUrl = s2.endpoint.endsWith('/') ? s2.endpoint + 'api/index.php' : s2.endpoint + '/api/index.php';
  
  const jsonParams = '';
  const params = new URLSearchParams();
  params.append('username', s2.username);
  params.append('apiaccesskey', s2.apiaccesskey);
  params.append('action', 'accountinfo');
  params.append('requestformat', 'JSON');
  params.append('parameters', jsonParams);

  try {
    const res = await axios.post(targetUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    console.log("Status:", res.status);
    console.log("Data snippet:", JSON.stringify(res.data).substring(0, 300));
  } catch (err) {
    console.log("Error:", err.message);
  }
}
testGsm();
