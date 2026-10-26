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

function isWeakPassword(password) {
  if (!password || password.length < 6) return true;
  if (!/[A-Z]/.test(password)) return true;
  // Check for repeated chars like 111, aaa
  if (/(.)\1{2,}/.test(password)) return true;
  // Check for simple sequences
  if (/123|234|345|456|567|678|789|890|098|987|876|765|654|543|432|321/.test(password)) return true;
  return false;
}

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  const users = readDB('users.json') || [];
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
  
  if (!user) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  if (user.isActive === false && user.role !== 'admin') {
    return res.status(403).json({ error: 'Tu cuenta ha sido desactivada por el administrador. Contacta a soporte para reactivarla.' });
  }
  
  const token = generateToken(user);
  res.json({ 
    token, 
    role: user.role, 
    username: user.username, 
    credits: user.credits, 
    uid: user.id,
    weakPassword: isWeakPassword(user.password)
  });
});

router.get('/me', requireAuth, (req, res) => {
  const users = readDB('users.json') || [];
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const wUsers = readDB('whatsapp_users.json') || {};
  let isLinkedToBot = false;
  for (const [jid, uid] of Object.entries(wUsers)) {
    if (String(uid) === String(user.id)) {
      isLinkedToBot = true;
      break;
    }
  }

  const ticketConfigs = readDB('ticket_configs.json') || {};
  const userTicketConfig = ticketConfigs[user.id] || {};
  const logoExt = userTicketConfig.logoExt || '';

  res.json({ 
    username: user.username, 
    role: user.role, 
    credits: user.credits, 
    uid: user.id, 
    phone: user.phone || '',
    email: user.email || '',
    createdAt: user.createdAt || '',
    isLinkedToBot,
    logoUrl: logoExt ? `/logos/${user.id}${logoExt}` : '',
    weakPassword: isWeakPassword(user.password) 
  });
});


const fs = require('fs');
const path = require('path');

// Register (Generates OTP)
router.post('/register', loginLimiter, (req, res) => {
  const { username, password, phone, email } = req.body;
  if (!username || !password || !phone || !email) return res.status(400).json({ error: 'Faltan datos requeridos.' });
  
  if (isWeakPassword(password)) {
    return res.status(400).json({ error: 'La contraseña es demasiado débil. Debe tener al menos 6 caracteres, una mayúscula y no ser secuencias simples como 123 o 111.' });
  }

  // Clean phone string
  let cleanPhone = String(phone).replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '52' + cleanPhone;
  }

  const users = readDB('users.json') || [];
  if (users.some(u => u.username && u.username.toLowerCase() === username.trim().toLowerCase())) {
    return res.status(400).json({ error: 'El nombre de usuario ya está registrado. Por favor elige otro o inicia sesión.' });
  }

  const existingByPhone = users.find(u => {
    if (!u.phone) return false;
    const uClean = String(u.phone).replace(/\D/g, '');
    return uClean === cleanPhone || (uClean.length >= 10 && cleanPhone.endsWith(uClean.slice(-10)));
  });

  if (existingByPhone) {
    return res.status(400).json({ 
      error: `Este número de teléfono ya está registrado en la cuenta "${existingByPhone.username}". Si olvidaste tu contraseña, usa la opción de "Recuperar contraseña".`,
      existingUsername: existingByPhone.username
    });
  }

  if (email && email.trim()) {
    const existingByEmail = users.find(u => u.email && u.email.trim().toLowerCase() === email.trim().toLowerCase());
    if (existingByEmail) {
      return res.status(400).json({ 
        error: `El correo electrónico ya está registrado en la cuenta "${existingByEmail.username}".`,
        existingUsername: existingByEmail.username
      });
    }
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Save to pendingUsers
  const pendingUsers = readDB('pendingUsers.json') || {};
  
  pendingUsers[cleanPhone] = {
    username, password, phone: cleanPhone, email: email.trim(),
    otp, expires: Date.now() + 10 * 60 * 1000 // 10 minutes
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
    email: pending.email,
    createdAt: new Date().toISOString()
  };
  
  if (pending.username.toLowerCase().startsWith('test_')) {
    // MODO PRUEBA: No guardar en DB, solo simular
    const token = generateToken(newUser);
    delete pendingUsers[phone];
    writeDB('pendingUsers.json', pendingUsers);
    return res.json({ success: true, token, role: newUser.role, username: newUser.username, credits: newUser.credits, uid: newUser.id, testMode: true });
  }
  
  users.push(newUser);
  writeDB('users.json', users);

  // Link WhatsApp automatically (1 solo chat canónico por usuario)
  const wUsers = readDB('whatsapp_users.json') || {};
  let targetPhone = pending.phone;
  if (targetPhone.startsWith('52') && targetPhone.length === 12) {
    targetPhone = '521' + targetPhone.substring(2);
  }
  // Limpiar cualquier enlace anterior para este usuario
  for (const [k, v] of Object.entries(wUsers)) {
    if (String(v) === String(newId)) delete wUsers[k];
  }
  wUsers[`${targetPhone}@s.whatsapp.net`] = newId;
  writeDB('whatsapp_users.json', wUsers);

  // Cleanup pending
  delete pendingUsers[phone];
  writeDB('pendingUsers.json', pendingUsers);

  // Notify Admin
  const adminMsg = `🆕 *Nuevo Usuario Registrado*\n\nSe ha registrado exitosamente un nuevo usuario:\n\n👤 ID de Usuario: ${newUser.id}\n\nEl usuario ya está activo en el panel.`;
  enqueueWhatsAppAdmin(adminMsg);
  enqueueWhatsApp('group', adminMsg);

  const token = generateToken(newUser);
  res.json({ success: true, token, role: newUser.role, username: newUser.username, credits: newUser.credits, uid: newUser.id });
});

// --- ACCOUNT RECOVERY FLOW ---
global.recoveryCodes = global.recoveryCodes || {};

router.post('/request-recovery', async (req, res) => {
  const { username, phone } = req.body;
  if (!username && !phone) return res.status(400).json({ error: 'Ingresa tu nombre de usuario o número de WhatsApp.' });

  const users = readDB('users.json') || [];
  let user = null;

  if (username && username.trim()) {
    user = users.find(u => u.username && u.username.toLowerCase() === username.trim().toLowerCase());
  }

  const cleanPhone = phone ? String(phone).replace(/\D/g, '') : '';
  if (!user && cleanPhone) {
    user = users.find(u => {
      if (!u.phone) return false;
      const uClean = String(u.phone).replace(/\D/g, '');
      return uClean === cleanPhone || (uClean.length >= 10 && cleanPhone.endsWith(uClean.slice(-10)));
    });
  }
  
  if (!user) {
    return res.status(404).json({ error: 'No se encontró ninguna cuenta asociada a esos datos.' });
  }

  // Check if they have WhatsApp linked or at least a registered phone number
  const wUsers = readDB('whatsapp_users.json') || {};
  let targetPhone = user.phone ? String(user.phone).replace(/\D/g, '') : null;
  
  // Si tiene un JID vinculado directamente, usarlo
  const linkedPhoneId = Object.keys(wUsers).find(key => String(wUsers[key]) === String(user.id));
  if (linkedPhoneId) {
    targetPhone = linkedPhoneId.split('@')[0].replace(/\D/g, '');
  }

  if (!targetPhone) {
    return res.status(400).json({ 
      error: 'La cuenta no tiene un número de WhatsApp registrado para recibir el código. Por favor contacta a un administrador para restablecerla.',
      canContactAdmin: true
    });
  }

  if (targetPhone.length === 10) targetPhone = '52' + targetPhone;

  // Generate 6 digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Store code with 15 mins expiration
  global.recoveryCodes[user.username.toLowerCase()] = {
    code: code,
    userId: user.id,
    expires: Date.now() + 15 * 60 * 1000
  };

  // Push directly to WhatsApp Queue
  const queuePath = path.join(__dirname, '../../queue.json');
  let queue = [];
  try { if (fs.existsSync(queuePath)) queue = JSON.parse(fs.readFileSync(queuePath)); } catch(e) {}
  
  queue.push({
    type: 'direct',
    phoneId: `${targetPhone}@s.whatsapp.net`,
    message: `🔒 *Recuperación de Cuenta - MegaUnlockPhone*\n\nHola *${user.username}*, has solicitado restablecer tu contraseña.\n\n🔑 Tu código de seguridad es:\n*${code}*\n\n_Este código expira en 15 minutos._\nSi tú no realizaste esta solicitud, ignora este mensaje.`
  });
  fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));

  res.json({ 
    success: true, 
    message: `Código de recuperación enviado por WhatsApp al número terminado en **${targetPhone.slice(-4)}**.`,
    username: user.username,
    phoneMasked: targetPhone.replace(/(\d{3})\d+(\d{2})/, '$1****$2')
  });
});

router.post('/reset-password', async (req, res) => {
  const { username, code, newPassword } = req.body;
  
  if (!username || !code || !newPassword) {
    return res.status(400).json({ error: 'Faltan datos requeridos.' });
  }

  const normalizedUsername = username.toLowerCase();
  const recoverySession = global.recoveryCodes[normalizedUsername];

  if (!recoverySession) {
    return res.status(400).json({ error: 'No hay ninguna solicitud de recuperación activa o el código expiró.' });
  }

  if (Date.now() > recoverySession.expires) {
    delete global.recoveryCodes[normalizedUsername];
    return res.status(400).json({ error: 'El código de recuperación ha expirado.' });
  }

  if (recoverySession.code !== code.toString().trim()) {
    return res.status(400).json({ error: 'El código es incorrecto.' });
  }

  const users = readDB('users.json') || [];
  const userIndex = users.findIndex(u => u.username.toLowerCase() === normalizedUsername);

  if (userIndex === -1) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  // Update password
  users[userIndex].password = newPassword;
  writeDB('users.json', users);

  // Clear code
  delete global.recoveryCodes[normalizedUsername];

  // Notify user
  enqueueWhatsApp('private', `✅ *Contraseña Restablecida*\n\nTu contraseña ha sido actualizada exitosamente. Si no fuiste tú, contacta a un administrador de inmediato.`, users[userIndex].id);

  res.json({ success: true, message: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión.' });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword) return res.status(400).json({ error: 'Falta la contraseña actual' });
  if (!newPassword) return res.status(400).json({ error: 'Falta la nueva contraseña' });
  
  if (isWeakPassword(newPassword)) {
    return res.status(400).json({ error: 'La contraseña es demasiado débil. Debe tener al menos 6 caracteres, una mayúscula y no ser secuencias simples como 123 o 111.' });
  }

  const users = readDB('users.json') || [];
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  if (user.password !== currentPassword) {
    return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
  }
  
  user.password = newPassword;
  writeDB('users.json', users);
  res.json({ success: true, message: 'Contraseña actualizada' });
});

router.post('/change-phone', requireAuth, (req, res) => {
  const { currentPassword, newPhone } = req.body;
  if (!currentPassword) return res.status(400).json({ error: 'Falta la contraseña actual' });
  if (!newPhone) return res.status(400).json({ error: 'Falta el nuevo número' });
  
  const users = readDB('users.json') || [];
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  if (user.password !== currentPassword) {
    return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
  }
  
  let cleanPhone = String(newPhone).replace(/\D/g, '');
  if (cleanPhone.length === 10) cleanPhone = '52' + cleanPhone;
  
  // Update in whatsapp_users as well (1 solo chat por usuario)
  const wUsers = readDB('whatsapp_users.json') || {};
  // Find and remove old phone
  for (const [key, val] of Object.entries(wUsers)) {
    if (String(val) === String(user.id)) delete wUsers[key];
  }
  
  user.phone = cleanPhone;
  let targetPhone = cleanPhone;
  if (targetPhone.startsWith('52') && targetPhone.length === 12) {
    targetPhone = '521' + targetPhone.substring(2);
  }
  wUsers[`${targetPhone}@s.whatsapp.net`] = user.id;
  
  writeDB('users.json', users);
  writeDB('whatsapp_users.json', wUsers);
  
  res.json({ success: true, message: 'Número de WhatsApp actualizado' });
});

// Endpoint de verificación y rescate de cuenta alternativo (por si WhatsApp Bot está en mantenimiento)
router.post('/verify-account', loginLimiter, (req, res) => {
  const { username, email, phone } = req.body;
  if (!username) return res.status(400).json({ error: 'Se requiere el nombre de usuario.' });

  const users = readDB('users.json') || [];
  const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  // Validación de coincidencia de correo o teléfono
  const cleanPhone = phone ? String(phone).replace(/\D/g, '') : '';
  const matchEmail = email && user.email && user.email.toLowerCase() === email.trim().toLowerCase();
  const matchPhone = cleanPhone && user.phone && (user.phone.includes(cleanPhone) || cleanPhone.includes(user.phone));

  if (!matchEmail && !matchPhone) {
    return res.status(400).json({ 
      error: 'Los datos proporcionados no coinciden con los registros de la cuenta.',
      supportHelp: 'Si el bot no responde, contacta directamente al administrador.'
    });
  }

  const wUsers = readDB('whatsapp_users.json') || {};
  let isLinkedToWhatsapp = false;
  for (const [jid, uid] of Object.entries(wUsers)) {
    if (String(uid) === String(user.id)) {
      isLinkedToWhatsapp = true;
      break;
    }
  }

  res.json({
    success: true,
    accountStatus: 'active',
    username: user.username,
    role: user.role,
    credits: user.credits,
    isLinkedToWhatsapp,
    phoneMasked: user.phone ? user.phone.replace(/(\d{3})\d+(\d{2})/, '$1****$2') : 'No registrado',
    emailMasked: user.email ? user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'No registrado'
  });
});

module.exports = router;
