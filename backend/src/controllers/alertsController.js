'use strict';

const pool = require('../config/db');
const { AppError } = require('../utils/asyncHandler');
const alertService = require('../services/alertService');

async function listAlerts(req, res, next) {
  try {
    const { status, severity, patient_id, page = 1, limit = 20, assigned_to_me } = req.query;
    const conditions = [];
    const params = [];

    if (req.user.role === 'DOCTOR' || req.user.role === 'NURSE') {
      const table = req.user.role === 'DOCTOR' ? 'doctors' : 'nurses';
      const staffCol = req.user.role === 'DOCTOR' ? 'doctor_id' : 'nurse_id';
      const [profiles] = await pool.query(`SELECT id FROM ${table} WHERE user_id = ?`, [req.userId]);
      if (profiles.length === 0) return res.json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20 } });
      conditions.push(
        `EXISTS (SELECT 1 FROM patient_assignments pa WHERE pa.patient_id = a.patient_id AND pa.${staffCol} = ? AND pa.status = 'ACTIVE')`
      );
      params.push(profiles[0].id);
    } else if (req.user.role === 'PATIENT') {
      conditions.push('a.patient_id IN (SELECT id FROM patients WHERE user_id = ?)');
      params.push(req.userId);
    }

    if (status) {
      conditions.push('a.status = ?');
      params.push(status);
    }
    if (severity) {
      conditions.push('a.severity = ?');
      params.push(severity);
    }
    if (patient_id) {
      conditions.push('a.patient_id = ?');
      params.push(patient_id);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM alerts a ${where}`, params);
    const [rows] = await pool.query(
      `SELECT a.*, CONCAT(p.first_name, ' ', p.last_name) AS patient_name, p.patient_number,
              au.full_name AS acknowledged_by_name, ru.full_name AS resolved_by_name
         FROM alerts a
         LEFT JOIN patients p ON p.id = a.patient_id
         LEFT JOIN users au ON au.id = a.acknowledged_by
         LEFT JOIN users ru ON ru.id = a.resolved_by
         ${where} ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), offset]
    );
    return res.json({ success: true, data: rows, meta: { total, page: parseInt(page, 10), limit: parseInt(limit, 10) } });
  } catch (err) {
    return next(err);
  }
}

async function getAlert(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM alerts WHERE id = ?', [id]);
    if (rows.length === 0) return next(new AppError(404, 'Alert not found'));
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return next(err);
  }
}

async function acknowledgeAlert(req, res, next) {
  try {
    const data = await alertService.acknowledgeAlert(req.params.id, req.userId);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function resolveAlert(req, res, next) {
  try {
    const data = await alertService.resolveAlert(req.params.id, req.userId);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function escalateAlert(req, res, next) {
  try {
    const [result] = await pool.query(
      `UPDATE alerts SET status = 'ESCALATED' WHERE id = ? AND status NOT IN ('RESOLVED','ESCALATED')`,
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      const [rows] = await pool.query('SELECT id, status FROM alerts WHERE id = ?', [req.params.id]);
      if (rows.length === 0) return next(new AppError(404, 'Alert not found'));
      return next(new AppError(409, `Cannot escalate from status ${rows[0].status}`));
    }
    return res.json({ success: true, data: { id: req.params.id, status: 'ESCALATED' } });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listAlerts, getAlert, acknowledgeAlert, resolveAlert, escalateAlert };
