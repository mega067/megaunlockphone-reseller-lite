const fs = require('fs');
let settings = JSON.parse(fs.readFileSync('data/settings.json'));
settings.server2.apiaccesskey = 'B29Q-G7EJ-A3OU-629Z-VQYO-5ZX9-F8SE-QCRU';
settings.server2.username = 'angeljuares067@gmail.com';
settings.server2.endpoint = 'https://popi-gsm.com/public/';
fs.writeFileSync('data/settings.json', JSON.stringify(settings, null, 2));
console.log('POPI updated!');
