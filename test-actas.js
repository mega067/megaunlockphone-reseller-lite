const fs = require('fs');
const settings = JSON.parse(fs.readFileSync('data/settings.json'));
const s = settings['server1']; // LatamGSM

async function fetchService(id) {
  const payload = {
    username: s.username,
    apiaccesskey: s.apiaccesskey,
    action: 'getimeiservicedetails',
    requestformat: 'JSON',
    parameters: JSON.stringify({ serviceid: id })
  };
  let params = new URLSearchParams(payload);
  const res = await fetch(s.endpoint + 'api/index.php', { method: 'POST', body: params });
  return await res.json();
}

async function run() {
  const s465 = await fetchService(465);
  console.log("Service 465:", JSON.stringify(s465, null, 2));
  
  const s455 = await fetchService(455);
  console.log("Service 455:", JSON.stringify(s455, null, 2));
}

run().catch(console.error);
