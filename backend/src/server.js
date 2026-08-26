'use strict';

const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const env = require('./config/env');
const realtime = require('./services/realtimeService');
const { verifyToken } = require('./utils/jwt');
const logger = require('./utils/logger');
const { importSchema } = require('./db/importSchema');
const { seed } = require('./db/seed');
const pool = require('./config/db');

async function ensureDatabaseReady() {
  try {
    const [rows] = await pool.query("SHOW TABLES LIKE 'users'");
    if (rows.length > 0) return;

    logger.info('[db] Tables missing - importing schema automatically...');
    await importSchema();
    logger.info('[db] Seeding demo data automatically...');
    await seed();
    logger.info('[db] Database ready.');
  } catch (err) {
    logger.error('[db] Auto-setup failed', { message: err.message });
    logger.error('[db] Fix the database and restart, or run: npm run db:setup && npm run db:seed');
  }
}

let server;
let io;

ensureDatabaseReady()
  .catch((err) => logger.error('[db] Bootstrap error', { message: err.message }))
  .finally(() => {
    server = http.createServer(app);

    io = new Server(server, {
      cors: {
        origin: true,
        credentials: true,
      },
    });

    io.use((socket, next) => {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));
      try {
        const payload = verifyToken(token);
        socket.user = { id: payload.sub, role: payload.role };
        return next();
      } catch (err) {
        return next(new Error('Invalid token'));
      }
    });

    io.on('connection', (socket) => {
      const { id, role } = socket.user;
      socket.join(`user:${id}`);
      socket.join(`role:${role}`);
      socket.join('monitoring');
      if (socket.handshake.auth && socket.handshake.auth.hospitalId) {
        socket.join(`hospital:${socket.handshake.auth.hospitalId}`);
      }
      logger.info(`[socket] client connected user=${id} role=${role} socket=${socket.id}`);
      socket.emit('connected', { message: 'Connected to realtime monitoring feed' });

      socket.on('monitor:patient', (patientId) => {
        if (patientId) socket.join(`patient:${patientId}`);
      });

      socket.on('monitor:stop', (patientId) => {
        if (patientId) socket.leave(`patient:${patientId}`);
      });

      socket.on('disconnect', () => {
        logger.info(`[socket] client disconnected socket=${socket.id}`);
      });
    });

    realtime.init(io);

    server.listen(env.port, () => {
      logger.info(`Healthcare platform API listening on http://localhost:${env.port}`);
      logger.info(`Socket.IO realtime feed on ws://localhost:${env.port}`);
    });
  });

module.exports = { get server() { return server; }, get io() { return io; } };
