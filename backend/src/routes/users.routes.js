'use strict';

const express = require('express');
const usersController = require('../controllers/usersController');
const { authenticate, authorize } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { validate } = require('../middleware/validate');
const { createUserSchema, updateUserSchema } = require('../schemas');

const router = express.Router();

router.use(authenticate);

router.get('/me', usersController.getProfile);
router.put('/me', usersController.updateProfile);

router.get('/', authorize('ADMIN'), usersController.listUsers);
router.post('/', authorize('ADMIN'), validate(createUserSchema), audit({ action: 'USER_CREATED', entityType: 'users' }), usersController.createUser);
router.put('/:id', authorize('ADMIN'), validate(updateUserSchema), audit({ action: 'USER_UPDATED', entityType: 'users', entityId: (req) => req.params.id }), usersController.updateUser);

module.exports = router;
