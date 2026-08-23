'use strict';

const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const env = require('../config/env');
const { AppError } = require('../utils/asyncHandler');
const { signToken, signRefreshToken, verifyToken } = require('../utils/jwt');
const { writeAuditLog } = require('../middleware/audit');

async function recordSecurityEvent({ userId, eventType, ipAddress, userAgent, details }) {
  try {
    await pool.query(
      `INSERT INTO security_events (user_id, event_type, ip_address, user_agent, details)
       VALUES (?, ?, ?, ?, ?)`,
      [userId || null, eventType, ipAddress || null, userAgent || null, details || null]
    );
  } catch (err) {
    console.error('[security] failed to log event:', err.message);
  }
}

async function getLoginState(userId) {
  const [rows] = await pool.query(
    `SELECT event_type, created_at FROM security_events
      WHERE user_id = ? AND event_type IN ('LOGIN_FAILED','ACCOUNT_LOCKED','LOGIN_SUCCESS')
      ORDER BY id DESC LIMIT 5`,
    [userId]
  );
  const failures = rows.filter((r) => r.event_type === 'LOGIN_FAILED').length;
  const locked = rows.find((r) => r.event_type === 'ACCOUNT_LOCKED');
  return { failures, locked };
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      await recordSecurityEvent({ eventType: 'LOGIN_FAILED', ipAddress: req.ip, userAgent: req.get('user-agent'), details: `No account for ${email}` });
      return next(new AppError(401, 'Invalid email or password'));
    }
    const user = rows[0];

    if (user.status !== 'ACTIVE') {
      await recordSecurityEvent({ userId: user.id, eventType: 'LOGIN_FAILED', ipAddress: req.ip, userAgent: req.get('user-agent'), details: 'Account not active' });
      return next(new AppError(403, 'Account is not active'));
    }

    const state = await getLoginState(user.id);
    if (state.locked) {
      const lockTime = new Date(state.locked.created_at);
      const unlock = new Date(lockTime.getTime() + env.security.loginLockoutMinutes * 60000);
      if (unlock > new Date()) {
        return next(new AppError(403, 'Account temporarily locked due to failed login attempts. Try again later.'));
      }
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await recordSecurityEvent({ userId: user.id, eventType: 'LOGIN_FAILED', ipAddress: req.ip, userAgent: req.get('user-agent'), details: 'Wrong password' });
      if (state.failures + 1 >= env.security.maxLoginAttempts) {
        await recordSecurityEvent({ userId: user.id, eventType: 'ACCOUNT_LOCKED', ipAddress: req.ip, userAgent: req.get('user-agent'), details: 'Max login attempts reached' });
      }
      return next(new AppError(401, 'Invalid email or password'));
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    await recordSecurityEvent({ userId: user.id, eventType: 'LOGIN_SUCCESS', ipAddress: req.ip, userAgent: req.get('user-agent') });

    const token = signToken({ sub: user.id, role: user.role });
    const refreshToken = signRefreshToken({ sub: user.id, role: user.role });

    return res.json({
      success: true,
      data: {
        token,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          hospital_id: user.hospital_id,
          department_id: user.department_id,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return next(new AppError(400, 'refresh_token is required'));
    let payload;
    try {
      payload = verifyToken(refresh_token);
    } catch {
      return next(new AppError(401, 'Invalid refresh token'));
    }
    const [rows] = await pool.query('SELECT id, role, status FROM users WHERE id = ?', [payload.sub]);
    if (rows.length === 0 || rows[0].status !== 'ACTIVE') {
      return next(new AppError(401, 'User no longer active'));
    }
    const token = signToken({ sub: rows[0].id, role: rows[0].role });
    await recordSecurityEvent({ userId: rows[0].id, eventType: 'TOKEN_REFRESH', ipAddress: req.ip, userAgent: req.get('user-agent') });
    return res.json({ success: true, data: { token } });
  } catch (err) {
    return next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { current_password, new_password } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.userId]);
    if (rows.length === 0) return next(new AppError(404, 'User not found'));
    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return next(new AppError(400, 'Current password is incorrect'));

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, req.userId]);
    await recordSecurityEvent({ userId: req.userId, eventType: 'PASSWORD_CHANGED', ipAddress: req.ip, userAgent: req.get('user-agent') });
    await writeAuditLog({ userId: req.userId, action: 'PASSWORD_CHANGED', entityType: 'users', entityId: req.userId, description: 'User changed their own password', ipAddress: req.ip, userAgent: req.get('user-agent') });
    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    return next(err);
  }
}

async function logout(req, res, next) {
  try {
    await recordSecurityEvent({ userId: req.userId, eventType: 'LOGOUT', ipAddress: req.ip, userAgent: req.get('user-agent') });
    return res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    return next(err);
  }
}

module.exports = { login, refresh, changePassword, logout };
