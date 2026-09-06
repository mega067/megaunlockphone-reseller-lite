const fs = require('fs');
let settings = JSON.parse(fs.readFileSync('data/settings.json'));
settings.exchangeRate = 17.60;
settings.server3 = {
  endpoint: "https://territorioremoto.com/",
  username: "angeljuares067",
  apiaccesskey: "0QT-IVG-18E-FVU-KKB-IGA-QOT-Q95"
};
fs.writeFileSync('data/settings.json', JSON.stringify(settings, null, 2));

let users = JSON.parse(fs.readFileSync('data/users.json'));
users.forEach(u => {
  u.credits_1 = (parseFloat(u.credits_1 || u.credits || 0) * 17.60);
  u.credits_2 = (parseFloat(u.credits_2 || 0) * 17.60);
  u.credits_3 = 0; // Initialize Territorio Remoto wallet
  if (u.credits !== undefined) delete u.credits; // cleanup old field
});
fs.writeFileSync('data/users.json', JSON.stringify(users, null, 2));

console.log('Migration complete');
