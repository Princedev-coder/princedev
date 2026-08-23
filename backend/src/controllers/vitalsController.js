'use strict';

const pool = require('../config/db');
const { AppError } = require('../utils/asyncHandler');
const alertService = require('../services/alertService');
const aiService = require('../services/aiService');
const realtime = require('../services/realtimeService');
const notificationService = require('../services/notificationService');
const { canAccessPatient } = require('./patientsController');
const { writeAuditLog } = require('../middleware/audit');

const ALLOWED = ['heart_rate', 'spo2', 'temperature', 'systolic_pressure', 'diastolic_pressure', 'respiratory_rate', 'blood_glucose', 'weight'];

async function createManualVital(req, res, next) {
  try {
    const { patient_id, values } = req.body;
    const [patient] = await pool.query('SELECT * FROM patients WHERE id = ?', [patient_id]);
    if (patient.length === 0) return next(new AppError(404, 'Patient not found'));
    const canAccess = await canAccessPatient(req.user, patient[0]);
    if (!canAccess && req.user.role !== 'ADMIN') return next(new AppError(403, 'Access denied'));

    const insertData = { patient_id };
    for (const field of ALLOWED) {
      if (values[field] !== undefined) {
        const num = Number(values[field]);
        if (Number.isFinite(num)) insertData[field] = num;
      }
    }

    const [result] = await pool.query(
      `INSERT INTO vital_readings
        (patient_id, device_id, heart_rate, spo2, temperature, systolic_pressure, diastolic_pressure, respiratory_rate, blood_glucose, weight, source)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL')`,
      [
        patient_id,
        insertData.heart_rate ?? null,
        insertData.spo2 ?? null,
        insertData.temperature ?? null,
        insertData.systolic_pressure ?? null,
        insertData.diastolic_pressure ?? null,
        insertData.respiratory_rate ?? null,
        insertData.blood_glucose ?? null,
        insertData.weight ?? null,
      ]
    );

    const reading = { id: result.insertId, ...insertData, hospital_id: patient[0].hospital_id };
    const alertResult = await alertService.processReading(reading);
    let prediction = null;
    try {
      prediction = await aiService.generatePrediction(patient_id, reading);
    } catch (err) {
      console.error('[ai] prediction failed:', err.message);
    }
    realtime.emitPatientVital(patient_id, { ...reading, recorded_at: new Date() });

    for (const alert of alertResult.alerts) {
      realtime.emitAlert({ id: alert.id, patient_id, alert_type: alert.vitalType, severity: alert.severity, title: `Abnormal ${alert.vitalType.replace(/_/g, ' ').toLowerCase()}`, message: alert.message });
      await notificationService.notifyUsersForPatient(patient_id, { alertId: alert.id, title: 'Abnormal vital', message: alert.message, type: 'ALERT' });
    }

    await writeAuditLog({
      userId: req.userId,
      action: 'VITAL_READING_ADDED',
      entityType: 'vital_readings',
      entityId: result.insertId,
      description: `Manually recorded vitals for patient #${patient_id}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        patient_id,
        alerts: alertResult.alerts.map((a) => ({ id: a.id, type: a.vitalType, severity: a.severity, message: a.message })),
        prediction: prediction ? { id: prediction.id, risk_score: prediction.risk_score, risk_level: prediction.risk_level } : null,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function listVitals(req, res, next) {
  try {
    const { patientId } = req.params;
    const { from, to, limit = 100, source } = req.query;
    const conditions = ['patient_id = ?'];
    const params = [patientId];
    if (from) {
      conditions.push('recorded_at >= ?');
      params.push(new Date(from));
    }
    if (to) {
      conditions.push('recorded_at <= ?');
      params.push(new Date(to));
    }
    if (source) {
      conditions.push('source = ?');
      params.push(source);
    }
    const [rows] = await pool.query(
      `SELECT * FROM vital_readings WHERE ${conditions.join(' AND ')} ORDER BY recorded_at DESC, id DESC LIMIT ?`,
      [...params, parseInt(limit, 10)]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
}

async function getVitalStats(req, res, next) {
  try {
    const { patientId } = req.params;
    const [rows] = await pool.query(
      `SELECT
         ROUND(AVG(heart_rate),2) AS avg_heart_rate,
         ROUND(AVG(spo2),2) AS avg_spo2,
         ROUND(AVG(temperature),2) AS avg_temperature,
         ROUND(AVG(systolic_pressure),2) AS avg_systolic,
         ROUND(AVG(diastolic_pressure),2) AS avg_diastolic,
         ROUND(AVG(respiratory_rate),2) AS avg_respiratory_rate,
         ROUND(AVG(blood_glucose),2) AS avg_blood_glucose,
         MIN(heart_rate) AS min_heart_rate, MAX(heart_rate) AS max_heart_rate,
         MIN(spo2) AS min_spo2, MAX(spo2) AS max_spo2,
         COUNT(*) AS total_readings,
         MAX(recorded_at) AS last_recorded_at
       FROM vital_readings WHERE patient_id = ?`,
      [patientId]
    );
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return next(err);
  }
}

module.exports = { createManualVital, listVitals, getVitalStats };
