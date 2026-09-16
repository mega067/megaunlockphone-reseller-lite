const axios = require('axios');
async function test() {
    try {
        const res = await axios.post('http://127.0.0.1:1337/api/bot/search', {
            botSecret: 'MEGA_BOT_SECRET_2026',
            userId: 1,
            serverId: '3',
            query: 'tsm'
        });
        console.log("Success:", res.data);
    } catch(e) {
        console.log("Error:", e.response ? e.response.data : e.message);
    }
}
test();
