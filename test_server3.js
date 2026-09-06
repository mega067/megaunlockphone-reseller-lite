const axios = require('axios');
const settings = {
    endpoint: "https://mayoristasunlock.net/",
    username: "MegaUnlockPhone",
    apiaccesskey: "48G-HD3-QBU-IW-3V-IER-8GR-11U"
};
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
      headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Dhru-Fusion-Web-Client/1.0'
      }
    });
    return response.data;
  } catch (e) {
    return { error: e.message };
  }
}

async function run() {
  const srvList = await test('imeiservicelist', null);
  let targetService = null;
  if (srvList && srvList.SUCCESS) {
      const list = srvList.SUCCESS[0].LIST;
      for (const g in list) {
          const srvs = list[g].SERVICES;
          for (const k in srvs) {
              if (srvs[k].Requires && srvs[k].Requires.Custom && srvs[k].Requires.Custom.length > 0) {
                  targetService = srvs[k];
                  break;
              }
          }
          if (targetService) break;
      }
  }
  console.log("Service found:", targetService ? targetService.SERVICEID + " - " + targetService.SERVICENAME : "None");
  if (targetService) {
      const sid = targetService.SERVICEID;
      const fieldname = targetService.Requires.Custom[0].fieldname || "PlayerID";
      
      // Test 1: XML Sub-tags
      const xml1 = `<PARAMETERS><ID>${sid}</ID><IMEI>111111111111111</IMEI><QNT>1</QNT><CUSTOMFIELD><${fieldname}>test</${fieldname}></CUSTOMFIELD></PARAMETERS>`;
      console.log("XML Tags test:", await test('placeimeiorder', xml1));
      
      // Test 2: Base64 JSON
      const b64 = Buffer.from(JSON.stringify({[fieldname]: "test"})).toString('base64');
      const xml2 = `<PARAMETERS><ID>${sid}</ID><IMEI>111111111111111</IMEI><QNT>1</QNT><CUSTOMFIELD>${b64}</CUSTOMFIELD></PARAMETERS>`;
      console.log("Base64 JSON test:", await test('placeimeiorder', xml2));
  }
}
run();
