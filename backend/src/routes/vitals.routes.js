'use strict';

const express = require('express');
const vitalsController = require('../controllers/vitalsController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { manualVitalSchema } = require('../schemas');

const router = express.Router();

router.use(authenticate);

router.post('/', authorize('ADMIN', 'DOCTOR', 'NURSE'), validate(manualVitalSchema), vitalsController.createManualVital);
router.get('/patients/:patientId', vitalsController.listVitals);
router.get('/patients/:patientId/stats', vitalsController.getVitalStats);

module.exports = router;
