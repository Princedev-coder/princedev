'use strict';

const pool = require('../config/db');
const notificationService = require('../services/notificationService');

async function listNotifications(req, res, next) {
  try {
    const { is_read, page = 1, limit = 20 } = req.query;
    const conditions = ['user_id = ?'];
    const params = [req.userId];
    if (is_read !== undefined) {
      conditions.push('is_read = ?');
      params.push(parseInt(is_read, 10));
    }
    const where = conditions.join(' AND ');
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM notifications WHERE ${where}`, params);
    const [rows] = await pool.query(
      `SELECT * FROM notifications WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), offset]
    );
    const [unreadRows] = await pool.query('SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0', [req.userId]);
    return res.json({ success: true, data: rows, meta: { total, page: parseInt(page, 10), limit: parseInt(limit, 10), unread: unreadRows[0].unread } });
  } catch (err) {
    return next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const data = await notificationService.markAsRead(req.params.id, req.userId);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function markAllRead(req, res, next) {
  try {
    await pool.query('UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0', [req.userId]);
    return res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listNotifications, markRead, markAllRead };
