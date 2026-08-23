'use strict';

const express = require('express');
const patientsController = require('../controllers/patientsController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createPatientSchema, assignStaffSchema } = require('../schemas');

const router = express.Router();

router.use(authenticate);

router.get('/', patientsController.listPatients);
router.get('/:id', patientsController.getPatient);
router.post('/', authorize('ADMIN', 'NURSE'), validate(createPatientSchema), patientsController.createPatient);
router.put('/:id', authorize('ADMIN', 'NURSE', 'DOCTOR'), patientsController.updatePatient);
router.post('/:patientId/assignments', authorize('ADMIN', 'DOCTOR'), validate(assignStaffSchema), patientsController.assignStaff);

module.exports = router;
