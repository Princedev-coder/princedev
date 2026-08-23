'use strict';

const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { AppError } = require('../utils/asyncHandler');
const { writeAuditLog } = require('../middleware/audit');

async function createStaff(req, res, next) {
  try {
    const { role } = req.params;
    if (role !== 'doctor' && role !== 'nurse') {
      return next(new AppError(400, 'role must be "doctor" or "nurse"'));
    }
    const body = req.body;
    const password = body.password || 'Staff123!';
    const hash = await bcrypt.hash(password, 10);

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [body.email]);
    if (existing.length) return next(new AppError(409, 'Email already registered'));

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [userResult] = await conn.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role, hospital_id, department_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
        [body.full_name, body.email, body.phone || null, hash, role.toUpperCase(), body.hospital_id || 1, body.department_id || null]
      );

      let staffId;
      if (role === 'doctor') {
        const [r] = await conn.query(
          `INSERT INTO doctors (user_id, hospital_id, department_id, license_number, specialization, qualification, years_of_experience)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [userResult.insertId, body.hospital_id || 1, body.department_id || null, body.license_number, body.specialization || null, body.qualification || null, body.years_of_experience || 0]
        );
        staffId = r.insertId;
      } else {
        const [r] = await conn.query(
          `INSERT INTO nurses (user_id, hospital_id, department_id, license_number, qualification, shift)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [userResult.insertId, body.hospital_id || 1, body.department_id || null, body.license_number, body.qualification || null, body.shift || null]
        );
        staffId = r.insertId;
      }
      await conn.commit();
      await writeAuditLog({
        userId: req.userId,
        action: 'STAFF_CREATED',
        entityType: role === 'doctor' ? 'doctors' : 'nurses',
        entityId: staffId,
        description: `Registered ${role} ${body.full_name} (${body.email})`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      return res.status(201).json({ success: true, data: { user_id: userResult.insertId, [role]: { id: staffId } } });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return next(new AppError(409, 'Duplicate entry (email or license number already exists)'));
    return next(err);
  }
}

async function listDoctors(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT d.id, d.user_id, d.hospital_id, d.department_id, d.license_number, d.specialization,
              d.qualification, d.years_of_experience, u.full_name, u.email, u.phone, u.status,
              dep.name AS department_name
         FROM doctors d
         LEFT JOIN users u ON u.id = d.user_id
         LEFT JOIN departments dep ON dep.id = d.department_id
        ORDER BY d.id`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
}

async function listNurses(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT n.id, n.user_id, n.hospital_id, n.department_id, n.license_number, n.qualification, n.shift,
              u.full_name, u.email, u.phone, u.status, dep.name AS department_name
         FROM nurses n
         LEFT JOIN users u ON u.id = n.user_id
         LEFT JOIN departments dep ON dep.id = n.department_id
        ORDER BY n.id`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
}

module.exports = { createStaff, listDoctors, listNurses };
