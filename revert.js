const fs = require('fs');
let users = JSON.parse(fs.readFileSync('data/users.json'));
users.forEach(u => {
  u.credits_1 = u.credits_1 / 17.60;
  u.credits_2 = u.credits_2 / 17.60;
});
fs.writeFileSync('data/users.json', JSON.stringify(users, null, 2));
console.log('Reverted');
