'use strict';

const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { AppError } = require('../utils/asyncHandler');
const { writeAuditLog } = require('../middleware/audit');

const PATIENT_COLS = `
  p.id, p.patient_number, p.first_name, p.middle_name, p.last_name,
  p.date_of_birth, p.gender, p.blood_group, p.national_id, p.address, p.city, p.country,
  p.emergency_contact_name, p.emergency_contact_phone, p.emergency_contact_relationship,
  p.allergies, p.existing_conditions, p.admission_date, p.discharge_date, p.status,
  p.user_id, p.hospital_id, p.department_id, p.created_at, p.updated_at
`;

function generatePatientNumber(prefix) {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `${prefix || 'PT'}-${n}`;
}

async function canAccessPatient(user, patient) {
  if (!patient) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role === 'PATIENT') return patient.user_id === user.id;
  if (user.role === 'DOCTOR' || user.role === 'NURSE') {
    const profileTable = user.role === 'DOCTOR' ? 'doctors' : 'nurses';
    const [profiles] = await pool.query(`SELECT id FROM ${profileTable} WHERE user_id = ?`, [user.id]);
    if (profiles.length === 0) return false;
    const staffId = profiles[0].id;
    const staffCol = user.role === 'DOCTOR' ? 'doctor_id' : 'nurse_id';
    const [assignments] = await pool.query(
      `SELECT id FROM patient_assignments WHERE patient_id = ? AND ${staffCol} = ? AND status = 'ACTIVE'`,
      [patient.id, staffId]
    );
    return assignments.length > 0;
  }
  return false;
}

async function listPatients(req, res, next) {
  try {
    const { search, status, department_id, page = 1, limit = 20, assigned_to_me } = req.query;
    const conditions = [];
    const params = [];

    if (req.user.role === 'DOCTOR' || req.user.role === 'NURSE') {
      const table = req.user.role === 'DOCTOR' ? 'doctors' : 'nurses';
      const staffCol = req.user.role === 'DOCTOR' ? 'doctor_id' : 'nurse_id';
      const [profiles] = await pool.query(`SELECT id FROM ${table} WHERE user_id = ?`, [req.userId]);
      if (profiles.length === 0) return res.json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20 } });
      conditions.push(
        `EXISTS (SELECT 1 FROM patient_assignments pa WHERE pa.patient_id = p.id AND pa.${staffCol} = ? AND pa.status = 'ACTIVE')`
      );
      params.push(profiles[0].id);
    } else if (req.user.role === 'PATIENT') {
      conditions.push('p.user_id = ?');
      params.push(req.userId);
    }

    if (assigned_to_me === 'true' && (req.user.role === 'DOCTOR' || req.user.role === 'NURSE')) {
      // already applied above
    }
    if (search) {
      conditions.push('(p.first_name LIKE ? OR p.last_name LIKE ? OR p.patient_number LIKE ? OR p.national_id LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
      conditions.push('p.status = ?');
      params.push(status);
    }
    if (department_id) {
      conditions.push('p.department_id = ?');
      params.push(department_id);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM patients p ${where}`, params);
    const [rows] = await pool.query(
      `SELECT ${PATIENT_COLS}, u.email AS email, u.phone AS phone,
              d.name AS department_name
         FROM patients p
         LEFT JOIN users u ON u.id = p.user_id
         LEFT JOIN departments d ON d.id = p.department_id
         ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), offset]
    );
    return res.json({ success: true, data: rows, meta: { total, page: parseInt(page, 10), limit: parseInt(limit, 10) } });
  } catch (err) {
    return next(err);
  }
}

async function getPatient(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT ${PATIENT_COLS}, u.email AS email, u.phone AS phone, d.name AS department_name
         FROM patients p
         LEFT JOIN users u ON u.id = p.user_id
         LEFT JOIN departments d ON d.id = p.department_id
        WHERE p.id = ?`,
      [id]
    );
    if (rows.length === 0) return next(new AppError(404, 'Patient not found'));
    const canAccess = await canAccessPatient(req.user, rows[0]);
    if (!canAccess) return next(new AppError(403, 'You do not have access to this patient'));

    const patient = rows[0];

    const [[vitalsCount]] = await pool.query('SELECT COUNT(*) AS total FROM vital_readings WHERE patient_id = ?', [id]);
    const [latestVitals] = await pool.query('SELECT * FROM vital_readings WHERE patient_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1', [id]);
    const [history] = await pool.query('SELECT * FROM medical_history WHERE patient_id = ? ORDER BY diagnosed_date DESC', [id]);
    const [records] = await pool.query(
      `SELECT mr.*, d.full_name AS doctor_name FROM medical_records mr
         LEFT JOIN doctors doc ON doc.id = mr.doctor_id
         LEFT JOIN users d ON d.id = doc.user_id
        WHERE mr.patient_id = ? ORDER BY mr.record_date DESC`,
      [id]
    );
    const [devices] = await pool.query(
      `SELECT md.*, da.assigned_at FROM device_assignments da
         JOIN medical_devices md ON md.id = da.device_id
        WHERE da.patient_id = ? AND da.status = 'ACTIVE'`,
      [id]
    );
    const [assignments] = await pool.query(
      `SELECT pa.*, doc.id AS doctor_profile_id, doc.specialization, du.full_name AS doctor_name,
              nu.full_name AS nurse_name
         FROM patient_assignments pa
         LEFT JOIN doctors doc ON doc.id = pa.doctor_id
         LEFT JOIN users du ON du.id = doc.user_id
         LEFT JOIN nurses nur ON nur.id = pa.nurse_id
         LEFT JOIN users nu ON nu.id = nur.user_id
        WHERE pa.patient_id = ? AND pa.status = 'ACTIVE'`,
      [id]
    );

    return res.json({
      success: true,
      data: {
        ...patient,
        vitals: { latest: latestVitals[0] || null, total: vitalsCount.total },
        medical_history: history,
        medical_records: records,
        devices,
        assignments,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function createPatient(req, res, next) {
  try {
    const body = req.body;
    const password = body.password || 'Patient123!';
    const hash = await bcrypt.hash(password, 10);

    const [existingEmail] = await pool.query('SELECT id FROM users WHERE email = ?', [body.email]);
    if (existingEmail.length) return next(new AppError(409, 'Email already registered'));

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [userResult] = await conn.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role, hospital_id, department_id, status)
         VALUES (?, ?, ?, ?, 'PATIENT', ?, ?, 'ACTIVE')`,
        [body.full_name || `${body.first_name} ${body.last_name}`, body.email, body.phone || null, hash, body.hospital_id || 1, body.department_id || null]
      );
      const patientNumber = generatePatientNumber(body.patient_prefix);
      const [patientResult] = await conn.query(
        `INSERT INTO patients
          (user_id, hospital_id, department_id, patient_number, first_name, middle_name, last_name,
           date_of_birth, gender, blood_group, national_id, address, city, country,
           emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
           allergies, existing_conditions, admission_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userResult.insertId,
          body.hospital_id || 1,
          body.department_id || null,
          patientNumber,
          body.first_name,
          body.middle_name || null,
          body.last_name,
          body.date_of_birth || null,
          body.gender || null,
          body.blood_group || 'UNKNOWN',
          body.national_id || null,
          body.address || null,
          body.city || null,
          body.country || null,
          body.emergency_contact_name || null,
          body.emergency_contact_phone || null,
          body.emergency_contact_relationship || null,
          body.allergies || null,
          body.existing_conditions || null,
          body.admission_date || null,
          body.status || 'ACTIVE',
        ]
      );
      await conn.commit();
      await writeAuditLog({
        userId: req.userId,
        action: 'PATIENT_CREATED',
        entityType: 'patients',
        entityId: patientResult.insertId,
        description: `Registered new patient ${patientNumber} (${body.first_name} ${body.last_name})`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      return res.status(201).json({ success: true, data: { id: patientResult.insertId, patient_number: patientNumber, user_id: userResult.insertId } });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return next(new AppError(409, 'Duplicate entry (email or national id already exists)'));
    return next(err);
  }
}

async function updatePatient(req, res, next) {
  try {
    const { id } = req.params;
    const [existing] = await pool.query('SELECT * FROM patients WHERE id = ?', [id]);
    if (existing.length === 0) return next(new AppError(404, 'Patient not found'));

    const allowed = [
      'first_name', 'middle_name', 'last_name', 'date_of_birth', 'gender', 'blood_group',
      'national_id', 'address', 'city', 'country', 'emergency_contact_name', 'emergency_contact_phone',
      'emergency_contact_relationship', 'allergies', 'existing_conditions', 'admission_date',
      'discharge_date', 'status', 'department_id',
    ];
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
    await pool.query(`UPDATE patients SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
    const [rows] = await pool.query('SELECT * FROM patients WHERE id = ?', [id]);
    await writeAuditLog({
      userId: req.userId,
      action: 'PATIENT_UPDATED',
      entityType: 'patients',
      entityId: id,
      description: `Updated patient record ${rows[0].patient_number}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return next(err);
  }
}

async function assignStaff(req, res, next) {
  try {
    const { patientId } = req.params;
    const { doctor_id, nurse_id } = req.body;
    const [existing] = await pool.query('SELECT * FROM patients WHERE id = ?', [patientId]);
    if (existing.length === 0) return next(new AppError(404, 'Patient not found'));

    const [result] = await pool.query(
      `INSERT INTO patient_assignments (patient_id, doctor_id, nurse_id, assigned_by, status)
       VALUES (?, ?, ?, ?, 'ACTIVE')`,
      [patientId, doctor_id || null, nurse_id || null, req.userId]
    );
    await pool.query(
      `UPDATE patient_assignments SET status = 'ENDED', end_date = NOW()
        WHERE patient_id = ? AND status = 'ACTIVE' AND id <> ?`,
      [patientId, result.insertId]
    );
    await writeAuditLog({
      userId: req.userId,
      action: 'PATIENT_ASSIGNED',
      entityType: 'patients',
      entityId: patientId,
      description: `Assigned doctor #${doctor_id || '-'} / nurse #${nurse_id || '-'} to patient`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(201).json({ success: true, data: { id: result.insertId, patient_id: patientId, doctor_id, nurse_id } });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listPatients, getPatient, createPatient, updatePatient, assignStaff, canAccessPatient };
