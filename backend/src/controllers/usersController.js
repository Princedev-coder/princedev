'use strict';

const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { AppError } = require('../utils/asyncHandler');

const USER_FIELDS = ['id', 'full_name', 'email', 'phone', 'role', 'status', 'hospital_id', 'department_id', 'last_login', 'created_at'];

async function getProfile(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.userId]);
    if (rows.length === 0) return next(new AppError(404, 'User not found'));
    const user = rows[0];
    delete user.password_hash;

    let profile = null;
    if (user.role === 'DOCTOR') {
      const [d] = await pool.query('SELECT * FROM doctors WHERE user_id = ?', [user.id]);
      if (d.length) profile = { ...d[0], type: 'doctor' };
    } else if (user.role === 'NURSE') {
      const [n] = await pool.query('SELECT * FROM nurses WHERE user_id = ?', [user.id]);
      if (n.length) profile = { ...n[0], type: 'nurse' };
    } else if (user.role === 'PATIENT') {
      const [p] = await pool.query('SELECT * FROM patients WHERE user_id = ?', [user.id]);
      if (p.length) profile = { ...p[0], type: 'patient' };
    }

    return res.json({ success: true, data: { ...user, profile } });
  } catch (err) {
    return next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const allowed = ['full_name', 'phone'];
    const updates = [];
    const params = [];
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    }
    if (updates.length === 0) return next(new AppError(400, 'Nothing to update'));
    params.push(req.userId);
    await pool.query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.userId]);
    const user = rows[0];
    delete user.password_hash;
    return res.json({ success: true, data: user });
  } catch (err) {
    return next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const { role, status, search, page = 1, limit = 20 } = req.query;
    const conditions = [];
    const params = [];
    if (role) {
      conditions.push('role = ?');
      params.push(role);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (search) {
      conditions.push('(full_name LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM users ${where}`, params);
    const [rows] = await pool.query(
      `SELECT ${USER_FIELDS.join(', ')} FROM users ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), offset]
    );
    return res.json({ success: true, data: rows, meta: { total, page: parseInt(page, 10), limit: parseInt(limit, 10) } });
  } catch (err) {
    return next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const { full_name, email, phone, role, password, hospital_id, department_id, license_number } = req.body;
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return next(new AppError(409, 'Email already registered'));

    const hash = await bcrypt.hash(password, 10);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role, hospital_id, department_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
        [full_name, email, phone || null, hash, role, hospital_id || 1, department_id || null]
      );
      const userId = result.insertId;

      if (role === 'DOCTOR') {
        await conn.query(
          `INSERT INTO doctors (user_id, hospital_id, department_id, license_number)
           VALUES (?, ?, ?, ?)`,
          [userId, hospital_id || 1, department_id || null, license_number]
        );
      } else if (role === 'NURSE') {
        await conn.query(
          `INSERT INTO nurses (user_id, hospital_id, department_id, license_number)
           VALUES (?, ?, ?, ?)`,
          [userId, hospital_id || 1, department_id || null, license_number]
        );
      } else if (role === 'PATIENT') {
        const parts = full_name.split(' ').filter(Boolean);
        const patientNumber = `PT-${Math.floor(100000 + Math.random() * 900000)}`;
        await conn.query(
          `INSERT INTO patients (user_id, hospital_id, department_id, patient_number, first_name, last_name, status)
           VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
          [userId, hospital_id || 1, department_id || null, patientNumber, parts[0] || full_name, parts.slice(1).join(' ') || 'N/A']
        );
      }

      await conn.commit();
      const [rows] = await conn.query(`SELECT ${USER_FIELDS.join(', ')} FROM users WHERE id = ?`, [userId]);
      return res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return next(new AppError(409, 'Email already registered'));
    return next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const allowed = ['full_name', 'email', 'phone', 'role', 'hospital_id', 'department_id', 'status'];
    const updates = [];
    const params = [];
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    }
    if (req.body.password) {
      const hash = await bcrypt.hash(req.body.password, 10);
      updates.push('password_hash = ?');
      params.push(hash);
    }
    if (updates.length === 0) return next(new AppError(400, 'Nothing to update'));
    params.push(id);
    await pool.query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
    const [rows] = await pool.query(`SELECT ${USER_FIELDS.join(', ')} FROM users WHERE id = ?`, [id]);
    if (rows.length === 0) return next(new AppError(404, 'User not found'));
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return next(new AppError(409, 'Email already registered'));
    return next(err);
  }
}

module.exports = { getProfile, updateProfile, listUsers, createUser, updateUser };
