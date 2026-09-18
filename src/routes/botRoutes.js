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
router.post('/saldo', botController.getSaldo);
router.post('/add_money', botController.addMoney);
router.post('/service_info_direct', botController.getServiceInfoDirect); // Direct service info endpoint

module.exports = router;
