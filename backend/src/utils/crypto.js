'use strict';

const crypto = require('crypto');
const env = require('../config/env');

const ALGORITHM = 'aes-256-cbc';

function getKey() {
  const key = Buffer.from(env.dataEncryptionKey, 'utf8');
  if (key.length !== 32) {
    return crypto.createHash('sha256').update(env.dataEncryptionKey).digest();
  }
  return key;
}

function encrypt(text) {
  if (text === null || text === undefined) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(String(text), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(payload) {
  if (payload === null || payload === undefined) return payload;
  const parts = String(payload).split(':');
  if (parts.length !== 2) return payload;
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function encryptObjectFields(obj, fields) {
  const copy = { ...obj };
  for (const field of fields) {
    if (copy[field] !== undefined && copy[field] !== null) {
      copy[field] = encrypt(copy[field]);
    }
  }
  return copy;
}

function decryptObjectFields(obj, fields) {
  const copy = { ...obj };
  for (const field of fields) {
    if (copy[field] !== undefined && copy[field] !== null) {
      try {
        copy[field] = decrypt(copy[field]);
      } catch {
        // leave as-is if not decryptable
      }
    }
  }
  return copy;
}

module.exports = { encrypt, decrypt, encryptObjectFields, decryptObjectFields };
