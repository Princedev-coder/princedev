'use strict';

const { AppError } = require('../utils/asyncHandler');

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      return next(new AppError(400, 'Validation failed', details));
    }
    req.body = result.data;
    return next();
  };
}

module.exports = { validate };
