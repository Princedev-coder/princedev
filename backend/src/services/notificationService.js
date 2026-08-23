'use strict';

const pool = require('../config/db');

async function createNotification({ userId, alertId = null, title, message, type = 'GENERAL', channel = 'DASHBOARD' }) {
  const [result] = await pool.query(
    `INSERT INTO notifications (user_id, alert_id, title, message, notification_type, channel, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [userId, alertId, title, message, type, channel]
  );
  return { id: result.insertId, userId, alertId, title, message, type, channel };
}

async function notifyUsersForPatient(patientId, { alertId = null, title, message, type = 'ALERT' }) {
  const userIds = new Set();

  const [admins] = await pool.query(
    `SELECT id FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'`
  );
  admins.forEach((a) => userIds.add(a.id));

  const [assigned] = await pool.query(
    `SELECT doctor_id AS uid FROM patient_assignments WHERE patient_id = ? AND status = 'ACTIVE' AND doctor_id IS NOT NULL
     UNION
     SELECT nurse_id AS uid FROM patient_assignments WHERE patient_id = ? AND status = 'ACTIVE' AND nurse_id IS NOT NULL`,
    [patientId, patientId]
  );
  assigned.forEach((r) => userIds.add(r.uid));

  const created = [];
  for (const userId of userIds) {
    const n = await createNotification({ userId, alertId, title, message, type, channel: 'DASHBOARD' });
    created.push(n);
  }
  return created;
}

async function markAsRead(notificationId, userId) {
  const [result] = await pool.query(
    `UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?`,
    [notificationId, userId]
  );
  if (result.affectedRows === 0) {
    const err = new Error('Notification not found or does not belong to user');
    err.statusCode = 404;
    throw err;
  }
  return { id: notificationId, is_read: 1 };
}

module.exports = { createNotification, notifyUsersForPatient, markAsRead };
