const fs = require('fs');
const settingsPath = '/home/megaunlockphone-panel/www/data/settings.json';
const dbData = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

if (dbData.server3) {
    dbData.server3.apiaccesskey = 'U5T-3W2-3EB-1HM-RW-9DF-1C7-16Z';
    fs.writeFileSync(settingsPath, JSON.stringify(dbData, null, 2));
    console.log('Updated server3 API key');
} else {
    console.log('server3 not found in settings');
}
