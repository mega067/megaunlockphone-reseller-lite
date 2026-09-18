const fs = require('fs');
const path = require('path');
const { readDB } = require('./db');

function enqueueWhatsApp(type, message, userId = null) {
  const queueFile = path.join(__dirname, '..', 'queue.json');
  let queue = [];
  try {
    if (fs.existsSync(queueFile)) {
      queue = JSON.parse(fs.readFileSync(queueFile));
    }
  } catch(e) {}
  queue.push({ type, message, userId });
  fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));
}

function enqueueWhatsAppAdmin(message) {
  const users = readDB('users.json') || [];
  const admins = users.filter(u => u.role === 'admin');
  admins.forEach(admin => {
    enqueueWhatsApp('private', message, admin.id);
  });
}

module.exports = {
  enqueueWhatsApp,
  enqueueWhatsAppAdmin
};
