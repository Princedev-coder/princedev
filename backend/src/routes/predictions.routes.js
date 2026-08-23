'use strict';

const express = require('express');
const predictionsController = require('../controllers/predictionsController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', predictionsController.listPredictions);
router.post('/patients/:patientId/generate', authorize('ADMIN', 'DOCTOR', 'NURSE'), predictionsController.generateForPatient);

module.exports = router;
