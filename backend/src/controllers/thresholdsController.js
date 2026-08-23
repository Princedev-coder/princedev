'use strict';

const pool = require('../config/db');
const { AppError } = require('../utils/asyncHandler');

async function listThresholds(req, res, next) {
  try {
    const { hospital_id } = req.query;
    const params = [];
    let where = '';
    if (hospital_id) {
      where = 'WHERE hospital_id = ?';
      params.push(hospital_id);
    }
    const [rows] = await pool.query(`SELECT * FROM alert_thresholds ${where} ORDER BY vital_type`, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
}

async function createThreshold(req, res, next) {
  try {
    const { hospital_id, vital_type, min_value, max_value, severity, enabled } = req.body;
    const [existing] = await pool.query(
      'SELECT id FROM alert_thresholds WHERE hospital_id = ? AND vital_type = ?',
      [hospital_id, vital_type]
    );
    if (existing.length) {
      const [result] = await pool.query(
        `UPDATE alert_thresholds SET min_value = ?, max_value = ?, severity = ?, enabled = ? WHERE id = ?`,
        [min_value ?? null, max_value ?? null, severity, enabled ?? 1, existing[0].id]
      );
      const [rows] = await pool.query('SELECT * FROM alert_thresholds WHERE id = ?', [existing[0].id]);
      return res.json({ success: true, data: rows[0], updated: true });
    }
    const [result] = await pool.query(
      `INSERT INTO alert_thresholds (hospital_id, vital_type, min_value, max_value, severity, enabled)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [hospital_id, vital_type, min_value ?? null, max_value ?? null, severity, enabled ?? 1]
    );
    const [rows] = await pool.query('SELECT * FROM alert_thresholds WHERE id = ?', [result.insertId]);
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    return next(err);
  }
}

async function updateThreshold(req, res, next) {
  try {
    const { id } = req.params;
    const allowed = ['min_value', 'max_value', 'severity', 'enabled'];
    const updates = [];
    const params = [];
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    }
    if (updates.length === 0) return next(new AppError(400, 'Nothing to update'));
    params.push(id);
    await pool.query(`UPDATE alert_thresholds SET ${updates.join(', ')} WHERE id = ?`, params);
    const [rows] = await pool.query('SELECT * FROM alert_thresholds WHERE id = ?', [id]);
    if (rows.length === 0) return next(new AppError(404, 'Threshold not found'));
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return next(err);
  }
}

async function deleteThreshold(req, res, next) {
  try {
    const [result] = await pool.query('DELETE FROM alert_thresholds WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return next(new AppError(404, 'Threshold not found'));
    return res.json({ success: true, message: 'Threshold deleted' });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listThresholds, createThreshold, updateThreshold, deleteThreshold };
