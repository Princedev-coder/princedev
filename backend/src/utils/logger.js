'use strict';

function log(level, message, meta) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level.toUpperCase()}] ${message}`;
  if (meta !== undefined) {
    let extra;
    try {
      extra = typeof meta === 'string' ? meta : JSON.stringify(meta);
    } catch {
      extra = String(meta);
    }
    console.log(`${line} ${extra}`);
  } else {
    console.log(line);
  }
}

module.exports = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
  debug: (msg, meta) => {
    if (process.env.NODE_ENV !== 'production') log('debug', msg, meta);
  },
};
