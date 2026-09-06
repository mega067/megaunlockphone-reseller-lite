const fs = require('fs');
const settings = JSON.parse(fs.readFileSync('data/settings.json'));
const s = settings['server1'];

const payload = {
  username: s.username,
  apiaccesskey: s.apiaccesskey,
  action: 'serverservicelist',
  requestformat: 'JSON'
};

async function test() {
  let params = new URLSearchParams(payload);
  const res = await fetch(s.endpoint + 'api/index.php', {
    method: 'POST', body: params
  });
  const data = await res.json();
  fs.writeFileSync('latamgsm_server.json', JSON.stringify(data, null, 2));
  console.log("Done fetching LatamGSM Server catalog!");
}
test().catch(console.error);
