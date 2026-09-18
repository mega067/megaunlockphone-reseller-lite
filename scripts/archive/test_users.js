const fs = require('fs');
const users = JSON.parse(fs.readFileSync('data/users.json'));
console.log(users.map(u => ({ id: u.id, type: typeof u.id })));
