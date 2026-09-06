const fs = require('fs');
const settings = JSON.parse(fs.readFileSync('data/settings.json'));
const s = settings['server3'];

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
}
test().catch(console.error);
