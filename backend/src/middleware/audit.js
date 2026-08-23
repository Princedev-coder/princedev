'use strict';

const pool = require('../config/db');

async function writeAuditLog({ userId, action, entityType, entityId, description, ipAddress, userAgent }) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId || null, action, entityType || null, entityId || null, description || null, ipAddress || null, userAgent || null]
    );
  } catch (err) {
    console.error('[audit] failed to write log:', err.message);
  }
}

function audit({ action, entityType, entityId, description }) {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      writeAuditLog({
        userId: req.userId || null,
        action: typeof action === 'function' ? action(req) : action,
        entityType: typeof entityType === 'function' ? entityType(req) : entityType,
        entityId: typeof entityId === 'function' ? entityId(req) : entityId,
        description: typeof description === 'function' ? description(req) : description,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    });
    next();
  };
}

module.exports = { audit, writeAuditLog };
