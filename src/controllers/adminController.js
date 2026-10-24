const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const { readDB, writeDB, DATA_DIR } = require('../db');
const { getServerId, getServerDisplayName, getUserCredit, setUserCredit, logRecharge } = require('../helpers');
const { incrementCatalogVersion } = require('../cacheManager');
const { enqueueWhatsApp, enqueueWhatsAppAdmin } = require('../whatsappQueue');
const { createAutoBackup } = require('./orderController');

const BACKUP_DIR = path.join(DATA_DIR, 'backups');

exports.getUsers = (req, res) => {
  const serverId = getServerId(req);
  const users = readDB('users.json') || [];
  const wUsers = readDB('whatsapp_users.json') || {};
  const history = readDB('history.json') || [];
  
  // Contar pedidos históricos por usuario
  const orderCountsByUser = {};
  history.forEach(h => {
    if (h.userId) {
      const uKey = String(h.userId);
      orderCountsByUser[uKey] = (orderCountsByUser[uKey] || 0) + 1;
    }
  });

  const ticketConfigs = readDB('ticket_configs.json') || {};
  
  res.json(users.map(u => {
     const currentCredits = getUserCredit(u, serverId);
     const credits1 = getUserCredit(u, '1');
     const credits2 = getUserCredit(u, '2');
     const credits3 = getUserCredit(u, '3');
     
     // Check if bot is linked (either in WhatsAppLinks table or auto-linked by verified phone)
     const isExplicitlyLinked = Object.keys(wUsers).some(key => wUsers[key] === u.id);
     const hasCleanPhone = !!(u.phone && String(u.phone).replace(/\D/g, '').length >= 10);
     const linkedBot = isExplicitlyLinked || hasCleanPhone;
     
     const uCfg = ticketConfigs[String(u.id)] || {};
     const logoUrl = uCfg.logoExt ? `/logos/${u.id}${uCfg.logoExt}` : '';

     return { 
       id: u.id, 
       username: u.username, 
       role: u.role, 
       isActive: u.isActive !== false,
       credits: currentCredits, 
       credits1: credits1,
       credits2: credits2,
       credits3: credits3,
       totalOrders: orderCountsByUser[String(u.id)] || 0,
       logoUrl: logoUrl,
       createdAt: u.createdAt, 
       password: u.password, 
       markup: u.markup,
       phone: u.phone || '-',
       email: u.email || '-',
       linkedBot: linkedBot,
       isApiEnabled: Boolean(u.isApiEnabled)
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

  if (parseFloat(credits) > 0) {
    const adminUsername = req.user ? req.user.username : 'Admin';
    logRecharge(newUser.id, newUser.username, parseFloat(credits), 'MANUAL_ADMIN', adminUsername, '1', {
      note: 'Saldo inicial asignado al crear usuario'
    });
  }

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
      const signedDelta = parseFloat(credits) - oldCredit;
      const settingsDb = readDB('settings.json') || {};
      const exRate = parseFloat(settingsDb.exchangeRate || 17.6);
      const usdEq = (amount / exRate).toFixed(3);
      const adminUsername = req.user ? req.user.username : 'Admin';

      // Registrar en el historial de recargas (recharges.json)
      logRecharge(user.id, user.username, signedDelta, 'MANUAL_ADMIN', adminUsername, serverId, {
        note: isAdd ? `Saldo asignado desde Panel Admin (${getServerDisplayName(serverId)})` : `Saldo descontado desde Panel Admin (${getServerDisplayName(serverId)})`
      });
      
      const resMsg = `💰 *${isAdd ? 'RECARGA EXITOSA' : 'SALDO DESCONTADO'}*\n\n📥 Tu saldo ha sido actualizado correctamente\n\n💳 Método: Ajuste de Panel\n💵 Monto: $${amount.toFixed(2)} MXN\n💱 Equivalente USD: $${usdEq} USD\n💱 Tipo de cambio: ${exRate} MXN por USD\n✅ Saldo acreditado: $${amount.toFixed(2)} MXN\n📉 Saldo anterior: $${oldCredit.toFixed(2)} MXN\n📈 Saldo actual: $${parseFloat(credits).toFixed(2)} MXN\n\n━━━━━━━━━━━━━━\n🌐 MegaUnlockPhone`;
      enqueueWhatsApp('private', resMsg, user.id);
      
      const adminMsg = `🤑 *Notificación de Saldo (Admin)*\n\nSe ha ${isAdd ? 'agregado' : 'descontado'} $${amount.toFixed(2)} al usuario ID *${user.id}* en *${getServerDisplayName(serverId)}*.\nNuevo saldo: $${parseFloat(credits).toFixed(2)}`;
      enqueueWhatsAppAdmin(adminMsg);
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
  if (req.body.isActive !== undefined && user.role !== 'admin') {
    user.isActive = Boolean(req.body.isActive);
  }
  if (req.body.isApiEnabled !== undefined) {
    user.isApiEnabled = Boolean(req.body.isApiEnabled);
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

exports.impersonateUser = (req, res) => {
  const targetUserId = String(req.params.id);
  const users = readDB('users.json') || [];
  const targetUser = users.find(u => String(u.id) === targetUserId);

  if (!targetUser) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  const { generateToken } = require('../auth');
  const token = generateToken(targetUser);

  res.json({
    success: true,
    token: token,
    user: {
      id: targetUser.id,
      username: targetUser.username,
      role: targetUser.role || 'reseller'
    }
  });
};

exports.getStats = (req, res) => {
  const settings = readDB('settings.json') || {};
  res.json({ profitBalance: settings.adminProfitBalance || 0 });
};

exports.getSettings = (req, res) => {
  const settings = readDB('settings.json') || {};
  
  const safeSettings = { 
    exchangeRate: settings.exchangeRate || 17.60,
    creditCushion: settings.creditCushion || 0
  };

  // Mask API access key for security when returning settings, but include endpoint, name, username, and status
  const sanitizeServer = (srv) => {
    if (!srv) return undefined;
    const copy = { ...srv };
    if (copy.apiaccesskey) {
      const len = copy.apiaccesskey.length;
      copy.apiaccesskeyMasked = len > 8 ? `${copy.apiaccesskey.substring(0, 4)}...${copy.apiaccesskey.substring(len - 4)}` : '••••••••';
    }
    return copy;
  };

  if (settings.server1) safeSettings.server1 = sanitizeServer(settings.server1);
  if (settings.server2) safeSettings.server2 = sanitizeServer(settings.server2);
  if (settings.server3) safeSettings.server3 = sanitizeServer(settings.server3);
  if (settings.global) safeSettings.global = { ...settings.global };

  res.json(safeSettings);
};

exports.updateSettings = (req, res) => {
  const { server1, server2, server3, exchangeRate, creditCushion } = req.body;
  const settings = readDB('settings.json') || {};
  
  const applyServerConfig = (target, source) => {
    if (!source || typeof source !== 'object') return;
    
    // Tiers and Markups
    target.resellerTier1 = parseFloat(source.resellerTier1) || 0;
    target.resellerTier2 = parseFloat(source.resellerTier2) || 0;
    target.resellerTier3 = parseFloat(source.resellerTier3) || 0;
    target.clientTier1 = parseFloat(source.clientTier1) || 0;
    target.clientTier2 = parseFloat(source.clientTier2) || 0;
    target.clientTier3 = parseFloat(source.clientTier3) || 0;
    target.resellerMarkup = target.resellerTier1;
    target.clientMarkup = target.clientTier1;

    // Server Endpoints & Credentials (Admin management)
    if (source.name !== undefined && typeof source.name === 'string') {
      target.name = source.name.trim();
    }
    if (source.endpoint !== undefined && typeof source.endpoint === 'string' && source.endpoint.trim() !== '') {
      let ep = source.endpoint.trim();
      if (!ep.endsWith('/')) ep += '/';
      target.endpoint = ep;
    }
    if (source.username !== undefined && typeof source.username === 'string' && source.username.trim() !== '') {
      target.username = source.username.trim();
    }
    if (source.apiaccesskey !== undefined && typeof source.apiaccesskey === 'string' && source.apiaccesskey.trim() !== '' && !source.apiaccesskey.includes('...')) {
      target.apiaccesskey = source.apiaccesskey.trim();
    }
    if (source.enabled !== undefined) {
      target.enabled = Boolean(source.enabled);
    }
  };

  if (server1) {
    settings.server1 = settings.server1 || {};
    applyServerConfig(settings.server1, server1);
  }
  if (server2) {
    settings.server2 = settings.server2 || {};
    applyServerConfig(settings.server2, server2);
  }
  if (server3) {
    settings.server3 = settings.server3 || {};
    applyServerConfig(settings.server3, server3);
  }
  if (req.body.global) {
    settings.global = settings.global || {};
    settings.global.marqueeImages = req.body.global.marqueeImages;
  }
  if (exchangeRate !== undefined) {
    settings.exchangeRate = parseFloat(exchangeRate) || 17.60;
  }
  if (creditCushion !== undefined) {
    settings.creditCushion = parseFloat(creditCushion) || 0;
  }

  writeDB('settings.json', settings);
  incrementCatalogVersion();
  res.json({ success: true, message: 'Configuración actualizada correctamente.' });
};

exports.getGroupMarkups = (req, res) => {
  const markups = readDB('group_markups.json') || {};
  res.json(markups);
};

exports.updateGroupMarkups = (req, res) => {
  const serverId = req.headers['x-server-id'] || '1';
  const groupMarkups = req.body;
  const markups = readDB('group_markups.json') || {};
  markups['server' + serverId] = groupMarkups;
  writeDB('group_markups.json', markups);
  incrementCatalogVersion();
  res.json({ success: true, markups: markups['server' + serverId] });
};

exports.setServiceCustomGroup = (req, res) => {
  const serverId = req.headers['x-server-id'] || '1';
  const { serviceid, customGroup } = req.body;
  if (!serviceid) return res.status(400).send('Service ID es requerido');
  
  const customGroupsDb = readDB('custom_groups.json') || {};
  if (!customGroupsDb['server' + serverId]) customGroupsDb['server' + serverId] = {};
  
  if (customGroup && customGroup.trim() !== '') {
      customGroupsDb['server' + serverId][serviceid] = customGroup.trim();
  } else {
      delete customGroupsDb['server' + serverId][serviceid];
  }
  
  writeDB('custom_groups.json', customGroupsDb);
  incrementCatalogVersion();
  res.json({ success: true });
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

const backupEngine = require('../backupEngine');

exports.getBackup = (req, res) => {
  try {
    const fullSnapshot = backupEngine.generateFullBackupSnapshot('ADMIN_DOWNLOAD');
    backupEngine.logAuditTrail('MANUAL_BACKUP_DOWNLOAD', {
      adminId: req.user.id,
      adminUsername: req.user.username,
      snapshotHash: fullSnapshot.metadata.snapshotHash
    }, req.user.username);
    res.json(fullSnapshot);
  } catch (err) {
    console.error('Error generating full backup:', err);
    res.status(500).json({ error: 'Error al generar el respaldo completo: ' + err.message });
  }
};

exports.restoreBackup = (req, res) => {
  const backup = req.body;
  if (!backup || typeof backup !== 'object') {
    return res.status(400).json({ error: 'Archivo de respaldo inválido.' });
  }

  try {
    const result = backupEngine.restoreSnapshot(backup, req.user ? req.user.username : 'ADMIN');
    res.json({ success: true, isV2: result.isV2 });
  } catch (err) {
    console.error('Restore Error:', err);
    backupEngine.logAuditTrail('SYSTEM_RESTORE_FAILED', {
      adminId: req.user ? req.user.id : null,
      error: err.message
    }, req.user ? req.user.username : 'ADMIN');
    res.status(500).json({ error: 'Error al restaurar el archivo: ' + err.message });
  }
};

exports.getAutoBackups = (req, res) => {
  try {
    const backups = backupEngine.listAllBackups();
    res.json(backups);
  } catch(e) {
    res.status(500).json({ error: 'Error al leer backups automáticos: ' + e.message });
  }
};

exports.downloadAutoBackup = (req, res) => {
  const rawFilename = req.params.filename;
  const filename = path.basename(String(rawFilename || ''));
  if (!filename.endsWith('.json') || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Archivo inválido o intento de acceso denegado.' });
  }

  const allBackups = backupEngine.listAllBackups();
  const match = allBackups.find(b => b.filename === filename);
  if (!match || !fs.existsSync(match.path)) {
    return res.status(404).json({ error: 'Respaldo no encontrado.' });
  }

  backupEngine.logAuditTrail('FILE_BACKUP_DOWNLOADED', {
    filename,
    type: match.type,
    adminUsername: req.user ? req.user.username : 'ADMIN'
  }, req.user ? req.user.username : 'ADMIN');

  res.download(match.path);
};

exports.getAuditLogs = (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const logs = backupEngine.getAuditLogs(limit);
    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ error: 'Error al leer registros de auditoría: ' + err.message });
  }
};

const gdriveSync = require('../gdriveSync');

exports.getGDriveConfig = (req, res) => {
  try {
    const config = gdriveSync.getGDriveConfig();
    const template = gdriveSync.getAppsScriptTemplate();
    res.json({
      success: true,
      config: {
        enabled: Boolean(config.enabled),
        folderId: config.folderId || '',
        appScriptUrl: config.appScriptUrl || '',
        clientEmail: config.clientEmail || '',
        hasPrivateKey: Boolean(config.privateKey),
        keepCopies: parseInt(config.keepCopies, 10) || 7,
        syncOnEvent: Boolean(config.syncOnEvent),
        keepLocalCopies: parseInt(config.keepLocalCopies, 10) || 3,
        updatedAt: config.updatedAt || null
      },
      template
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al leer configuración de Google Drive: ' + err.message });
  }
};

exports.updateGDriveConfig = (req, res) => {
  try {
    const { enabled, folderId, appScriptUrl, clientEmail, privateKey, keepCopies, syncOnEvent, keepLocalCopies } = req.body;
    const current = gdriveSync.getGDriveConfig();
    
    const updated = gdriveSync.saveGDriveConfig({
      enabled: Boolean(enabled),
      folderId: folderId !== undefined ? String(folderId).trim() : current.folderId,
      appScriptUrl: appScriptUrl !== undefined ? String(appScriptUrl).trim() : current.appScriptUrl,
      clientEmail: clientEmail !== undefined ? String(clientEmail).trim() : current.clientEmail,
      privateKey: (privateKey && String(privateKey).trim()) ? String(privateKey).trim() : current.privateKey,
      keepCopies: parseInt(keepCopies, 10) || 7,
      syncOnEvent: Boolean(syncOnEvent),
      keepLocalCopies: keepLocalCopies !== undefined ? Math.max(1, parseInt(keepLocalCopies, 10) || 3) : (current.keepLocalCopies || 3)
    });

    res.json({ success: true, message: 'Configuración de Google Drive y respaldos guardada con éxito.', config: updated });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar Google Drive: ' + err.message });
  }
};

exports.testGDriveSync = async (req, res) => {
  try {
    // Tomar el respaldo diario más reciente o generar uno
    const allBackups = backupEngine.listAllBackups();
    let target = allBackups.find(b => b.type === 'daily') || allBackups[0];

    if (!target) {
      const newB = backupEngine.createDailyBackup();
      target = { path: newB.filepath };
    }

    const syncResult = await gdriveSync.syncBackupToGoogleDrive(target.path, true);
    if (!syncResult.success) {
      return res.status(400).json({ success: false, error: syncResult.error || syncResult.reason });
    }

    res.json({
      success: true,
      message: 'Respaldo subido a Google Drive exitosamente y copias anteriores depuradas.',
      syncResult
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al probar sincronización de Google Drive: ' + err.message });
  }
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
  const { code } = req.params;
  const coupons = readDB('coupons.json') || [];
  const index = coupons.findIndex(c => c.code === code);
  if (index !== -1) {
    coupons.splice(index, 1);
    writeDB('coupons.json', coupons);
  }
  res.json({ success: true });
};

// --- WARNING TEMPLATES & SERVICE WARNINGS ---
exports.getWarningTemplates = (req, res) => {
  const templates = readDB('warning_templates.json') || [];
  res.json(templates);
};

exports.saveWarningTemplate = (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Título y contenido son requeridos' });
  
  const templates = readDB('warning_templates.json') || [];
  const newTemplate = { id: Date.now().toString(), title, content };
  templates.push(newTemplate);
  writeDB('warning_templates.json', templates);
  res.json({ success: true, template: newTemplate });
};

exports.deleteWarningTemplate = (req, res) => {
  const { id } = req.params;
  let templates = readDB('warning_templates.json') || [];
  templates = templates.filter(t => t.id !== id);
  writeDB('warning_templates.json', templates);
  res.json({ success: true });
};

exports.getServiceWarnings = (req, res) => {
  const serverId = require('../helpers').getServerId(req);
  const allWarnings = readDB('service_warnings.json') || {};
  const serverWarnings = allWarnings['server' + serverId] || {};
  res.json(serverWarnings);
};

exports.saveServiceWarning = (req, res) => {
  const { serviceId, warningHtml } = req.body;
  const serverId = require('../helpers').getServerId(req);
  if (!serviceId) return res.status(400).json({ error: 'Service ID es requerido' });

  const allWarnings = readDB('service_warnings.json') || {};
  if (!allWarnings['server' + serverId]) {
    allWarnings['server' + serverId] = {};
  }

  if (warningHtml === null || warningHtml === undefined || warningHtml.trim() === '') {
    delete allWarnings['server' + serverId][serviceId];
  } else {
    allWarnings['server' + serverId][serviceId] = warningHtml;
  }

  writeDB('service_warnings.json', allWarnings);
  res.json({ success: true });
};

exports.clearCustomPrices = (req, res) => {
  const serverId = require('../helpers').getServerId(req);
  const serverKey = 'server' + serverId;
  const allCustomPrices = readDB('custom_prices.json') || {};
  if (allCustomPrices[serverKey]) {
      allCustomPrices[serverKey] = {};
      writeDB('custom_prices.json', allCustomPrices);
      createAutoBackup('Clear_Custom_Prices');
      res.json({ success: true, message: 'Todos los precios personalizados por producto han sido eliminados para este servidor.' });
  } else {
      res.json({ success: true, message: 'No había precios personalizados.' });
  }
};

exports.toggleDisableImei = (req, res) => {
  const { serviceId, disabled } = req.body;
  const serverId = require('../helpers').getServerId(req);
  if (!serviceId) return res.status(400).json({ error: 'Falta serviceId' });
  
  const disabledDb = readDB('disabled_imei.json') || {};
  const serverKey = 'server' + serverId;
  disabledDb[serverKey] = disabledDb[serverKey] || [];
  
  if (disabled) {
    if (!disabledDb[serverKey].includes(serviceId)) {
      disabledDb[serverKey].push(serviceId);
    }
  } else {
    disabledDb[serverKey] = disabledDb[serverKey].filter(id => id !== serviceId);
  }
  
  writeDB('disabled_imei.json', disabledDb);
  require('../cacheManager').incrementCatalogVersion();
  res.json({ success: true, disabledImei: disabled });
};

exports.adminRefund = (req, res) => {
  const { orderId, serverId } = req.body;
  if (!orderId) return res.status(400).json({ error: 'Falta orderId' });

  const history = readDB('history.json') || [];
  const sId = serverId ? String(serverId) : null;
  const order = history.find(h => String(h.orderId || h.id) === String(orderId) && (!sId || String(h.serverId || '1') === sId));

  if (!order) {
    return res.status(404).json({ error: 'Pedido no encontrado en el historial.' });
  }

  if (order.isRefunded) {
    return res.status(400).json({ error: 'Este pedido ya fue reembolsado anteriormente.' });
  }

  const { processRefund } = require('../helpers');
  const result = processRefund(order);

  if (result.success) {
    return res.json({
      success: true,
      message: `Pedido #${orderId} reembolsado exitosamente por $${result.amountRefunded.toFixed(2)} MXN.`,
      newBalance: result.newBalance
    });
  } else {
    return res.status(400).json({ error: result.error || 'Error al procesar el reembolso.' });
  }
};

/**
 * Enviar invitación / recordatorio por WhatsApp a usuarios que no tienen bot vinculado
 */
exports.notifyUnlinkedBot = (req, res) => {
  const { userId } = req.body || {};
  const users = readDB('users.json') || [];
  const wUsers = readDB('whatsapp_users.json') || {};

  const botNumberDisplay = '+52 783 147 5482';
  const botLink = 'https://wa.me/527831475482?text=hola';

  let targets = [];

  if (userId) {
    const user = users.find(u => String(u.id) === String(userId));
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const isLinked = Object.keys(wUsers).some(key => String(wUsers[key]) === String(user.id));
    if (isLinked) return res.status(400).json({ error: 'Este usuario ya tiene el bot vinculado.' });
    if (!user.phone) return res.status(400).json({ error: 'El usuario no tiene un teléfono registrado.' });
    targets.push(user);
  } else {
    // Todos los usuarios sin bot vinculado que tengan teléfono registrado
    targets = users.filter(u => {
      if (u.role === 'admin') return false;
      if (!u.phone) return false;
      const isLinked = Object.keys(wUsers).some(key => String(wUsers[key]) === String(u.id));
      return !isLinked;
    });
  }

  if (targets.length === 0) {
    return res.json({ success: true, count: 0, message: 'No hay usuarios pendientes sin bot vinculado con número de teléfono registrado.' });
  }

  let queuedCount = 0;
  for (const user of targets) {
    let cleanPhone = String(user.phone).replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = '52' + cleanPhone;
    if (cleanPhone.length < 10) continue;

    const message = `✨ *¡Hola, ${user.username}! MegaUnlockPhone Bot 2.0* 🤖✨\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Te presentamos el nuevo asistente inteligente de *MegaUnlockPhone*.\n\n` +
      `🔗 *¡Vinculación Automática Lista!*\n` +
      `Ya no necesitas ingresar usuario ni contraseña. Tu WhatsApp queda conectado automáticamente a tu cuenta con tu número de teléfono registrado.\n\n` +
      `⚡ *¿Qué puedes hacer desde este chat?*\n` +
      `• *saldo* ➔ Consulta tu crédito en servidores al instante.\n` +
      `• *pedir* ➔ Envía pedidos y servicios 24/7 de forma rápida.\n` +
      `• *pedidos* ➔ Consulta el estatus de tus órdenes recientes.\n` +
      `• *recargar* ➔ Notifica y valida tus pagos por SPEI.\n` +
      `• *ticket <ID>* ➔ Genera recibos con tu ganancia para tus clientes.\n\n` +
      `🔕 *Control Total de Notificaciones:*\n` +
      `Si en algún momento no deseas recibir avisos de tus pedidos por WhatsApp, sólo escribe *desactivar* (o *silenciar*). Y para reactivarlos cuando quieras, sólo escribe *activar*.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_¡Escribe *saldo* o *hola* para comenzar a interactuar!_ 🚀`;

    enqueueWhatsApp('direct', message, user.id, { phoneId: `${cleanPhone}@s.whatsapp.net` });
    queuedCount++;
  }

  return res.json({
    success: true,
    count: queuedCount,
    message: `Se enviaron ${queuedCount} mensajes de presentación y vinculación automática.`
  });
};

// --- GESTIÓN FINANCIERA Y CONTROL DE GANANCIAS ---
const financeManager = require('../financeManager');

exports.getFinanceSummary = async (req, res) => {
  try {
    const data = await financeManager.getFinanceSummary({
      orderId: req.query.orderId
    });
    res.json({ success: true, ...data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

exports.getOrderFinanceDetails = (req, res) => {
  try {
    const details = financeManager.getOrderFinanceDetails(req.params.orderId);
    if (!details) {
      return res.status(404).json({ success: false, error: 'Orden no encontrada' });
    }
    res.json({ success: true, ...details });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

exports.updateFinanceConfig = (req, res) => {
  try {
    const updated = financeManager.updateFinanceConfig(req.body);
    res.json({ success: true, config: updated });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

exports.addFinanceTransaction = (req, res) => {
  try {
    const entry = financeManager.recordTransaction({
      ...req.body,
      recordedBy: req.user?.username || 'admin'
    });
    res.json({ success: true, transaction: entry });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

exports.deleteFinanceTransaction = (req, res) => {
  try {
    const success = financeManager.deleteTransaction(req.params.id);
    res.json({ success });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

exports.getFinanceAccounts = (req, res) => {
  try {
    const accounts = financeManager.getAllAccounts();
    res.json({ success: true, accounts });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

exports.saveFinanceAccount = (req, res) => {
  try {
    const account = financeManager.saveAccount(req.body);
    res.json({ success: true, account });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

exports.deleteFinanceAccount = (req, res) => {
  try {
    const success = financeManager.deleteAccount(req.params.id);
    res.json({ success });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

exports.performWeeklyAudit = (req, res) => {
  try {
    const audit = financeManager.performWeeklyAudit({
      ...req.body,
      verifiedBy: req.user?.username || 'Admin'
    });
    res.json({ success: true, audit });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

