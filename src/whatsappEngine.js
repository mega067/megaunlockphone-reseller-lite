/**
 * WhatsApp Engine API & Queue Manager
 * Centralizes throttling delays, time synchronization, safe dispatch,
 * automatic retries, and clean API endpoints for WhatsApp messaging.
 */
const fs = require('fs');
const path = require('path');
const { readDB } = require('./db');

const QUEUE_FILE = path.join(__dirname, '..', 'queue.json');

// Configuration for engine throttling and safe delays
const ENGINE_CONFIG = {
  minDelayMs: 1200,
  maxDelayMs: 2000,
  maxRetries: 3,
  retryDelayMs: 3000,
  timeZone: 'America/Mexico_City',
  supportUrl: 'https://wa.me/522216936720'
};

/**
 * Returns formatted local timestamp in Mexico City timezone
 */
function getEngineTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: ENGINE_CONFIG.timeZone,
    dateStyle: 'medium',
    timeStyle: 'medium',
    hour12: true
  }).format(date);
}

/**
 * Enqueue message for user or direct phone
 */
function enqueueWhatsApp(type, message, userId = null, metadata = {}) {
  let queue = [];
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    }
  } catch (e) {
    queue = [];
  }

  const payload = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    type,
    message,
    userId,
    timestamp: new Date().toISOString(),
    displayTime: getEngineTimestamp(),
    retries: 0,
    ...metadata
  };

  queue.push(payload);
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
  return payload;
}

/**
 * Enqueue administrative broadcast or alert
 */
function enqueueWhatsAppAdmin(message) {
  require('dotenv').config();
  let queue = [];
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    }
  } catch (e) {
    queue = [];
  }

  const displayTime = getEngineTimestamp();

  if (process.env.ADMIN_PHONE) {
    let cleanPhone = String(process.env.ADMIN_PHONE).replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = '52' + cleanPhone;
    
    queue.push({
      id: 'admin_' + Date.now(),
      type: 'direct',
      phoneId: `${cleanPhone}@s.whatsapp.net`,
      message: `🔔 *[ADMIN ALERT - ${displayTime}]*\n\n${message}`,
      timestamp: new Date().toISOString(),
      displayTime,
      retries: 0
    });
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
    return;
  }

  const users = readDB('users.json') || [];
  const admins = users.filter(u => u.role === 'admin');
  admins.forEach(admin => {
    queue.push({
      id: 'admin_' + Date.now() + '_' + admin.id,
      type: 'private',
      message: `🔔 *[ADMIN ALERT - ${displayTime}]*\n\n${message}`,
      userId: admin.id,
      timestamp: new Date().toISOString(),
      displayTime,
      retries: 0
    });
  });

  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

/**
 * Safe delay helper
 */
function randomThrottleDelay(min = ENGINE_CONFIG.minDelayMs, max = ENGINE_CONFIG.maxDelayMs) {
  const ms = Math.floor(min + Math.random() * (max - min));
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  ENGINE_CONFIG,
  getEngineTimestamp,
  enqueueWhatsApp,
  enqueueWhatsAppAdmin,
  randomThrottleDelay
};
