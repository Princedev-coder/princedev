'use strict';

require('dotenv').config();

function parseDatabaseUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '3306', 10),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ''),
    };
  } catch {
    return null;
  }
}

const urlConfig = parseDatabaseUrl(process.env.DATABASE_URL);

const dbHost = (urlConfig && urlConfig.host) || process.env.DB_HOST || '';
const dbUser = (urlConfig && urlConfig.user) || process.env.DB_USER || '';
const dbPassword = (urlConfig && urlConfig.password) || process.env.DB_PASSWORD || '';
const dbName = (urlConfig && urlConfig.database) || process.env.DB_NAME || 'healthcare_platform';

const nodeEnv = process.env.NODE_ENV || 'development';
if (nodeEnv === 'production' && !dbHost) {
  console.error('[env] CRITICAL: No DB_HOST or DATABASE_URL set. The app will fail to connect to any database.');
}

const sslDefault = nodeEnv === 'production';
const sslEnabled = process.env.DB_SSL === 'false' ? false : (process.env.DB_SSL === 'true' ? true : sslDefault);

const env = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',

  jwtSecret: process.env.JWT_SECRET || 'insecure-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  db: {
    host: dbHost || '127.0.0.1',
    port: (urlConfig && urlConfig.port) || parseInt(process.env.DB_PORT || '3306', 10),
    user: dbUser || 'root',
    password: dbPassword,
    database: dbName,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    ssl: sslEnabled ? { rejectUnauthorized: true } : undefined,
  },

  dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef',

  security: {
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
    loginLockoutMinutes: parseInt(process.env.LOGIN_LOCKOUT_MINUTES || '15', 10),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
  },

  sensorApiKey: process.env.SENSOR_API_KEY || 'dev-sensor-key-123',

  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@healthcare.local',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin123!',
  },
};

module.exports = env;
