const fs = require('fs');
const users = JSON.parse(fs.readFileSync('./data/users.json'));
let wUsers = {};
try {
  wUsers = JSON.parse(fs.readFileSync('./data/whatsapp_users.json'));
} catch (e) {}

users.forEach(u => {
  if (u.phone) {
    let cleanPhone = String(u.phone).replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = '52' + cleanPhone;
    wUsers[`${cleanPhone}@s.whatsapp.net`] = u.id;
    if (cleanPhone.startsWith('52') && cleanPhone.length === 12) {
      const withOne = '521' + cleanPhone.substring(2);
      wUsers[`${withOne}@s.whatsapp.net`] = u.id;
    }
  }
});

fs.writeFileSync('./data/whatsapp_users.json', JSON.stringify(wUsers, null, 2));
console.log('Fixed whatsapp_users.json');
