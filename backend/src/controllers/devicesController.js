'use strict';

const pool = require('../config/db');
const env = require('../config/env');
const { AppError } = require('../utils/asyncHandler');
const { writeAuditLog } = require('../middleware/audit');
const alertService = require('../services/alertService');
const aiService = require('../services/aiService');
const notificationService = require('../services/notificationService');
const realtime = require('../services/realtimeService');

async function listDevices(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM medical_devices ORDER BY id DESC');
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
}

async function createDevice(req, res, next) {
  try {
    const { device_code, device_name, device_type, manufacturer, model, api_endpoint, status } = req.body;
    const [existing] = await pool.query('SELECT id FROM medical_devices WHERE device_code = ?', [device_code]);
    if (existing.length) return next(new AppError(409, 'Device code already exists'));
    const [result] = await pool.query(
      `INSERT INTO medical_devices (device_code, device_name, device_type, manufacturer, model, api_endpoint, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [device_code, device_name, device_type, manufacturer || null, model || null, api_endpoint || null, status || 'ACTIVE']
    );
    const [rows] = await pool.query('SELECT * FROM medical_devices WHERE id = ?', [result.insertId]);
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    return next(err);
  }
}

async function updateDevice(req, res, next) {
  try {
    const { id } = req.params;
    const allowed = ['device_name', 'device_type', 'manufacturer', 'model', 'api_endpoint', 'status', 'last_seen'];
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
    await pool.query(`UPDATE medical_devices SET ${updates.join(', ')} WHERE id = ?`, params);
    const [rows] = await pool.query('SELECT * FROM medical_devices WHERE id = ?', [id]);
    if (rows.length === 0) return next(new AppError(404, 'Device not found'));
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return next(err);
  }
}

async function assignDevice(req, res, next) {
  try {
    const { deviceId, patientId } = req.params;
    const [device] = await pool.query('SELECT id, status FROM medical_devices WHERE id = ?', [deviceId]);
    if (device.length === 0) return next(new AppError(404, 'Device not found'));
    const [patient] = await pool.query('SELECT id FROM patients WHERE id = ?', [patientId]);
    if (patient.length === 0) return next(new AppError(404, 'Patient not found'));

    await pool.query(
      `UPDATE device_assignments SET status = 'ENDED', unassigned_at = NOW()
        WHERE device_id = ? AND status = 'ACTIVE'`,
      [deviceId]
    );
    const [result] = await pool.query(
      `INSERT INTO device_assignments (device_id, patient_id, status) VALUES (?, ?, 'ACTIVE')`,
      [deviceId, patientId]
    );
    await writeAuditLog({
      userId: req.userId,
      action: 'DEVICE_ASSIGNED',
      entityType: 'device_assignments',
      entityId: result.insertId,
      description: `Assigned device #${deviceId} to patient #${patientId}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(201).json({ success: true, data: { id: result.insertId, device_id: deviceId, patient_id: patientId, status: 'ACTIVE' } });
  } catch (err) {
    return next(err);
  }
}

async function unassignDevice(req, res, next) {
  try {
    const { assignmentId } = req.params;
    const [result] = await pool.query(
      `UPDATE device_assignments SET status = 'ENDED', unassigned_at = NOW() WHERE id = ? AND status = 'ACTIVE'`,
      [assignmentId]
    );
    if (result.affectedRows === 0) return next(new AppError(404, 'Active assignment not found'));
    return res.json({ success: true, message: 'Device unassigned' });
  } catch (err) {
    return next(err);
  }
}

async function ingestReading(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== env.sensorApiKey) {
      return next(new AppError(401, 'Invalid sensor API key'));
    }
    const { device_code, patient_id, values } = req.body;
    if (!device_code) return next(new AppError(400, 'device_code is required'));
    if (!values || typeof values !== 'object') return next(new AppError(400, 'values object is required'));

    const [devices] = await pool.query('SELECT * FROM medical_devices WHERE device_code = ?', [device_code]);
    if (devices.length === 0) return next(new AppError(404, 'Unknown device code'));
    const device = devices[0];
    if (device.status !== 'ACTIVE') return next(new AppError(403, `Device status is ${device.status}`));

    let effectivePatientId = patient_id;
    if (!effectivePatientId) {
      const [assignments] = await pool.query(
        `SELECT patient_id FROM device_assignments WHERE device_id = ? AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1`,
        [device.id]
      );
      if (assignments.length === 0) return next(new AppError(409, 'Device is not assigned to any patient'));
      effectivePatientId = assignments[0].patient_id;
    }

    const allowedFields = ['heart_rate', 'spo2', 'temperature', 'systolic_pressure', 'diastolic_pressure', 'respiratory_rate', 'blood_glucose', 'weight'];
    const insertData = { patient_id: effectivePatientId, device_id: device.id };
    for (const field of allowedFields) {
      if (values[field] !== undefined) {
        const num = Number(values[field]);
        if (Number.isFinite(num)) insertData[field] = num;
      }
    }

    const [insertResult] = await pool.query(
      `INSERT INTO vital_readings
        (patient_id, device_id, heart_rate, spo2, temperature, systolic_pressure, diastolic_pressure, respiratory_rate, blood_glucose, weight, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DEVICE')`,
      [
        effectivePatientId,
        device.id,
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

    await pool.query('UPDATE medical_devices SET last_seen = NOW() WHERE id = ?', [device.id]);

    const reading = { id: insertResult.insertId, ...insertData };
    const [patientRows] = await pool.query('SELECT hospital_id FROM patients WHERE id = ?', [effectivePatientId]);
    reading.hospital_id = patientRows.length ? patientRows[0].hospital_id : null;

    const alertResult = await alertService.processReading(reading);

    let prediction = null;
    try {
      prediction = await aiService.generatePrediction(effectivePatientId, reading);
    } catch (err) {
      console.error('[ai] prediction failed:', err.message);
    }

    realtime.emitPatientVital(effectivePatientId, { ...reading, recorded_at: new Date() });

    const notifications = [];
    for (const alert of alertResult.alerts) {
      realtime.emitAlert({ id: alert.id, patient_id: effectivePatientId, alert_type: alert.vitalType, severity: alert.severity, title: alert.title || `Abnormal ${alert.vitalType.replace(/_/g, ' ').toLowerCase()}`, message: alert.message });
      const created = await notificationService.notifyUsersForPatient(effectivePatientId, {
        alertId: alert.id,
        title: alert.title || 'Abnormal vital',
        message: alert.message,
        type: 'ALERT',
      });
      notifications.push(...created);
    }

    return res.status(201).json({
      success: true,
      data: {
        reading_id: insertResult.insertId,
        patient_id: effectivePatientId,
        alerts: alertResult.alerts.map((a) => ({ id: a.id, type: a.vitalType, severity: a.severity, message: a.message })),
        prediction: prediction ? { id: prediction.id, risk_score: prediction.risk_score, risk_level: prediction.risk_level } : null,
        notifications_created: notifications.length,
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listDevices, createDevice, updateDevice, assignDevice, unassignDevice, ingestReading };
