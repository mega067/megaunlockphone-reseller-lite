const fs = require('fs');
let s = JSON.parse(fs.readFileSync('data/settings.json'));
s.exchangeRate = 17.6;
if (!s.server3 || !s.server3.username) {
  s.server3 = {
    endpoint: "https://territorioremoto.com/",
    username: "angeljuares067",
    apiaccesskey: "0QT-IVG-18E-FVU-KKB-IGA-QOT-Q95",
    resellerMarkup: s.server3 ? s.server3.resellerMarkup || 0 : 0,
    clientMarkup: s.server3 ? s.server3.clientMarkup || 0 : 0
  };
}
fs.writeFileSync('data/settings.json', JSON.stringify(s, null, 2));
