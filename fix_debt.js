const fs = require('fs');
const path = './data/users.json';
if (fs.existsSync(path)) {
  let users = JSON.parse(fs.readFileSync(path, 'utf8'));
  users.forEach(u => {
    if (u.role === 'admin') {
      u.credits_1 = 0;
      u.credits_2 = 0;
      u.credits_3 = 0;
      u.credits = 0;
    }
  });
  fs.writeFileSync(path, JSON.stringify(users, null, 2));
  console.log('Fixed admin debts');
}
