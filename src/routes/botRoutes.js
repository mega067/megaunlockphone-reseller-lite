const express = require('express');
const router = express.Router();
const botController = require('../controllers/botController');
const orderController = require('../controllers/orderController');
const { readDB } = require('../db');

const BOT_SECRET = process.env.BOT_SECRET || 'MEGA_BOT_SECRET_2026';

function requireBotSecret(req, res, next) {
  if (req.body.botSecret !== BOT_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const users = readDB('users.json') || [];
  const userIndex = users.findIndex(u => String(u.id) === String(req.body.userId));
  if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
  req.user = users[userIndex];
  req.headers['x-server-id'] = req.body.serverId || '1';
  next();
}

function requireBotSecretOnly(req, res, next) {
  if (req.body.botSecret !== BOT_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  req.headers['x-server-id'] = req.body.serverId || '1';
  next();
}

router.post('/search', requireBotSecretOnly, botController.searchProducts);
router.post('/catalog', requireBotSecretOnly, botController.getCatalog);
router.post('/groups', requireBotSecretOnly, botController.getGroups);
router.post('/products', requireBotSecretOnly, botController.getProductsByGroup);
router.post('/setprice', requireBotSecretOnly, botController.setPrice);
router.post('/service_info', requireBotSecret, botController.getServiceInfo);
router.post('/order', requireBotSecret, orderController.processOrder);
router.post('/saldo', requireBotSecretOnly, botController.getSaldo);
router.post('/add_money', requireBotSecretOnly, botController.addMoney);
router.post('/service_info_direct', requireBotSecretOnly, botController.getServiceInfoDirect); // Direct service info endpoint

// WhatsApp Engine APIs
router.get('/time', (req, res) => {
  const { getEngineTimestamp, ENGINE_CONFIG } = require('../whatsappEngine');
  res.json({
    success: true,
    serverIso: new Date().toISOString(),
    formattedTime: getEngineTimestamp(),
    timeZone: ENGINE_CONFIG.timeZone
  });
});

router.post('/queue-status', requireBotSecretOnly, (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const queueFile = path.join(__dirname, '..', '..', 'queue.json');
  let pending = 0;
  try {
    if (fs.existsSync(queueFile)) {
      const q = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
      pending = Array.isArray(q) ? q.length : 0;
    }
  } catch (e) {}
  res.json({ success: true, pendingMessages: pending });
});

// Diagnóstico directo a proveedores desde el proceso Web (IP http22: 185.31.41.11)
router.post('/test-dhru', requireBotSecretOnly, async (req, res) => {
  const { getServerSettings, callGsmThemeApi, buildTargetUrl } = require('../helpers');
  const serverId = req.body.serverId || req.headers['x-server-id'] || '3';
  const action = req.body.action || 'accountinfo';
  const settingsDb = readDB('settings.json');
  const settings = getServerSettings(settingsDb, serverId);

  if (!settings) return res.status(400).json({ error: 'Configuración no encontrada para servidor ' + serverId });

  const targetUrl = buildTargetUrl(settings.endpoint);
  try {
    const apiRes = await callGsmThemeApi(targetUrl, action, req.body.params || {}, settings.username, settings.apiaccesskey);
    return res.json({
      success: true,
      serverId,
      action,
      targetUrl,
      username: settings.username,
      data: apiRes.data
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
      data: err.response?.data || null
    });
  }
});

module.exports = router;

