const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

function readDB(file) {
  try { return JSON.parse(fs.readFileSync(path.join('/home/angel/Documentos/REPOS/dhru-client-web/data', file), 'utf8')); } catch (e) { return null; }
}

async function callGsmThemeApi(targetUrl, action, parameters, username, apiaccesskey) {
  const gsmParams = {
    username: username,
    apiaccesskey: apiaccesskey,
    action: action,
    requestformat: 'JSON',
  };
  if (parameters) {
    gsmParams.parameters = JSON.stringify(parameters);
  }
  
  const form = new URLSearchParams();
  for (const key in gsmParams) {
    form.append(key, gsmParams[key]);
  }

  return axios.post(targetUrl, form.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' },
    timeout: 15000
  });
}

async function test() {
  const settingsDb = readDB('settings.json');
  const settings = settingsDb.server2;
  const { apiaccesskey, username, endpoint } = settings;
  const targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';

  try {
    const res = await callGsmThemeApi(targetUrl, 'imeiservicelist', null, username, apiaccesskey);
    console.log(JSON.stringify(res.data).substring(0, 500));
  } catch (e) {
    console.error('ERROR:', e.message);
  }
}

test();
