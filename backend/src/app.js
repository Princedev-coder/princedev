'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const adminRoutes = require('./routes/admin.routes');
const patientsRoutes = require('./routes/patients.routes');
const staffRoutes = require('./routes/staff.routes');
const devicesRoutes = require('./routes/devices.routes');
const vitalsRoutes = require('./routes/vitals.routes');
const alertsRoutes = require('./routes/alerts.routes');
const thresholdsRoutes = require('./routes/thresholds.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const predictionsRoutes = require('./routes/predictions.routes');
const recordsRoutes = require('./routes/records.routes');
const miscRoutes = require('./routes/misc.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

const limiter = rateLimit({
  windowMs: env.security.rateLimitWindowMs,
  max: env.security.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
});
app.use('/api', limiter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() } });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/sensors', devicesRoutes);
app.use('/api/vitals', vitalsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/thresholds', thresholdsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/predictions', predictionsRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api', miscRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
