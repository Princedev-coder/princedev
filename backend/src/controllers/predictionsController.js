'use strict';

const pool = require('../config/db');
const { AppError } = require('../utils/asyncHandler');
const aiService = require('../services/aiService');

async function listPredictions(req, res, next) {
  try {
    const { patient_id, risk_level, page = 1, limit = 20 } = req.query;
    const conditions = [];
    const params = [];

    if (req.user.role === 'PATIENT') {
      conditions.push('patient_id IN (SELECT id FROM patients WHERE user_id = ?)');
      params.push(req.userId);
    }
    if (patient_id) {
      conditions.push('patient_id = ?');
      params.push(patient_id);
    }
    if (risk_level) {
      conditions.push('risk_level = ?');
      params.push(risk_level);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM ai_predictions ${where}`, params);
    const [rows] = await pool.query(
      `SELECT p.*, CONCAT(pt.first_name, ' ', pt.last_name) AS patient_name, pt.patient_number
         FROM ai_predictions p
         LEFT JOIN patients pt ON pt.id = p.patient_id
         ${where} ORDER BY p.generated_at DESC, p.id DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), offset]
    );
    return res.json({ success: true, data: rows, meta: { total, page: parseInt(page, 10), limit: parseInt(limit, 10) } });
  } catch (err) {
    return next(err);
  }
}

async function generateForPatient(req, res, next) {
  try {
    const { patientId } = req.params;
    const [patients] = await pool.query('SELECT * FROM patients WHERE id = ?', [patientId]);
    if (patients.length === 0) return next(new AppError(404, 'Patient not found'));
    const [readings] = await pool.query(
      'SELECT * FROM vital_readings WHERE patient_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1',
      [patientId]
    );
    if (readings.length === 0) return next(new AppError(409, 'No vital readings available for this patient yet'));
    const latest = readings[0];
    const prediction = await aiService.generatePrediction(patientId, latest);
    return res.status(201).json({ success: true, data: prediction });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listPredictions, generateForPatient };
