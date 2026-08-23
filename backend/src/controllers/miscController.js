'use strict';

const pool = require('../config/db');
const { AppError } = require('../utils/asyncHandler');

async function createEcg(req, res, next) {
  try {
    const { patient_id, device_id, heart_rate, rhythm, waveform_data } = req.body;
    const [result] = await pool.query(
      `INSERT INTO ecg_readings (patient_id, device_id, heart_rate, rhythm, waveform_data)
       VALUES (?, ?, ?, ?, ?)`,
      [patient_id, device_id || null, heart_rate || null, rhythm || null, waveform_data ? JSON.stringify(waveform_data) : null]
    );
    const [rows] = await pool.query('SELECT * FROM ecg_readings WHERE id = ?', [result.insertId]);
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    return next(err);
  }
}

async function listEcg(req, res, next) {
  try {
    const { patientId } = req.params;
    const { limit = 50 } = req.query;
    const [rows] = await pool.query(
      'SELECT * FROM ecg_readings WHERE patient_id = ? ORDER BY recorded_at DESC, id DESC LIMIT ?',
      [patientId, parseInt(limit, 10)]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
}

async function listAuditLogs(req, res, next) {
  try {
    const { user_id, action, entity_type, page = 1, limit = 50 } = req.query;
    const conditions = [];
    const params = [];
    if (user_id) {
      conditions.push('user_id = ?');
      params.push(user_id);
    }
    if (action) {
      conditions.push('action = ?');
      params.push(action);
    }
    if (entity_type) {
      conditions.push('entity_type = ?');
      params.push(entity_type);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM audit_logs ${where}`, params);
    const [rows] = await pool.query(
      `SELECT a.*, u.full_name, u.email, u.role FROM audit_logs a
         LEFT JOIN users u ON u.id = a.user_id
         ${where} ORDER BY a.id DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), offset]
    );
    return res.json({ success: true, data: rows, meta: { total, page: parseInt(page, 10), limit: parseInt(limit, 10) } });
  } catch (err) {
    return next(err);
  }
}

async function listSecurityEvents(req, res, next) {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM security_events');
    const [rows] = await pool.query(
      `SELECT s.*, u.full_name, u.email FROM security_events s
         LEFT JOIN users u ON u.id = s.user_id
        ORDER BY s.id DESC LIMIT ? OFFSET ?`,
      [parseInt(limit, 10), offset]
    );
    return res.json({ success: true, data: rows, meta: { total, page: parseInt(page, 10), limit: parseInt(limit, 10) } });
  } catch (err) {
    return next(err);
  }
}

async function getDashboard(req, res, next) {
  try {
    const role = req.user.role;

    if (role === 'ADMIN') {
      const [[stats]] = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM patients) AS patients,
           (SELECT COUNT(*) FROM doctors) AS doctors,
           (SELECT COUNT(*) FROM nurses) AS nurses,
           (SELECT COUNT(*) FROM hospitals) AS hospitals,
           (SELECT COUNT(*) FROM medical_devices) AS devices,
           (SELECT COUNT(*) FROM users WHERE status='ACTIVE') AS active_users`
      );
      const [[alerts]] = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM alerts WHERE status='NEW') AS new_alerts,
           (SELECT COUNT(*) FROM alerts WHERE severity IN ('HIGH','CRITICAL') AND status IN ('NEW','ACKNOWLEDGED','IN_PROGRESS')) AS critical_alerts,
           (SELECT COUNT(*) FROM alerts WHERE status='RESOLVED') AS resolved_alerts`
      );
      const [[counts]] = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM patients WHERE status='ADMITTED') AS admitted,
           (SELECT COUNT(*) FROM patients WHERE status='CRITICAL') AS critical_patients,
           (SELECT COUNT(*) FROM patients WHERE status='ACTIVE') AS active_patients`
      );
      const [recentAlerts] = await pool.query(
        `SELECT a.*, CONCAT(p.first_name,' ',p.last_name) AS patient_name
           FROM alerts a LEFT JOIN patients p ON p.id = a.patient_id
          ORDER BY a.created_at DESC, a.id DESC LIMIT 10`
      );
      const [activity] = await pool.query(
        `SELECT DATE(created_at) AS day, COUNT(*) AS count FROM audit_logs GROUP BY DATE(created_at) ORDER BY day DESC LIMIT 14`
      );
      return res.json({
        success: true,
        data: {
          stats: { ...stats, ...counts },
          alerts,
          recent_alerts: recentAlerts,
          activity: activity.reverse(),
        },
      });
    }

    if (role === 'DOCTOR' || role === 'NURSE') {
      const table = role === 'DOCTOR' ? 'doctors' : 'nurses';
      const staffCol = role === 'DOCTOR' ? 'doctor_id' : 'nurse_id';
      const [profiles] = await pool.query(`SELECT id FROM ${table} WHERE user_id = ?`, [req.userId]);
      if (profiles.length === 0) return res.json({ success: true, data: { my_patients: 0, open_alerts: 0, critical_alerts: 0, today_appointments: 0 } });
      const staffId = profiles[0].id;

      const [[stats]] = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM patient_assignments WHERE ${staffCol} = ? AND status='ACTIVE') AS my_patients,
           (SELECT COUNT(*) FROM alerts a WHERE a.status IN ('NEW','ACKNOWLEDGED','IN_PROGRESS') AND EXISTS (
               SELECT 1 FROM patient_assignments pa WHERE pa.patient_id = a.patient_id AND pa.${staffCol} = ? AND pa.status='ACTIVE')) AS open_alerts,
           (SELECT COUNT(*) FROM alerts a WHERE a.severity IN ('HIGH','CRITICAL') AND a.status IN ('NEW','ACKNOWLEDGED','IN_PROGRESS') AND EXISTS (
               SELECT 1 FROM patient_assignments pa WHERE pa.patient_id = a.patient_id AND pa.${staffCol} = ? AND pa.status='ACTIVE')) AS critical_alerts,
           (SELECT COUNT(*) FROM appointments WHERE ${staffCol} = ? AND DATE(appointment_date) = CURDATE() AND status IN ('SCHEDULED','CONFIRMED')) AS today_appointments`,
        [staffId, staffId, staffId, staffId]
      );
      const [myAlerts] = await pool.query(
        `SELECT a.*, CONCAT(p.first_name,' ',p.last_name) AS patient_name
           FROM alerts a
           JOIN patient_assignments pa ON pa.patient_id = a.patient_id AND pa.${staffCol} = ? AND pa.status='ACTIVE'
           LEFT JOIN patients p ON p.id = a.patient_id
          WHERE a.status IN ('NEW','ACKNOWLEDGED','IN_PROGRESS')
          ORDER BY a.created_at DESC, a.id DESC LIMIT 10`,
        [staffId]
      );
      return res.json({ success: true, data: { stats, my_alerts: myAlerts } });
    }

    if (role === 'PATIENT') {
      const [patients] = await pool.query('SELECT id FROM patients WHERE user_id = ?', [req.userId]);
      if (patients.length === 0) {
        return res.json({ success: true, data: { profile_linked: false } });
      }
      const patientId = patients[0].id;
      const [[stats]] = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM vital_readings WHERE patient_id = ?) AS total_readings,
           (SELECT COUNT(*) FROM appointments WHERE patient_id = ? AND DATE(appointment_date) = CURDATE()) AS today_appointments,
           (SELECT COUNT(*) FROM prescriptions WHERE patient_id = ? AND status='ACTIVE') AS active_prescriptions,
           (SELECT risk_level FROM ai_predictions WHERE patient_id = ? ORDER BY generated_at DESC, id DESC LIMIT 1) AS latest_risk_level,
           (SELECT risk_score FROM ai_predictions WHERE patient_id = ? ORDER BY generated_at DESC, id DESC LIMIT 1) AS latest_risk_score`,
        [patientId, patientId, patientId, patientId, patientId]
      );
      const [latestVitals] = await pool.query(
        'SELECT * FROM vital_readings WHERE patient_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1',
        [patientId]
      );
      const [upcoming] = await pool.query(
        `SELECT a.*, u.full_name AS doctor_name FROM appointments a
           LEFT JOIN doctors doc ON doc.id = a.doctor_id
           LEFT JOIN users u ON u.id = doc.user_id
          WHERE a.patient_id = ? AND a.appointment_date >= NOW() AND a.status IN ('SCHEDULED','CONFIRMED')
          ORDER BY a.appointment_date LIMIT 5`,
        [patientId]
      );
      return res.json({ success: true, data: { stats, latest_vitals: latestVitals[0] || null, upcoming_appointments: upcoming } });
    }

    return next(new AppError(400, 'Unknown role'));
  } catch (err) {
    return next(err);
  }
}

module.exports = { createEcg, listEcg, listAuditLogs, listSecurityEvents, getDashboard };
