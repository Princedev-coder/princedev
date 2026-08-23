'use strict';

const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
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
});

pool.getConnection()
  .then((conn) => {
    conn.release();
    console.log(`[db] Connected to MySQL at ${env.db.host}:${env.db.port}/${env.db.database}`);
  })
  .catch((err) => {
    console.error('[db] Connection failed:', err.message);
  });

module.exports = pool;
