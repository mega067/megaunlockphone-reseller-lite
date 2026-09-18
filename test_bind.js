const axios = require('axios');
const https = require('https');

async function test() {
    try {
        const agent = new https.Agent({ localAddress: '185.31.41.11' });
        const res = await axios.get('https://api.ipify.org?format=json', { httpsAgent: agent });
        console.log("Success:", res.data);
    } catch(e) {
        console.error("Error binding to 185.31.41.11:", e.message);
    }
}
test();
