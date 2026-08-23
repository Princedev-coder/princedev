'use strict';

const express = require('express');
const miscController = require('../controllers/miscController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', miscController.getDashboard);

module.exports = router;
