'use strict';

const express = require('express');
const staffController = require('../controllers/staffController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createStaffSchema } = require('../schemas');

const router = express.Router();

router.use(authenticate);

router.get('/doctors', staffController.listDoctors);
router.get('/nurses', staffController.listNurses);
router.post('/:role', authorize('ADMIN'), validate(createStaffSchema), staffController.createStaff);

module.exports = router;
