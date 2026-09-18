const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const { requireAuth } = require('../auth');

router.get('/account', requireAuth, accountController.getAccount);

module.exports = router;
