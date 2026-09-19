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
  require('dotenv').config();
  const queueFile = path.join(__dirname, '..', 'queue.json');
  let queue = [];
  try { if (fs.existsSync(queueFile)) queue = JSON.parse(fs.readFileSync(queueFile)); } catch(e) {}

  if (process.env.ADMIN_PHONE) {
    let cleanPhone = String(process.env.ADMIN_PHONE).replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = '52' + cleanPhone;
    queue.push({ type: 'direct', phoneId: `${cleanPhone}@s.whatsapp.net`, message });
    fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));
    return;
  }

  const users = readDB('users.json') || [];
  const admins = users.filter(u => u.role === 'admin');
  admins.forEach(admin => {
    queue.push({ type: 'private', message, userId: admin.id });
  });
  fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));
}

module.exports = {
  enqueueWhatsApp,
  enqueueWhatsAppAdmin
};
