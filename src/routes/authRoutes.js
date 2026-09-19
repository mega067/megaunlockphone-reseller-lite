const express = require('express');
const router = express.Router();
const { readDB, writeDB } = require('../db');
const { generateToken, requireAuth } = require('../auth');
const { enqueueWhatsApp, enqueueWhatsAppAdmin } = require('../whatsappQueue');
const rateLimit = require('express-rate-limit');

// Rate limiting para login (prevenir brute force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 intentos por IP
  message: { error: 'Demasiados intentos de inicio de sesión, por favor intenta más tarde.' }
});

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  const users = readDB('users.json') || [];
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  
  const token = generateToken(user);
  res.json({ token, role: user.role, username: user.username, credits: user.credits, uid: user.id });
});

router.get('/me', requireAuth, (req, res) => {
  const users = readDB('users.json') || [];
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ username: user.username, role: user.role, credits: user.credits, uid: user.id });
});

const fs = require('fs');
const path = require('path');

// Register (Generates OTP)
router.post('/register', loginLimiter, (req, res) => {
  const { username, password, phone } = req.body;
  if (!username || !password || !phone) return res.status(400).json({ error: 'Faltan datos requeridos.' });

  const users = readDB('users.json') || [];
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ error: 'El nombre de usuario ya está en uso.' });
  }

  // Clean phone string
  let cleanPhone = String(phone).replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    // If it's exactly 10 digits, assume Mexican
    cleanPhone = '52' + cleanPhone;
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Save to pendingUsers
  const pendingUsers = readDB('pendingUsers.json') || {};
  pendingUsers[cleanPhone] = {
    username,
    password, 
    phone: cleanPhone,
    otp,
    expires: Date.now() + 10 * 60 * 1000 // 10 minutes
  };
  writeDB('pendingUsers.json', pendingUsers);

  // Push to WhatsApp Queue
  const queuePath = path.join(__dirname, '../../queue.json');
  let queue = [];
  try { if (fs.existsSync(queuePath)) queue = JSON.parse(fs.readFileSync(queuePath)); } catch(e) {}
  
  queue.push({
    type: 'direct',
    phoneId: `${cleanPhone}@s.whatsapp.net`,
    message: `👋 ¡Hola ${username}!\n\nTu código de verificación para *MegaUnlockPhone* es:\n\n*${otp}*\n\nEste código expira en 10 minutos.`
  });
  fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));

  res.json({ success: true, message: 'OTP enviado por WhatsApp.', phone: cleanPhone });
});

// Verify OTP
router.post('/verify-otp', (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ error: 'Faltan datos requeridos.' });

  const pendingUsers = readDB('pendingUsers.json') || {};
  const pending = pendingUsers[phone];

  if (!pending) return res.status(400).json({ error: 'No hay un registro pendiente para este número.' });
  if (Date.now() > pending.expires) {
    delete pendingUsers[phone];
    writeDB('pendingUsers.json', pendingUsers);
    return res.status(400).json({ error: 'El código ha expirado.' });
  }
  if (pending.otp !== String(otp).trim()) {
    return res.status(400).json({ error: 'Código incorrecto.' });
  }

  // Create User
  const users = readDB('users.json') || [];
  const newId = 'u-' + Date.now();
  const newUser = {
    id: newId,
    username: pending.username,
    password: pending.password,
    role: 'reseller', // Reseller by default as requested
    credits: 0,
    phone: pending.phone,
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  writeDB('users.json', users);

  // Link WhatsApp automatically
  const wUsers = readDB('whatsapp_users.json') || {};
  wUsers[`${pending.phone}@s.whatsapp.net`] = newId;
  writeDB('whatsapp_users.json', wUsers);

  // Cleanup pending
  delete pendingUsers[phone];
  writeDB('pendingUsers.json', pendingUsers);

  // Notify Admin
  const adminMsg = `🆕 *Nuevo Usuario Registrado*\n\nSe ha registrado exitosamente un nuevo usuario:\n\n👤 Usuario: ${newUser.username}\n📱 Teléfono: ${newUser.phone}\n\nEl usuario ya está activo en el panel.`;
  enqueueWhatsAppAdmin(adminMsg);
  enqueueWhatsApp('group', adminMsg);

  const token = generateToken(newUser);
  res.json({ success: true, token, role: newUser.role, username: newUser.username, credits: newUser.credits, uid: newUser.id });
});

module.exports = router;
