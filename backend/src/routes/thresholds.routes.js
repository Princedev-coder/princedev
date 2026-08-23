'use strict';

const express = require('express');
const thresholdsController = require('../controllers/thresholdsController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { thresholdSchema } = require('../schemas');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize('ADMIN', 'DOCTOR', 'NURSE'), thresholdsController.listThresholds);
router.post('/', authorize('ADMIN'), validate(thresholdSchema), thresholdsController.createThreshold);
router.put('/:id', authorize('ADMIN'), thresholdsController.updateThreshold);
router.delete('/:id', authorize('ADMIN'), thresholdsController.deleteThreshold);

module.exports = router;
