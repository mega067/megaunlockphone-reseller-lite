const axios = require('axios');
async function test() {
    try {
        const res = await axios.post('http://127.0.0.1:3000/api/bot/search', {
            botSecret: 'MEGA_BOT_SECRET_2026',
            userId: 1, // Number
            serverId: '3',
            query: 'tsm'
        });
        console.log("Success:", JSON.stringify(res.data.results.slice(0, 3), null, 2));
    } catch(e) {
        console.log("Error:", e.response ? e.response.data : e.message);
    }
}
test();
