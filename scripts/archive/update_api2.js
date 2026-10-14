const fs = require('fs');
const settingsPath = '/home/megaunlockphone-panel/www/data/settings.json';
const dbData = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

if (dbData.server3) {
    dbData.server3.apiaccesskey = '5RL-UD9-FQ7-311-H4S-NBK-SB2-9DB';
    fs.writeFileSync(settingsPath, JSON.stringify(dbData, null, 2));
    console.log('Updated server3 API key');
} else {
    console.log('server3 not found in settings');
}
