'use strict';

const express = require('express');
const miscController = require('../controllers/miscController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ecgSchema } = require('../schemas');

const router = express.Router();

router.use(authenticate);

router.post('/ecg', authorize('ADMIN', 'DOCTOR', 'NURSE'), validate(ecgSchema), miscController.createEcg);
router.get('/ecg/patients/:patientId', miscController.listEcg);

router.get('/audit-logs', authorize('ADMIN'), miscController.listAuditLogs);
router.get('/security-events', authorize('ADMIN'), miscController.listSecurityEvents);

module.exports = router;
