'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../config/env');

const sqlFile = path.resolve(__dirname, '../../../healthcare_platform.sql');

async function importSchema() {
  if (!fs.existsSync(sqlFile)) {
    throw new Error(`Schema file not found: ${sqlFile}`);
  }

  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
  });

  try {
    const [vRows] = await conn.query('SELECT VERSION() AS v');
    console.log(`Connected. Server version: ${vRows[0].v}`);

    console.log(`Creating database "${env.db.database}" if it does not exist...`);
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.db.database}\` CHARACTER SET utf8 COLLATE utf8_unicode_ci`
    );
    await conn.query(`USE \`${env.db.database}\``);

    const sql = fs.readFileSync(sqlFile, 'utf8');
    console.log('Importing schema...');
    await conn.query(sql);
    console.log('Schema imported successfully.');
  } finally {
    await conn.end();
  }
}

async function run() {
  try {
    await importSchema();
  } catch (err) {
    console.error('Schema import failed:', err.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  run();
}

module.exports = { importSchema };
