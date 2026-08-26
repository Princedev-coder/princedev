'use strict';

const app = require('../src/app');
const pool = require('../src/config/db');
const { importSchema } = require('../src/db/importSchema');
const { seed } = require('../src/db/seed');

let dbReady = null;

function ensureDb() {
  if (!dbReady) {
    dbReady = (async () => {
      try {
        const [rows] = await pool.query("SHOW TABLES LIKE 'users'");
        if (rows.length === 0) {
          console.log('[vercel] Tables missing – importing schema...');
          await importSchema();
          console.log('[vercel] Seeding demo data...');
          await seed();
          console.log('[vercel] Database ready.');
        } else {
          console.log('[vercel] Database tables exist.');
        }
      } catch (err) {
        console.error('[vercel] Auto-setup failed:', err.message);
        dbReady = null;
        throw err;
      }
    })();
  }
  return dbReady;
}

module.exports = async function handler(req, res) {
  try {
    await ensureDb();
  } catch (err) {
    console.error('[vercel] DB init error:', err.message);
    if (req.url === '/api/health') {
      return res.status(503).json({ success: false, message: 'Database unavailable: ' + err.message });
    }
  }
  return app(req, res);
};
