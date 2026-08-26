'use strict';

const mysql = require('mysql2/promise');
const env = require('./env');

const poolConfig = {
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  connectionLimit: env.db.connectionLimit,
  waitForConnections: true,
  queueLimit: 0,
  dateStrings: false,
  supportBigNumbers: true,
  multipleStatements: true,
  connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '5000', 10),
};

if (env.db.ssl) {
  poolConfig.ssl = env.db.ssl;
}

const pool = mysql.createPool(poolConfig);

module.exports = pool;
