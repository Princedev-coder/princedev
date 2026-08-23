'use strict';

const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createHospitalSchema, createDepartmentSchema } = require('../schemas');

const router = express.Router();

router.use(authenticate);

router.get('/hospitals', adminController.listHospitals);
router.post('/hospitals', authorize('ADMIN'), validate(createHospitalSchema), adminController.createHospital);
router.put('/hospitals/:id', authorize('ADMIN'), adminController.updateHospital);

router.get('/departments', adminController.listDepartments);
router.get('/hospitals/:hospitalId/departments', adminController.listDepartments);
router.post('/departments', authorize('ADMIN'), validate(createDepartmentSchema), adminController.createDepartment);
router.put('/departments/:id', authorize('ADMIN'), adminController.updateDepartment);

module.exports = router;
