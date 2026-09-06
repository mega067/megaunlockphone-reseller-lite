const axios = require('axios');
const path = require('path');
const fs = require('fs');

async function testSaldo() {
    try {
        const DATA_DIR = path.join(__dirname, 'data');
        const users = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json'), 'utf8'));
        const adminUser = users.find(u => u.role === 'admin');
        
        console.log('Using Admin ID:', adminUser ? adminUser.id : 'No admin found');
        
        const res = await axios.post('https://megaunlockphone-panel.alwaysdata.net/api/bot/saldo', {
            botSecret: 'MEGA_BOT_SECRET_2026',
            userId: adminUser ? adminUser.id : '1'
        });
        
        console.log('Success:', res.data);
    } catch (e) {
        console.error('Error:', e.response ? e.response.status + ' ' + JSON.stringify(e.response.data) : e.message);
    }
}
testSaldo();
