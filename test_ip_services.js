const axios = require('axios');
axios.get('https://api.ipify.org?format=json')
    .then(res => console.log(res.data.ip))
    .catch(err => console.error(err.message));
