const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAuth, requireAdmin } = require('../auth');

router.get('/users', requireAuth, requireAdmin, adminController.getUsers);
router.post('/users', requireAuth, requireAdmin, adminController.createUser);
router.put('/users/:id', requireAuth, requireAdmin, adminController.updateUser);
router.delete('/users/:id', requireAuth, requireAdmin, adminController.deleteUser);

router.put('/users/:id/password', requireAuth, adminController.changePassword);

router.get('/admin/stats', requireAuth, requireAdmin, adminController.getStats);
router.get('/admin/settings', requireAuth, requireAdmin, adminController.getSettings);
router.post('/admin/settings', requireAuth, requireAdmin, adminController.updateSettings);

router.get('/admin/group-markups', requireAuth, requireAdmin, adminController.getGroupMarkups);
router.post('/admin/group-markups', requireAuth, requireAdmin, adminController.updateGroupMarkups);

router.post('/admin/bot/start', requireAuth, requireAdmin, adminController.startBot);
router.post('/admin/bot/stop', requireAuth, requireAdmin, adminController.stopBot);
router.get('/admin/bot/logs', requireAuth, requireAdmin, adminController.getBotLogs);

router.delete('/admin/custom-prices', requireAuth, requireAdmin, adminController.clearCustomPrices);

router.get('/admin/backup', requireAuth, requireAdmin, adminController.getBackup);
router.post('/admin/restore', requireAuth, requireAdmin, adminController.restoreBackup);
router.get('/admin/autobackups', requireAuth, requireAdmin, adminController.getAutoBackups);
router.get('/admin/autobackups/:filename', requireAuth, requireAdmin, adminController.downloadAutoBackup);

router.get('/admin/coupons', requireAuth, requireAdmin, adminController.getCoupons);
router.post('/admin/coupons', requireAuth, requireAdmin, adminController.createCoupon);
router.post('/admin/coupons/redeem', requireAuth, requireAdmin, adminController.redeemCoupon);
router.delete('/admin/coupons/:code', requireAuth, requireAdmin, adminController.deleteCoupon);

module.exports = router;
