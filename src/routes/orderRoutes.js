const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { requireAuth } = require('../auth');

router.post('/order', requireAuth, orderController.processOrder);
router.post('/order/status', requireAuth, orderController.getOrderStatus);
router.post('/orders/bulk-status', requireAuth, orderController.getBulkOrderStatus);
router.post('/orders/sync-pending', requireAuth, orderController.syncPendingOrders);

module.exports = router;
