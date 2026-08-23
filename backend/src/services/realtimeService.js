'use strict';

let io = null;

function init(ioInstance) {
  io = ioInstance;
}

function emitToUser(userId, event, data) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

function emitToRole(role, event, data) {
  if (!io) return;
  io.to(`role:${role}`).emit(event, data);
}

function emitToHospital(hospitalId, event, data) {
  if (!io) return;
  io.to(`hospital:${hospitalId}`).emit(event, data);
}

function emitPatientVital(patientId, data) {
  if (!io) return;
  io.to(`patient:${patientId}`).emit('vital:reading', data);
  io.to('monitoring').emit('vital:reading', { patient_id: patientId, ...data });
}

function emitAlert(alert) {
  if (!io) return;
  io.to('monitoring').emit('alert:new', alert);
  io.to(`patient:${alert.patient_id}`).emit('alert:new', alert);
}

function emitAlertUpdate(alertId, data) {
  if (!io) return;
  io.to('monitoring').emit('alert:update', { id: alertId, ...data });
}

function emitPrediction(patientId, prediction) {
  if (!io) return;
  io.to('monitoring').emit('prediction:new', prediction);
  io.to(`patient:${patientId}`).emit('prediction:new', prediction);
}

function emitNotification(userId, notification) {
  emitToUser(userId, 'notification:new', notification);
}

module.exports = {
  init,
  emitToUser,
  emitToRole,
  emitToHospital,
  emitPatientVital,
  emitAlert,
  emitAlertUpdate,
  emitPrediction,
  emitNotification,
};
