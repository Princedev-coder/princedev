'use strict';

const express = require('express');
const devicesController = require('../controllers/devicesController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createDeviceSchema, sensorIngestSchema } = require('../schemas');

const router = express.Router();

router.post('/ingest', validate(sensorIngestSchema), devicesController.ingestReading);

router.use(authenticate);

router.get('/', authorize('ADMIN', 'DOCTOR', 'NURSE'), devicesController.listDevices);
router.post('/', authorize('ADMIN'), validate(createDeviceSchema), devicesController.createDevice);
router.put('/:id', authorize('ADMIN'), devicesController.updateDevice);
router.post('/:deviceId/assign/:patientId', authorize('ADMIN', 'DOCTOR', 'NURSE'), devicesController.assignDevice);
router.post('/assignments/:assignmentId/unassign', authorize('ADMIN', 'DOCTOR', 'NURSE'), devicesController.unassignDevice);

module.exports = router;
