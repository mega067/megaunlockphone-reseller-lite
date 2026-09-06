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
      const list = srvList.SUCCESS[0].LIST;
      let count = 0;
      for (const g in list) {
          const srvs = list[g].SERVICES;
          for (const k in srvs) {
              // check if any service has Requires object at all
              if (srvs[k].Requires) {
                  console.log("Service ID:", srvs[k].SERVICEID, "Requires:", JSON.stringify(srvs[k].Requires));
                  count++;
                  if (count > 5) break;
              }
          }
          if (count > 5) break;
      }
      if (count === 0) console.log("No services have a 'Requires' field.");
  }
}
run();
