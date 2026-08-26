'use strict';

const express = require('express');
const recordsController = require('../controllers/recordsController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  recordSchema,
  prescriptionSchema,
  historySchema,
  labSchema,
  appointmentSchema,
  nurseNoteSchema,
  prescriptionItemSchema,
} = require('../schemas');

const router = express.Router();

router.use(authenticate);

const SCHEMAS = {
  records: recordSchema,
  prescriptions: prescriptionSchema,
  history: historySchema,
  labs: labSchema,
  appointments: appointmentSchema,
  notes: nurseNoteSchema,
};

router.get('/prescriptions/:id', recordsController.getPrescription);
router.post('/prescriptions/:prescriptionId/items', validate(prescriptionItemSchema), recordsController.addPrescriptionItems);

router.get('/:kind', (req, res, next) => {
  if (!SCHEMAS[req.params.kind]) return next({ statusCode: 400, message: 'Unknown record type' });
  return recordsController.listRecords(req, res, next);
});

router.post('/:kind', (req, res, next) => {
  const schema = SCHEMAS[req.params.kind];
  if (!schema) return next({ statusCode: 400, message: 'Unknown record type' });
  return validate(schema)(req, res, (err) => (err ? next(err) : recordsController.createRecord(req, res, next)));
});

router.put('/:kind/:id', (req, res, next) => recordsController.updateRecord(req, res, next));

module.exports = router;
