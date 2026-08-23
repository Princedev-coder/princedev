'use strict';

const pool = require('../config/db');
const realtime = require('./realtimeService');
const { writeAuditLog } = require('../middleware/audit');

const VITAL_FIELD_MAP = {
  HEART_RATE: 'heart_rate',
  SPO2: 'spo2',
  TEMPERATURE: 'temperature',
  SYSTOLIC: 'systolic_pressure',
  DIASTOLIC: 'diastolic_pressure',
  RESPIRATORY_RATE: 'respiratory_rate',
  GLUCOSE: 'blood_glucose',
};

const DEFAULT_THRESHOLDS = {
  HEART_RATE: { min: 60, max: 100 },
  SPO2: { min: 95, max: null },
  TEMPERATURE: { min: 36.1, max: 37.8 },
  SYSTOLIC: { min: 90, max: 140 },
  DIASTOLIC: { min: 60, max: 90 },
  RESPIRATORY_RATE: { min: 12, max: 20 },
  GLUCOSE: { min: 70, max: 140 },
};

const DEDUPE_WINDOW_MINUTES = 10;

async function getActiveThresholds(hospitalId) {
  const [rows] = await pool.query(
    'SELECT vital_type, min_value, max_value, severity, enabled FROM alert_thresholds WHERE hospital_id = ? AND enabled = 1',
    [hospitalId]
  );
  const map = {};
  for (const r of rows) map[r.vital_type] = r;
  return map;
}

function defaultSeverity(vitalType) {
  const s = {
    HEART_RATE: 'MEDIUM',
    SPO2: 'HIGH',
    TEMPERATURE: 'MEDIUM',
    SYSTOLIC: 'HIGH',
    DIASTOLIC: 'HIGH',
    RESPIRATORY_RATE: 'MEDIUM',
    GLUCOSE: 'MEDIUM',
  };
  return s[vitalType] || 'MEDIUM';
}

function evaluateReading(reading, thresholds) {
  const violations = [];
  for (const [vitalType, field] of Object.entries(VITAL_FIELD_MAP)) {
    const value = reading[field];
    if (value === null || value === undefined) continue;

    const cfg = thresholds[vitalType];
    const def = DEFAULT_THRESHOLDS[vitalType];
    const minValue = cfg && cfg.min_value !== null && cfg.min_value !== undefined ? Number(cfg.min_value) : def.min;
    const maxValue = cfg && cfg.max_value !== null && cfg.max_value !== undefined ? Number(cfg.max_value) : def.max;
    const severity = cfg ? cfg.severity : defaultSeverity(vitalType);

    const label = vitalType.replace(/_/g, ' ').toLowerCase();
    let issue = null;
    if (minValue !== null && value < minValue) {
      issue = { vitalType, severity, message: `${label} ${value} below minimum ${minValue}`, detected: value, threshold: minValue };
    } else if (maxValue !== null && value > maxValue) {
      issue = { vitalType, severity, message: `${label} ${value} above maximum ${maxValue}`, detected: value, threshold: maxValue };
    }

    if (issue) violations.push(issue);
  }
  return violations;
}

async function hasRecentActiveAlert(patientId, vitalType, vitalReadingId) {
  const [rows] = await pool.query(
    `SELECT id FROM alerts
      WHERE patient_id = ? AND alert_type = ? AND status IN ('NEW','ACKNOWLEDGED','IN_PROGRESS')
        AND created_at >= (NOW() - INTERVAL ? MINUTE)`,
    [patientId, vitalType, DEDUPE_WINDOW_MINUTES]
  );
  return rows.length > 0;
}

async function processReading(reading) {
  const patientId = reading.patient_id;
  const hospitalId = reading.hospital_id;

  const [patientRows] = await pool.query('SELECT id, hospital_id FROM patients WHERE id = ?', [patientId]);
  if (patientRows.length === 0) return { alerts: [] };
  const effectiveHospital = hospitalId || patientRows[0].hospital_id;

  const thresholds = await getActiveThresholds(effectiveHospital);
  const violations = evaluateReading(reading, thresholds);
  const created = [];

  for (const violation of violations) {
    const duplicate = await hasRecentActiveAlert(patientId, violation.vitalType, reading.id);
    if (duplicate) continue;

    const [result] = await pool.query(
      `INSERT INTO alerts
        (patient_id, vital_reading_id, alert_type, severity, title, message, detected_value, threshold_value, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'NEW')`,
      [
        patientId,
        reading.id,
        violation.vitalType,
        violation.severity,
        `Abnormal ${violation.vitalType.replace(/_/g, ' ').toLowerCase()}`,
        violation.message,
        violation.detected,
        violation.threshold,
      ]
    );

    created.push({ id: result.insertId, ...violation, patientId });
  }

  return { alerts: created };
}

async function acknowledgeAlert(alertId, userId) {
  const [result] = await pool.query(
    `UPDATE alerts SET status = 'ACKNOWLEDGED', acknowledged_by = ?, acknowledged_at = NOW()
      WHERE id = ? AND status IN ('NEW','ACKNOWLEDGED','IN_PROGRESS')`,
    [userId, alertId]
  );
  if (result.affectedRows === 0) {
    const [rows] = await pool.query('SELECT id, status FROM alerts WHERE id = ?', [alertId]);
    if (rows.length === 0) {
      const err = new Error('Alert not found');
      err.statusCode = 404;
      throw err;
    }
    const err = new Error(`Alert cannot be acknowledged from status ${rows[0].status}`);
    err.statusCode = 409;
    throw err;
  }
  await writeAuditLog({
    userId,
    action: 'ALERT_ACKNOWLEDGED',
    entityType: 'alerts',
    entityId: alertId,
    description: `Acknowledged alert #${alertId}`,
  });
  realtime.emitAlertUpdate(alertId, { status: 'ACKNOWLEDGED', acknowledged_by: userId });
  return { id: alertId, status: 'ACKNOWLEDGED' };
}

async function resolveAlert(alertId, userId) {
  const [result] = await pool.query(
    `UPDATE alerts SET status = 'RESOLVED', resolved_by = ?, resolved_at = NOW()
      WHERE id = ? AND status <> 'RESOLVED'`,
    [userId, alertId]
  );
  if (result.affectedRows === 0) {
    const [rows] = await pool.query('SELECT id, status FROM alerts WHERE id = ?', [alertId]);
    if (rows.length === 0) {
      const err = new Error('Alert not found');
      err.statusCode = 404;
      throw err;
    }
    return { id: alertId, status: rows[0].status };
  }
  await writeAuditLog({
    userId,
    action: 'ALERT_RESOLVED',
    entityType: 'alerts',
    entityId: alertId,
    description: `Resolved alert #${alertId}`,
  });
  realtime.emitAlertUpdate(alertId, { status: 'RESOLVED', resolved_by: userId });
  return { id: alertId, status: 'RESOLVED' };
}

module.exports = {
  VITAL_FIELD_MAP,
  DEFAULT_THRESHOLDS,
  evaluateReading,
  processReading,
  acknowledgeAlert,
  resolveAlert,
};
