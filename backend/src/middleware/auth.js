'use strict';

const pool = require('../config/db');
const { verifyToken } = require('../utils/jwt');
const { AppError } = require('../utils/asyncHandler');

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return next(new AppError(401, 'Authentication required'));
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch (err) {
      return next(new AppError(401, 'Invalid or expired token'));
    }

    const [rows] = await pool.query(
      `SELECT id, full_name, email, role, hospital_id, department_id, status
         FROM users WHERE id = ?`,
      [payload.sub]
    );

    if (rows.length === 0) {
      return next(new AppError(401, 'User account no longer exists'));
    }
    const user = rows[0];
    if (user.status !== 'ACTIVE') {
      return next(new AppError(403, 'Account is not active'));
    }

    req.user = user;
    req.userId = user.id;
    return next();
  } catch (err) {
    return next(err);
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError(401, 'Authentication required'));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, `Access denied. Requires role: ${roles.join(' or ')}`));
    }
    return next();
  };
}

module.exports = { authenticate, authorize };
