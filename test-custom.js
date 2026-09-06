const fs = require('fs');
const settings = JSON.parse(fs.readFileSync('data/settings.json'));
const s = settings['server1'];

const payload = {
  username: s.username,
  apiaccesskey: s.apiaccesskey,
  action: 'getimeiservicedetails',
  requestformat: 'JSON',
  parameters: JSON.stringify({ serviceid: 512 })
};

async function test() {
  let params = new URLSearchParams(payload);
  const res = await fetch(s.endpoint + 'api/index.php', {
    method: 'POST', body: params
  });
  const data = await res.json();
  console.log("IMEI Service 512:", JSON.stringify(data, null, 2));

  payload.action = 'getserverservicedetails';
  payload.parameters = JSON.stringify({ serviceid: 465 });
  params = new URLSearchParams(payload);
  const res2 = await fetch(s.endpoint + 'api/index.php', {
    method: 'POST', body: params
  });
  const data2 = await res2.json();
  console.log("SERVER Service 465:", JSON.stringify(data2, null, 2));
}
test().catch(console.error);
