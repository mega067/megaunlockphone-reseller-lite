const axios = require('axios');

async function test() {
    try {
        const res = await axios.post('https://megaunlockphone-panel.alwaysdata.net/api/bot/catalog', {
            botSecret: 'MEGA_BOT_SECRET_2026',
            serverId: '3'
        });
        console.log(JSON.stringify(res.data, null, 2));
    } catch(e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
test();
