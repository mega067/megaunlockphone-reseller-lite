const axios = require('axios');
const fs = require('fs');

async function test(customFields, asBase64) {
  const settingsDb = JSON.parse(fs.readFileSync('data/settings.json', 'utf8'));
  const serverId = '1';
  const settings = settingsDb['server' + serverId];
  let targetUrl = settings.endpoint.endsWith('/') ? settings.endpoint + 'api/index.php' : settings.endpoint + '/api/index.php';
  
  let customXml = '';
  if (asBase64) {
      customXml = '<CUSTOMFIELD>' + Buffer.from(JSON.stringify(customFields)).toString('base64') + '</CUSTOMFIELD>';
  } else {
      for (const [key, val] of Object.entries(customFields)) {
          customXml += `<${key.toUpperCase()}>${val}</${key.toUpperCase()}>`;
      }
  }

  const xmlParameters = `<PARAMETERS><ID>154</ID><IMEI>111111111111111</IMEI>${customXml}</PARAMETERS>`;

  const params = new URLSearchParams();
  params.append('username', settings.username);
  params.append('apiaccesskey', settings.apiaccesskey);
  params.append('action', 'placeimeiorder');
  params.append('requestformat', 'JSON');
  params.append('parameters', xmlParameters);

  try {
    const response = await axios.post(targetUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    console.log(asBase64 ? "BASE64" : "XML TAGS", "=>", JSON.stringify(response.data));
  } catch(e) {
    console.log("Error", e.message);
  }
}

async function run() {
  await test({"PlayerID *": "11975173546"}, false);
  await test({"PlayerID *": "11975173546"}, true);
}
run();
