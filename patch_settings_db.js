const fs = require('fs');
const settingsPath = 'data/settings.json';
let settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

if (!settings.server1) {
  const newSettings = {
    server1: {
      name: 'LatamGSM',
      endpoint: settings.endpoint || 'https://latamgsm.com/dhru/',
      username: settings.masterUsername || '',
      apiaccesskey: settings.apiaccesskey || '',
      resellerMarkup: settings.resellerMarkup || 0,
      clientMarkup: settings.clientMarkup || 0
    },
    server2: {
      name: 'POPI-GSM',
      endpoint: 'https://popi-gsm.com/public/',
      username: 'angeljuares067@gmail.com',
      apiaccesskey: 'B29Q-G7EJ-A3OU-629Z-VQYO-5ZX9-F8SE-QCRU',
      resellerMarkup: 0,
      clientMarkup: 0
    }
  };
  fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2));
  console.log('Migrated settings.json successfully.');
} else {
  console.log('Settings already migrated.');
}
