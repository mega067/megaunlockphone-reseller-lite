const axios = require('axios');
const fs = require('fs');
const settings = JSON.parse(fs.readFileSync('data/settings.json', 'utf8'));
const s3 = settings.server3;
const params = new URLSearchParams();
params.append('username', s3.username);
params.append('apiaccesskey', s3.apiaccesskey);
params.append('action', 'imeiservicelist');
params.append('requestformat', 'JSON');
const targetUrl = s3.endpoint.endsWith('/') ? s3.endpoint + 'api/index.php' : s3.endpoint + '/api/index.php';
axios.post(targetUrl, params.toString(), {
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
}).then(res => {
  const list = res.data.SUCCESS[0].LIST;
  const groups = Object.keys(list);
  console.log('Total IMEI Server 3 groups:', groups.length);
  const actas = groups.filter(g => g.includes('ACTAS'));
  console.log('ACTAS groups in Server 3 IMEI:', actas);
}).catch(console.error);
