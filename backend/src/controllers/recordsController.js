'use strict';

const pool = require('../config/db');
const { AppError } = require('../utils/asyncHandler');
const { writeAuditLog } = require('../middleware/audit');

const TABLES = {
  records: { table: 'medical_records', entity: 'medical_records', label: 'medical record' },
  prescriptions: { table: 'prescriptions', entity: 'prescriptions', label: 'prescription' },
  history: { table: 'medical_history', entity: 'medical_history', label: 'medical history' },
  labs: { table: 'laboratory_tests', entity: 'laboratory_tests', label: 'lab test' },
  appointments: { table: 'appointments', entity: 'appointments', label: 'appointment' },
  notes: { table: 'nurse_notes', entity: 'nurse_notes', label: 'nurse note' },
};

function buildCreateData(kind, body) {
  switch (kind) {
    case 'records':
      return {
        cols: ['patient_id', 'doctor_id', 'chief_complaint', 'symptoms', 'diagnosis', 'treatment_plan', 'clinical_notes', 'status'],
        vals: [body.patient_id, body.doctor_id || null, body.chief_complaint || null, body.symptoms || null, body.diagnosis || null, body.treatment_plan || null, body.clinical_notes || null, body.status || 'OPEN'],
      };
    case 'prescriptions':
      return {
        cols: ['patient_id', 'doctor_id', 'medical_record_id', 'notes', 'status'],
        vals: [body.patient_id, body.doctor_id, body.medical_record_id || null, body.notes || null, body.status || 'ACTIVE'],
      };
    case 'history':
      return {
        cols: ['patient_id', 'condition_name', 'description', 'diagnosed_date', 'resolved_date', 'status'],
        vals: [body.patient_id, body.condition_name, body.description || null, body.diagnosed_date || null, body.resolved_date || null, body.status || 'ACTIVE'],
      };
    case 'labs':
      return {
        cols: ['patient_id', 'doctor_id', 'test_name', 'test_type', 'requested_date', 'completed_date', 'result', 'reference_range', 'notes', 'status'],
        vals: [body.patient_id, body.doctor_id || null, body.test_name, body.test_type || null, body.requested_date || null, body.completed_date || null, body.result || null, body.reference_range || null, body.notes || null, body.status || 'REQUESTED'],
      };
    case 'appointments':
      return {
        cols: ['patient_id', 'doctor_id', 'appointment_date', 'reason', 'status', 'notes'],
        vals: [body.patient_id, body.doctor_id, body.appointment_date, body.reason || null, body.status || 'SCHEDULED', body.notes || null],
      };
    case 'notes':
      return {
        cols: ['patient_id', 'nurse_id', 'note'],
        vals: [body.patient_id, body.nurse_id, body.note],
      };
    default:
      return null;
  }
}

const UPDATE_FIELDS = {
  records: ['patient_id', 'doctor_id', 'chief_complaint', 'symptoms', 'diagnosis', 'treatment_plan', 'clinical_notes', 'status'],
  prescriptions: ['patient_id', 'doctor_id', 'medical_record_id', 'notes', 'status'],
  history: ['patient_id', 'condition_name', 'description', 'diagnosed_date', 'resolved_date', 'status'],
  labs: ['patient_id', 'doctor_id', 'test_name', 'test_type', 'requested_date', 'completed_date', 'result', 'reference_range', 'notes', 'status'],
  appointments: ['patient_id', 'doctor_id', 'appointment_date', 'reason', 'status', 'notes'],
  notes: ['note'],
};

async function createRecord(req, res, next) {
  try {
    const { kind } = req.params;
    const cfg = TABLES[kind];
    if (!cfg) return next(new AppError(400, 'Unknown record type'));
    const data = buildCreateData(kind, req.body);
    if (!data) return next(new AppError(400, 'Invalid request'));

    const placeholders = data.cols.map(() => '?').join(', ');
    const [result] = await pool.query(
      `INSERT INTO ${cfg.table} (${data.cols.join(', ')}) VALUES (${placeholders})`,
      data.vals
    );
    await writeAuditLog({
      userId: req.userId,
      action: `${cfg.entity.toUpperCase()}_CREATED`,
      entityType: cfg.entity,
      entityId: result.insertId,
      description: `Created ${cfg.label} for patient #${req.body.patient_id}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    const [rows] = await pool.query(`SELECT * FROM ${cfg.table} WHERE id = ?`, [result.insertId]);
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    return next(err);
  }
}

async function listRecords(req, res, next) {
  try {
    const { kind } = req.params;
    const cfg = TABLES[kind];
    if (!cfg) return next(new AppError(400, 'Unknown record type'));
    const { patient_id, doctor_id, status, page = 1, limit = 50 } = req.query;
    const conditions = [];
    const params = [];
    if (patient_id) {
      conditions.push(`${cfg.table}.patient_id = ?`);
      params.push(patient_id);
    }
    if (doctor_id) {
      conditions.push(`${cfg.table}.doctor_id = ?`);
      params.push(doctor_id);
    }
    if (status) {
      conditions.push(`${cfg.table}.status = ?`);
      params.push(status);
    }
    if (req.user.role === 'PATIENT') {
      conditions.push(`${cfg.table}.patient_id IN (SELECT id FROM patients WHERE user_id = ?)`);
      params.push(req.userId);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const joins = {
      records: 'LEFT JOIN patients p ON p.id = medical_records.patient_id LEFT JOIN doctors doc ON doc.id = medical_records.doctor_id LEFT JOIN users u ON u.id = doc.user_id',
      prescriptions: 'LEFT JOIN patients p ON p.id = prescriptions.patient_id LEFT JOIN doctors doc ON doc.id = prescriptions.doctor_id LEFT JOIN users u ON u.id = doc.user_id',
      history: 'LEFT JOIN patients p ON p.id = medical_history.patient_id',
      labs: 'LEFT JOIN patients p ON p.id = laboratory_tests.patient_id LEFT JOIN doctors doc ON doc.id = laboratory_tests.doctor_id LEFT JOIN users u ON u.id = doc.user_id',
      appointments: 'LEFT JOIN patients p ON p.id = appointments.patient_id LEFT JOIN doctors doc ON doc.id = appointments.doctor_id LEFT JOIN users u ON u.id = doc.user_id',
      notes: 'LEFT JOIN patients p ON p.id = nurse_notes.patient_id LEFT JOIN nurses nur ON nur.id = nurse_notes.nurse_id LEFT JOIN users u ON u.id = nur.user_id',
    };

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM ${cfg.table} ${where}`, params);
    const [rows] = await pool.query(
      `SELECT ${cfg.table}.*, CONCAT(p.first_name, ' ', p.last_name) AS patient_name, p.patient_number, u.full_name AS doctor_name
         FROM ${cfg.table}
         ${joins[kind]}
         ${where} ORDER BY ${cfg.table}.id DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), offset]
    );
    return res.json({ success: true, data: rows, meta: { total, page: parseInt(page, 10), limit: parseInt(limit, 10) } });
  } catch (err) {
    return next(err);
  }
}

async function updateRecord(req, res, next) {
  try {
    const { kind, id } = req.params;
    const cfg = TABLES[kind];
    if (!cfg) return next(new AppError(400, 'Unknown record type'));
    const allowed = UPDATE_FIELDS[kind];
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
    await pool.query(`UPDATE ${cfg.table} SET ${updates.join(', ')} WHERE id = ?`, params);
    const [rows] = await pool.query(`SELECT * FROM ${cfg.table} WHERE id = ?`, [id]);
    if (rows.length === 0) return next(new AppError(404, `${cfg.label} not found`));
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return next(err);
  }
}

async function addPrescriptionItems(req, res, next) {
  try {
    const { prescriptionId } = req.params;
    const items = Array.isArray(req.body) ? req.body : req.body.items;
    if (!Array.isArray(items) || items.length === 0) return next(new AppError(400, 'items array is required'));
    const created = [];
    for (const item of items) {
      const [result] = await pool.query(
        `INSERT INTO prescription_items (prescription_id, medicine_name, dosage, frequency, route, duration, quantity, instructions)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [prescriptionId, item.medicine_name, item.dosage || null, item.frequency || null, item.route || null, item.duration || null, item.quantity || null, item.instructions || null]
      );
      created.push(result.insertId);
    }
    return res.status(201).json({ success: true, data: { prescription_id: prescriptionId, items_added: created.length } });
  } catch (err) {
    return next(err);
  }
}

async function getPrescription(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT pr.*, CONCAT(p.first_name, ' ', p.last_name) AS patient_name, u.full_name AS doctor_name
         FROM prescriptions pr
         LEFT JOIN patients p ON p.id = pr.patient_id
         LEFT JOIN doctors doc ON doc.id = pr.doctor_id
         LEFT JOIN users u ON u.id = doc.user_id
        WHERE pr.id = ?`,
      [id]
    );
    if (rows.length === 0) return next(new AppError(404, 'Prescription not found'));
    const [items] = await pool.query('SELECT * FROM prescription_items WHERE prescription_id = ? ORDER BY id', [id]);
    return res.json({ success: true, data: { ...rows[0], items } });
  } catch (err) {
    return next(err);
  }
}

module.exports = { createRecord, listRecords, updateRecord, addPrescriptionItems, getPrescription };
