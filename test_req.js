const axios = require('axios');
const fs = require('fs');

async function testOrder() {
  const settings = JSON.parse(fs.readFileSync('data/settings.json'))['server3'];
  const { username, apiaccesskey, endpoint } = settings;
  const targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';

  let params = new URLSearchParams();
  params.append('username', username);
  params.append('apiaccesskey', apiaccesskey);
  params.append('action', 'invalidaction123');
  params.append('requestformat', 'JSON');
  params.append('parameters', '<PARAMETERS></PARAMETERS>');

  try {
    let res = await axios.post(targetUrl, params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }});
    console.log(JSON.stringify(res.data, null, 2));
  } catch(e) {
    console.error(e.message);
  }
}

testOrder();
