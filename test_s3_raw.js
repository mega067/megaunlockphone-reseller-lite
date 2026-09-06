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
  console.log('S3 response data:', JSON.stringify(res.data).substring(0, 500));
}).catch(console.error);
