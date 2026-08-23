'use strict';

const logger = require('../utils/logger');

function notFound(req, res, next) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.statusCode ? err.message : 'Internal server error';

  if (!err.statusCode) {
    logger.error('Unhandled error', { message: err.message, stack: err.stack });
  } else {
    logger.warn(`Request error ${statusCode}: ${err.message}`);
  }

  const body = { success: false, message, statusCode };
  if (err.details) body.details = err.details;

  return res.status(statusCode).json(body);
}

module.exports = { notFound, errorHandler };
