const axios = require('axios');
const fs = require('fs');
const https = require('https');
axios.defaults.httpsAgent = new https.Agent({ family: 4 });

let settings;
try {
  settings = JSON.parse(fs.readFileSync('/home/megaunlockphone-panel/www/data/settings.json')).server3;
} catch(e) {
  console.log("No settings");
  process.exit();
}
let targetUrl = settings.endpoint.endsWith('/') ? settings.endpoint + 'api/index.php' : settings.endpoint + '/api/index.php';

async function test(action, xml) {
  const params = new URLSearchParams();
  params.append('username', settings.username);
  params.append('apiaccesskey', settings.apiaccesskey);
  params.append('action', action);
  params.append('requestformat', 'JSON');
  if (xml) params.append('parameters', xml);
  
  try {
    const response = await axios.post(targetUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' }
    });
    return response.data;
  } catch (e) {
    return { error: e.message };
  }
}

async function run() {
  const srvList = await test('imeiservicelist', null);
  if (srvList && srvList.SUCCESS) {
      console.log("Services loaded successfully");
      const list = srvList.SUCCESS[0].LIST;
      let targetService = null;
      for (const g in list) {
          const srvs = list[g].SERVICES;
          for (const k in srvs) {
              const str = JSON.stringify(srvs[k]);
              if (str.includes('Custom') || str.includes('custom')) {
                  targetService = srvs[k];
                  break;
              }
          }
          if (targetService) break;
      }
      
      if (!targetService) {
          console.log("No custom fields required anywhere in server 3.");
      } else {
          console.log("Testing service:", targetService.SERVICEID);
          const sid = targetService.SERVICEID;
          const fieldname = targetService.Requires.Custom[0].fieldname || "PlayerID";
          
          // Test 1: XML Sub-tags
          const xml1 = `<PARAMETERS><ID>${sid}</ID><IMEI>111111111111111</IMEI><QNT>1</QNT><CUSTOMFIELD><${fieldname}>test</${fieldname}></CUSTOMFIELD></PARAMETERS>`;
          console.log("XML Tags test:", JSON.stringify(await test('placeimeiorder', xml1)));
          
          // Test 2: Base64 JSON
          const b64 = Buffer.from(JSON.stringify({[fieldname]: "test"})).toString('base64');
          const xml2 = `<PARAMETERS><ID>${sid}</ID><IMEI>111111111111111</IMEI><QNT>1</QNT><CUSTOMFIELD>${b64}</CUSTOMFIELD></PARAMETERS>`;
          console.log("Base64 JSON test:", JSON.stringify(await test('placeimeiorder', xml2)));
      }
  } else {
      console.log("Failed to load services:", JSON.stringify(srvList));
  }
}
run();
