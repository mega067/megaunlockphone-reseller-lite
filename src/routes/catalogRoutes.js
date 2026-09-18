const express = require('express');
const router = express.Router();
const catalogController = require('../controllers/catalogController');
const { requireAuth } = require('../auth');

router.get('/products', requireAuth, catalogController.getProducts);

module.exports = router;
