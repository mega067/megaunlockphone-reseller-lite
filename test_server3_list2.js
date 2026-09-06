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
  if (srvList && srvList.SUCCESS) {
      console.log("Services loaded successfully");
      const list = srvList.SUCCESS[0].LIST;
      let hasCustom = false;
      for (const g in list) {
          const srvs = list[g].SERVICES;
          for (const k in srvs) {
              const str = JSON.stringify(srvs[k]);
              if (str.includes('Requires')) {
                  console.log("Found Requires in:", srvs[k].SERVICEID);
              }
              if (str.includes('Custom') || str.includes('custom')) {
                  console.log("Found Custom in:", srvs[k].SERVICEID, str);
                  hasCustom = true;
              }
          }
      }
      if (!hasCustom) console.log("No custom fields required anywhere in server 3.");
  } else {
      console.log("Failed to load services:", srvList);
  }
}
run();
