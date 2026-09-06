const axios = require('axios');
const params = new URLSearchParams();
params.append('username', 'angeljuares067@gmail.com');
params.append('apiaccesskey', 'pk60-qXSs-xXsF-qZPa');
params.append('action', 'grouplist');
params.append('requestformat', 'JSON');

axios.post('https://latamgsm.com/dhru/api/index.php', params.toString(), {
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' },
  timeout: 15000
}).then(res => console.log(res.data)).catch(e => console.error("ERROR", e.message));
