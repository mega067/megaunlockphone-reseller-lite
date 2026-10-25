const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { requireAuth, requireAdmin, requireAdminOrColaborador } = require('../auth');

router.post('/admin/toggle-service', requireAuth, requireAdminOrColaborador, serviceController.toggleService);
router.post('/admin/toggle-allow-free', requireAuth, requireAdminOrColaborador, serviceController.toggleAllowFree);
router.get('/admin/custom-prices', requireAuth, requireAdminOrColaborador, serviceController.getCustomPrices);
router.get('/admin/market-suggestions', requireAuth, requireAdminOrColaborador, serviceController.getMarketSuggestions);
router.post('/admin/product-price', requireAuth, requireAdminOrColaborador, serviceController.setProductPrice);
router.delete('/admin/product-price/:serviceid', requireAuth, requireAdminOrColaborador, serviceController.deleteProductPrice);
router.get('/admin/user-product-prices/:serviceid', requireAuth, requireAdminOrColaborador, serviceController.getUserProductPrices);
router.post('/admin/user-product-prices/:serviceid', requireAuth, requireAdmin, serviceController.setUserProductPrices);

module.exports = router;

