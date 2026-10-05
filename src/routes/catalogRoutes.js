const express = require('express');
const router = express.Router();
const catalogController = require('../controllers/catalogController');
const { requireAuth, optionalAuth } = require('../auth');

router.get('/products', optionalAuth, catalogController.getProducts);

module.exports = router;
