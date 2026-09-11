const axios = require('axios');
const fs = require('fs');

async function testOrder() {
  const settings = JSON.parse(fs.readFileSync('data/settings.json'))['server3'];
  const { username, apiaccesskey, endpoint } = settings;
  const targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';

  const xmlParameters = '<PARAMETERS><ID>89492</ID><IMEI>7831062732</IMEI><CUSTOMFIELD><NUMERO>7831062732</NUMERO></CUSTOMFIELD></PARAMETERS>';

  let params = new URLSearchParams();
  params.append('username', username);
  params.append('apiaccesskey', apiaccesskey);
  params.append('action', 'placeimeiorder');
  params.append('requestformat', 'JSON');
  params.append('parameters', xmlParameters);

  try {
    let res = await axios.post(targetUrl, params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }});
    console.log("placeimeiorder (XML):", JSON.stringify(res.data, null, 2));
  } catch(e) {
    console.error(e.message);
  }

  // Also test base64
  const xmlParametersB64 = '<PARAMETERS><ID>89492</ID><IMEI>7831062732</IMEI><CUSTOMFIELD>eyJudW1lcm8iOiI3ODMxMDYyNzMyIn0=</CUSTOMFIELD></PARAMETERS>';
  let params2 = new URLSearchParams();
  params2.append('username', username);
  params2.append('apiaccesskey', apiaccesskey);
  params2.append('action', 'placeimeiorder');
  params2.append('requestformat', 'JSON');
  params2.append('parameters', xmlParametersB64);

  try {
    let res = await axios.post(targetUrl, params2.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }});
    console.log("placeimeiorder (Base64):", JSON.stringify(res.data, null, 2));
  } catch(e) {
    console.error(e.message);
  }
}

testOrder();
