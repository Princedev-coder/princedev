'use strict';

const express = require('express');
const notificationsController = require('../controllers/notificationsController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', notificationsController.listNotifications);
router.post('/:id/read', notificationsController.markRead);
router.post('/read-all', notificationsController.markAllRead);

module.exports = router;
