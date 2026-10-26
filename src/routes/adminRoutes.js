const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAuth, requireAdmin } = require('../auth');

router.get('/users', requireAuth, requireAdmin, adminController.getUsers);
router.post('/users', requireAuth, requireAdmin, adminController.createUser);
router.put('/users/:id', requireAuth, requireAdmin, adminController.updateUser);
router.delete('/users/:id', requireAuth, requireAdmin, adminController.deleteUser);
router.post('/users/:id/impersonate', requireAuth, requireAdmin, adminController.impersonateUser);

router.put('/users/:id/password', requireAuth, adminController.changePassword);

router.get('/admin/stats', requireAuth, requireAdmin, adminController.getStats);
router.get('/admin/settings', requireAuth, requireAdmin, adminController.getSettings);
router.post('/admin/settings', requireAuth, requireAdmin, adminController.updateSettings);

router.get('/admin/group-markups', requireAuth, requireAdmin, adminController.getGroupMarkups);
router.post('/admin/group-markups', requireAuth, requireAdmin, adminController.updateGroupMarkups);

router.post('/admin/custom-group', requireAuth, requireAdmin, adminController.setServiceCustomGroup);

router.post('/admin/bot/start', requireAuth, requireAdmin, adminController.startBot);
router.post('/admin/bot/stop', requireAuth, requireAdmin, adminController.stopBot);
router.get('/admin/bot/logs', requireAuth, requireAdmin, adminController.getBotLogs);

router.delete('/admin/custom-prices', requireAuth, requireAdmin, adminController.clearCustomPrices);

router.get('/admin/backup', requireAuth, requireAdmin, adminController.getBackup);
router.post('/admin/restore', requireAuth, requireAdmin, adminController.restoreBackup);
router.get('/admin/autobackups', requireAuth, requireAdmin, adminController.getAutoBackups);
router.get('/admin/autobackups/:filename', requireAuth, requireAdmin, adminController.downloadAutoBackup);
router.get('/admin/audit-logs', requireAuth, requireAdmin, adminController.getAuditLogs);
router.get('/admin/gdrive-config', requireAuth, requireAdmin, adminController.getGDriveConfig);
router.post('/admin/gdrive-config', requireAuth, requireAdmin, adminController.updateGDriveConfig);
router.post('/admin/gdrive-sync-test', requireAuth, requireAdmin, adminController.testGDriveSync);

router.get('/admin/coupons', requireAuth, requireAdmin, adminController.getCoupons);
router.post('/admin/coupons', requireAuth, requireAdmin, adminController.createCoupon);
router.post('/admin/coupons/redeem', requireAuth, requireAdmin, adminController.redeemCoupon);
router.delete('/admin/coupons/:code', requireAuth, requireAdmin, adminController.deleteCoupon);

router.get('/admin/warning-templates', requireAuth, requireAdmin, adminController.getWarningTemplates);
router.post('/admin/warning-templates', requireAuth, requireAdmin, adminController.saveWarningTemplate);
router.delete('/admin/warning-templates/:id', requireAuth, requireAdmin, adminController.deleteWarningTemplate);

router.get('/admin/service-warnings', requireAuth, requireAdmin, adminController.getServiceWarnings);
router.post('/admin/service-warnings', requireAuth, requireAdmin, adminController.saveServiceWarning);

router.post('/admin/disable-imei', requireAuth, requireAdmin, adminController.toggleDisableImei);
router.post('/admin/refund', requireAuth, requireAdmin, adminController.adminRefund);
router.post('/admin/notify-unlinked-bot', requireAuth, requireAdmin, adminController.notifyUnlinkedBot);

// Finanzas y Control de Ganancias
router.get('/admin/finance', requireAuth, requireAdmin, adminController.getFinanceSummary);
router.get('/admin/finance/dashboard', requireAuth, requireAdmin, adminController.getFinanceSummary);
router.get('/admin/finance/order/:orderId', requireAuth, requireAdmin, adminController.getOrderFinanceDetails);
router.post('/admin/finance/config', requireAuth, requireAdmin, adminController.updateFinanceConfig);
router.post('/admin/finance/transaction', requireAuth, requireAdmin, adminController.addFinanceTransaction);
router.post('/admin/finance/record', requireAuth, requireAdmin, adminController.addFinanceTransaction);
router.delete('/admin/finance/transaction/:id', requireAuth, requireAdmin, adminController.deleteFinanceTransaction);
router.delete('/admin/finance/transactions/:id', requireAuth, requireAdmin, adminController.deleteFinanceTransaction);

// Cuentas Bancarias / Tarjetas / Inversión / Emergencia
router.get('/admin/finance/accounts', requireAuth, requireAdmin, adminController.getFinanceAccounts);
router.post('/admin/finance/accounts', requireAuth, requireAdmin, adminController.saveFinanceAccount);
router.delete('/admin/finance/accounts/:id', requireAuth, requireAdmin, adminController.deleteFinanceAccount);

// Recuento y Verificación Semanal (Fin de semana)
router.post('/admin/finance/weekly-audit', requireAuth, requireAdmin, adminController.performWeeklyAudit);

// Control de Deudores (Me deben) y Acreedores (Yo debo)
router.get('/admin/finance/debts', requireAuth, requireAdmin, adminController.getDebts);
router.post('/admin/finance/debts', requireAuth, requireAdmin, adminController.saveDebt);
router.post('/admin/finance/debts/:id/pay', requireAuth, requireAdmin, adminController.recordDebtPayment);
router.delete('/admin/finance/debts/:id', requireAuth, requireAdmin, adminController.deleteDebt);

// Planes de Meses y Cuotas (Nu, Bancos, etc.)
router.get('/admin/finance/installments', requireAuth, requireAdmin, adminController.getInstallments);
router.post('/admin/finance/installments', requireAuth, requireAdmin, adminController.saveInstallment);
router.post('/admin/finance/installments/:id/pay', requireAuth, requireAdmin, adminController.payInstallmentQuota);
router.delete('/admin/finance/installments/:id', requireAuth, requireAdmin, adminController.deleteInstallment);

// Ingreso Semanal para Pasaje y Comida de Universidad
router.post('/admin/finance/college-allowance', requireAuth, requireAdmin, adminController.recordCollegeAllowance);

// Control y Previsión de Recargas Telefónicas / Planes Móviles
router.get('/admin/finance/mobile-plans', requireAuth, requireAdmin, adminController.getMobilePlans);
router.post('/admin/finance/mobile-plans', requireAuth, requireAdmin, adminController.saveMobilePlan);
router.post('/admin/finance/mobile-plans/:id/recharge', requireAuth, requireAdmin, adminController.executeMobileRecharge);
router.delete('/admin/finance/mobile-plans/:id', requireAuth, requireAdmin, adminController.deleteMobilePlan);

// Historial y Rendimiento de Inversiones (Plusvalía / Minusvalía / Gráfica)
router.get('/admin/finance/investments', requireAuth, requireAdmin, adminController.getInvestmentLogs);
router.post('/admin/finance/investments', requireAuth, requireAdmin, adminController.saveInvestmentLog);
router.delete('/admin/finance/investments/:id', requireAuth, requireAdmin, adminController.deleteInvestmentLog);

module.exports = router;

