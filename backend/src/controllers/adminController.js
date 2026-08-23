'use strict';

const pool = require('../config/db');
const { AppError } = require('../utils/asyncHandler');

async function listHospitals(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM hospitals ORDER BY id');
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
}

async function createHospital(req, res, next) {
  try {
    const { hospital_code, name, phone, email, address, city, country } = req.body;
    const [existing] = await pool.query('SELECT id FROM hospitals WHERE hospital_code = ?', [hospital_code]);
    if (existing.length) return next(new AppError(409, 'Hospital code already exists'));
    const [result] = await pool.query(
      `INSERT INTO hospitals (hospital_code, name, phone, email, address, city, country) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [hospital_code, name, phone || null, email || null, address || null, city || null, country || null]
    );
    const [rows] = await pool.query('SELECT * FROM hospitals WHERE id = ?', [result.insertId]);
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    return next(err);
  }
}

async function updateHospital(req, res, next) {
  try {
    const { id } = req.params;
    const allowed = ['hospital_code', 'name', 'phone', 'email', 'address', 'city', 'country', 'status'];
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
    await pool.query(`UPDATE hospitals SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
    const [rows] = await pool.query('SELECT * FROM hospitals WHERE id = ?', [id]);
    if (rows.length === 0) return next(new AppError(404, 'Hospital not found'));
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return next(err);
  }
}

async function listDepartments(req, res, next) {
  try {
    const hospitalId = req.params.hospitalId || req.query.hospital_id;
    if (hospitalId) {
      const [rows] = await pool.query('SELECT * FROM departments WHERE hospital_id = ? ORDER BY name', [hospitalId]);
      return res.json({ success: true, data: rows });
    }
    const [rows] = await pool.query('SELECT * FROM departments ORDER BY hospital_id, name');
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
}

async function createDepartment(req, res, next) {
  try {
    const { hospital_id, name, description } = req.body;
    const [result] = await pool.query(
      'INSERT INTO departments (hospital_id, name, description) VALUES (?, ?, ?)',
      [hospital_id, name, description || null]
    );
    const [rows] = await pool.query('SELECT * FROM departments WHERE id = ?', [result.insertId]);
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return next(new AppError(409, 'Department name already exists in this hospital'));
    return next(err);
  }
}

async function updateDepartment(req, res, next) {
  try {
    const { id } = req.params;
    const allowed = ['name', 'description'];
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
    await pool.query(`UPDATE departments SET ${updates.join(', ')} WHERE id = ?`, params);
    const [rows] = await pool.query('SELECT * FROM departments WHERE id = ?', [id]);
    if (rows.length === 0) return next(new AppError(404, 'Department not found'));
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listHospitals, createHospital, updateHospital, listDepartments, createDepartment, updateDepartment };
