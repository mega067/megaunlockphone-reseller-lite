const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const { readDB, writeDB, DATA_DIR } = require('../db');
const { getServerId, getServerDisplayName, getUserCredit, setUserCredit } = require('../helpers');
const { incrementCatalogVersion } = require('../cacheManager');
const { enqueueWhatsApp, enqueueWhatsAppAdmin } = require('../whatsappQueue');
const { createAutoBackup } = require('./orderController');

const BACKUP_DIR = path.join(DATA_DIR, 'backups');

exports.getUsers = (req, res) => {
  const serverId = getServerId(req);
  const users = readDB('users.json') || [];
  res.json(users.map(u => {
     const currentCredits = getUserCredit(u, serverId);
     const credits1 = getUserCredit(u, '1');
     const credits2 = getUserCredit(u, '2');
     const credits3 = getUserCredit(u, '3');
     return { 
       id: u.id, 
       username: u.username, 
       role: u.role, 
       credits: currentCredits, 
       credits1: credits1,
       credits2: credits2,
       credits3: credits3,
       createdAt: u.createdAt, 
       password: u.password, 
       markup: u.markup 
     };
  }));
};

exports.changePassword = (req, res) => {
  const { password } = req.body;
  const userId = String(req.params.id);
  
  if (req.user.role !== 'admin' && String(req.user.id) !== userId) {
    return res.status(403).json({ error: 'Permiso denegado' });
  }
  
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Contraseña demasiado corta (mínimo 4 caracteres)' });
  }
  
  const users = readDB('users.json') || [];
  const userIndex = users.findIndex(u => String(u.id) === userId);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  
  users[userIndex].password = password;
  writeDB('users.json', users);
  
  res.json({ success: true });
};

exports.createUser = (req, res) => {
  const { username, password, credits, role, markup } = req.body;
  const users = readDB('users.json') || [];
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  const newUser = {
    id: Date.now(),
    username,
    password,
    role: role || 'reseller',
    markup: markup !== undefined && markup !== '' ? parseFloat(markup) : null,
    credits_1: parseFloat(credits) || 0,
    credits_2: 0,
    credits_3: 0,
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  writeDB('users.json', users);
  createAutoBackup('Nuevo_Usuario');
  incrementCatalogVersion();
  res.json(newUser);
};

exports.updateUser = (req, res) => {
  const { credits, password, role, markup } = req.body;
  const serverId = getServerId(req);
  const users = readDB('users.json') || [];
  const user = users.find(u => String(u.id) === String(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (credits !== undefined) {
    const oldCredit = getUserCredit(user, serverId);
    setUserCredit(user, serverId, credits);
    
    if (parseFloat(credits) !== oldCredit) {
      const isAdd = parseFloat(credits) > oldCredit;
      const amount = Math.abs(parseFloat(credits) - oldCredit);
      const settingsDb = readDB('settings.json') || {};
      const exRate = parseFloat(settingsDb.exchangeRate || 17.6);
      const usdEq = (amount / exRate).toFixed(3);
      
      const resMsg = `💰 *${isAdd ? 'RECARGA EXITOSA' : 'SALDO DESCONTADO'}*\n\n📥 Tu saldo ha sido actualizado correctamente\n\n💳 Método: Ajuste de Panel\n💵 Monto: $${amount.toFixed(2)} MXN\n💱 Equivalente USD: $${usdEq} USD\n💱 Tipo de cambio: ${exRate} MXN por USD\n✅ Saldo acreditado: $${amount.toFixed(2)} MXN\n📉 Saldo anterior: $${oldCredit.toFixed(2)} MXN\n📈 Saldo actual: $${parseFloat(credits).toFixed(2)} MXN\n\n━━━━━━━━━━━━━━\n🌐 MegaUnlockPhone`;
      enqueueWhatsApp('private', resMsg, user.id);
      
      const adminMsg = `🤑 *Notificación de Saldo (Admin)*\n\nSe ha ${isAdd ? 'agregado' : 'descontado'} $${amount.toFixed(2)} al usuario *${user.username}* en *${getServerDisplayName(serverId)}*.\nNuevo saldo: $${parseFloat(credits).toFixed(2)}`;
      enqueueWhatsApp('group', adminMsg);
    }
  }
  if (password) user.password = password;
  if (role && user.role !== role) {
    const oldRole = user.role || 'reseller';
    if (role === 'colaborador') {
      const msg = `🎉 *¡Felicidades!*\n\nTu cuenta ha sido promovida a *Colaborador*.\nAhora tienes acceso para ajustar los precios de venta para clientes y revendedores.`;
      enqueueWhatsApp('private', msg, user.id);
    }
    const adminMsgRole = `👤 *Cambio de Rol (Admin)*\nEl usuario *${user.username}* ha cambiado de rol.\nDe: ${oldRole.toUpperCase()}\nA: ${role.toUpperCase()}`;
    enqueueWhatsAppAdmin(adminMsgRole);
    user.role = role;
  }
  if (markup !== undefined) {
    user.markup = (markup === '' || markup === null) ? null : parseFloat(markup);
  }

  writeDB('users.json', users);
  createAutoBackup('Actualizacion_Saldo_O_Clave_S' + serverId);
  incrementCatalogVersion();
  res.json(user);
};

exports.deleteUser = (req, res) => {
  const users = readDB('users.json') || [];
  if (String(req.params.id) === String(req.user.id)) return res.status(400).json({ error: 'Cannot delete yourself' });
  
  const newUsers = users.filter(u => String(u.id) !== String(req.params.id));
  writeDB('users.json', newUsers);
  createAutoBackup('Eliminacion_Usuario');
  res.json({ success: true });
};

exports.getStats = (req, res) => {
  const settings = readDB('settings.json') || {};
  res.json({ profitBalance: settings.adminProfitBalance || 0 });
};

exports.getSettings = (req, res) => {
  const settings = readDB('settings.json') || {};
  
  const safeSettings = { exchangeRate: settings.exchangeRate || 17.60 };
  
  if (settings.server1) safeSettings.server1 = { resellerMarkup: settings.server1.resellerMarkup, clientMarkup: settings.server1.clientMarkup };
  if (settings.server2) safeSettings.server2 = { resellerMarkup: settings.server2.resellerMarkup, clientMarkup: settings.server2.clientMarkup };
  if (settings.server3) safeSettings.server3 = { resellerMarkup: settings.server3.resellerMarkup, clientMarkup: settings.server3.clientMarkup };
  
  res.json(safeSettings);
};

exports.updateSettings = (req, res) => {
  const { server1, server2, server3, exchangeRate } = req.body;
  const settings = readDB('settings.json') || {};
  if (server1) {
    settings.server1 = settings.server1 || {};
    settings.server1.resellerMarkup = parseFloat(server1.resellerMarkup) || 0;
    settings.server1.clientMarkup = parseFloat(server1.clientMarkup) || 0;
  }
  if (server2) {
    settings.server2 = settings.server2 || {};
    settings.server2.resellerMarkup = parseFloat(server2.resellerMarkup) || 0;
    settings.server2.clientMarkup = parseFloat(server2.clientMarkup) || 0;
  }
  if (server3) {
    settings.server3 = settings.server3 || {};
    settings.server3.resellerMarkup = parseFloat(server3.resellerMarkup) || 0;
    settings.server3.clientMarkup = parseFloat(server3.clientMarkup) || 0;
  }
  if (exchangeRate !== undefined) {
    settings.exchangeRate = parseFloat(exchangeRate) || 17.60;
  }
  writeDB('settings.json', settings);
  incrementCatalogVersion();
  res.json(settings);
};

exports.startBot = (req, res) => {
  const botPath = path.join(__dirname, '..', '..', 'whatsappBot.js');
  const botLogPath = path.join(__dirname, '..', '..', 'bot_logs.txt');
  exec('pkill -9 -f "node whatsappBot.js"', () => {
    try {
      const out = fs.openSync(botLogPath, 'a');
      const errLog = fs.openSync(botLogPath, 'a');
      
      const child = spawn(process.execPath, [botPath], {
        detached: true,
        cwd: path.join(__dirname, '..', '..'),
        stdio: [ 'ignore', out, errLog ]
      });
      
      child.on('error', (err) => {
        fs.appendFileSync(botLogPath, 'Error al spawnear bot: ' + err.message + '\\n');
      });
      
      child.unref();
      res.json({ message: 'Bot encendido forzosamente exitoso (PID: ' + child.pid + '). Tardará 1-2 minutos en conectarse.' });
    } catch (e) {
      res.status(500).json({ error: 'Error al iniciar el bot: ' + e.message });
    }
  });
};

exports.stopBot = (req, res) => {
  exec('pkill -9 -f "node whatsappBot.js"', (err) => {
    res.json({ message: 'Se envió la orden de apagar al bot.' });
  });
};

exports.getBotLogs = (req, res) => {
  try {
    const logPath = path.join(__dirname, '..', '..', 'bot_logs.txt');
    if (!fs.existsSync(logPath)) return res.json({ logs: 'No hay logs todavía.' });
    
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.trim().split('\\n');
    const lastLines = lines.slice(-30).join('\\n');
    res.json({ logs: lastLines || 'Logs vacíos.' });
  } catch (e) {
    res.status(500).json({ error: 'Error leyendo logs: ' + e.message });
  }
};

exports.getBackup = (req, res) => {
  const users = readDB('users.json') || [];
  const history = readDB('history.json') || [];
  const prices = readDB('prices.json') || {};
  const customPrices = readDB('custom_prices.json') || {};
  const userCustomPrices = readDB('user_custom_prices.json') || {};
  const settings = readDB('settings.json') || {};
  const coupons = readDB('coupons.json') || [];
  
  res.json({
    users,
    history,
    prices,
    customPrices,
    userCustomPrices,
    settings,
    coupons,
    exportDate: new Date().toISOString()
  });
};

exports.restoreBackup = (req, res) => {
  const backup = req.body;
  if (!backup || typeof backup !== 'object') {
    return res.status(400).json({ error: 'Archivo de respaldo inválido.' });
  }

  try {
    if (backup.users) writeDB('users.json', backup.users);
    if (backup.history) writeDB('history.json', backup.history);
    if (backup.prices) writeDB('prices.json', backup.prices);
    if (backup.customPrices) writeDB('custom_prices.json', backup.customPrices);
    if (backup.userCustomPrices) writeDB('user_custom_prices.json', backup.userCustomPrices);
    if (backup.settings) writeDB('settings.json', backup.settings);
    if (backup.coupons) writeDB('coupons.json', backup.coupons);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Restore Error:', err);
    res.status(500).json({ error: 'Error al restaurar el archivo.' });
  }
};

exports.getAutoBackups = (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return res.json([]);
    let files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json') && f.startsWith('autobackup_'));
    files.sort().reverse();
    
    const fileData = files.map(filename => {
      const stats = fs.statSync(path.join(BACKUP_DIR, filename));
      return {
        filename,
        size: stats.size,
        date: stats.mtime
      };
    });
    res.json(fileData);
  } catch(e) {
    res.status(500).json({ error: 'Error al leer backups automáticos.' });
  }
};

exports.downloadAutoBackup = (req, res) => {
  const filename = req.params.filename;
  if (!filename.startsWith('autobackup_') || !filename.endsWith('.json')) {
    return res.status(400).json({ error: 'Archivo inválido.' });
  }
  const filepath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Respaldo no encontrado.' });
  }
  res.download(filepath);
};

exports.getCoupons = (req, res) => {
  const coupons = readDB('coupons.json') || [];
  res.json(coupons);
};

exports.createCoupon = (req, res) => {
  const { serviceName, normalPrice, promoPrice, showPercentage, conditions, maxRedemptions, imageUrl } = req.body;
  if (!serviceName || !promoPrice) {
    return res.status(400).json({ error: 'Faltan datos requeridos (Servicio y Precio Promo)' });
  }

  const code = 'MEGA-' + Math.random().toString(36).substr(2, 4).toUpperCase() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
  
  const newCoupon = {
    code,
    serviceName,
    imageUrl: imageUrl || '',
    normalPrice: normalPrice ? parseFloat(normalPrice) : null,
    promoPrice: parseFloat(promoPrice),
    showPercentage: !!showPercentage,
    conditions: conditions || '',
    maxRedemptions: parseInt(maxRedemptions) || 1,
    currentRedemptions: 0,
    status: 'active',
    createdAt: new Date().toISOString(),
    redeemedAt: null,
    redeemedBy: null
  };

  let coupons = readDB('coupons.json') || [];
  coupons.unshift(newCoupon);
  writeDB('coupons.json', coupons);
  createAutoBackup('Nuevo_Cupon');

  res.json({ success: true, coupon: newCoupon });
};

exports.redeemCoupon = (req, res) => {
  const { code, username } = req.body;
  if (!code || !username) {
    return res.status(400).json({ error: 'Falta código o usuario' });
  }

  let coupons = readDB('coupons.json') || [];
  const couponIndex = coupons.findIndex(c => c.code === code);
  
  if (couponIndex === -1) {
    return res.status(404).json({ error: 'Cupón no encontrado' });
  }
  
  if (coupons[couponIndex].status === 'redeemed' || (coupons[couponIndex].currentRedemptions || 0) >= (coupons[couponIndex].maxRedemptions || 1)) {
    return res.status(400).json({ error: 'El cupón ya ha alcanzado su límite de canjes' });
  }

  coupons[couponIndex].currentRedemptions = (coupons[couponIndex].currentRedemptions || 0) + 1;
  coupons[couponIndex].redeemedAt = new Date().toISOString();
  
  if (coupons[couponIndex].redeemedBy) {
    coupons[couponIndex].redeemedBy += ', ' + username;
  } else {
    coupons[couponIndex].redeemedBy = username;
  }

  if (coupons[couponIndex].currentRedemptions >= (coupons[couponIndex].maxRedemptions || 1)) {
    coupons[couponIndex].status = 'redeemed';
  }

  writeDB('coupons.json', coupons);
  createAutoBackup('Canje_Cupon');

  res.json({ success: true, coupon: coupons[couponIndex] });
};

exports.deleteCoupon = (req, res) => {
  const code = req.params.code;
  let coupons = readDB('coupons.json') || [];
  
  const filtered = coupons.filter(c => c.code !== code);
  if (filtered.length === coupons.length) {
    return res.status(404).json({ error: 'Cupón no encontrado' });
  }
  
  writeDB('coupons.json', filtered);
  createAutoBackup('Eliminar_Cupon');
  res.json({ success: true });
};
