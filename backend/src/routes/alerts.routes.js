'use strict';

const express = require('express');
const alertsController = require('../controllers/alertsController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', alertsController.listAlerts);
router.get('/:id', alertsController.getAlert);
router.post('/:id/acknowledge', alertsController.acknowledgeAlert);
router.post('/:id/resolve', alertsController.resolveAlert);
router.post('/:id/escalate', alertsController.escalateAlert);

module.exports = router;
