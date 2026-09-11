const fs = require('fs');
const path = require('path');
const sqliteDb = require('./database');

const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

let dbCache = {};

function readDB(file) {
  const baseFile = path.basename(file);

  // 1. Interceptar peticiones para Users
  if (baseFile === 'users.json') {
    const stmt = sqliteDb.prepare(`SELECT data FROM Users`);
    const rows = stmt.all();
    return rows.map(r => r.data ? JSON.parse(r.data) : null).filter(Boolean);
  }

  // 2. Interceptar peticiones para History
  if (baseFile === 'history.json') {
    const stmt = sqliteDb.prepare(`SELECT * FROM OrdersHistory ORDER BY date DESC`);
    const history = stmt.all();
    // Parsear booleanos y números para mantener compatibilidad con JSON
    return history.map(h => ({
      ...h,
      price: parseFloat(h.price),
      quantity: parseInt(h.quantity)
    }));
  }

  // 3. Interceptar AppConfig
  if (file === 'whatsapp_settings.json') {
    const stmt = sqliteDb.prepare(`SELECT key, value FROM AppConfig`);
    const rows = stmt.all();
    let config = {};
    rows.forEach(r => {
      try {
        config[r.key] = JSON.parse(r.value);
      } catch(e) {
        config[r.key] = r.value;
      }
    });
    return config;
  }

  // 4. Interceptar WhatsApp Links
  if (file === 'whatsapp_users.json') {
    const stmt = sqliteDb.prepare(`SELECT phone, userId FROM WhatsAppLinks`);
    const rows = stmt.all();
    let wUsers = {};
    rows.forEach(r => {
      wUsers[r.phone] = r.userId;
    });
    return wUsers;
  }

  // Si no es ninguna de las tablas migradas, leer el JSON normalmente (ej. precios cacheados)
  if (dbCache[baseFile] !== undefined) return dbCache[baseFile];
  const filepath = path.isAbsolute(file) ? file : path.join(DATA_DIR, file);
  if (!fs.existsSync(filepath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    dbCache[baseFile] = data;
    return data;
  } catch (e) {
    return null;
  }
}

function writeDB(file, data) {
  const baseFile = path.basename(file);

  // 1. Interceptar escritura para Users
  if (baseFile === 'users.json') {
    const stmt = sqliteDb.prepare(`INSERT OR REPLACE INTO Users (id, username, password, role, credit, phone, createdAt, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const deleteStmt = sqliteDb.prepare(`DELETE FROM Users`);
    const transaction = sqliteDb.transaction(() => {
      deleteStmt.run(); // Wipe and rewrite array to simulate JSON overwrite
      data.forEach(u => {
        stmt.run(String(u.id), u.username, u.password, u.role, u.credit || 0, u.phone || null, u.createdAt || null, JSON.stringify(u));
      });
    });
    transaction();
    return;
  }

  // 2. Interceptar escritura para History
  if (baseFile === 'history.json') {
    const stmt = sqliteDb.prepare(`
      INSERT OR REPLACE INTO OrdersHistory 
      (orderId, userId, serverId, serviceId, serviceName, imei, quantity, price, status, statusText, date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const deleteStmt = sqliteDb.prepare(`DELETE FROM OrdersHistory`);
    const transaction = sqliteDb.transaction(() => {
      deleteStmt.run();
      data.forEach(o => {
        const statusText = typeof o.statusText === 'string' ? o.statusText : (o.status || 'N/A');
        stmt.run(String(o.orderId), String(o.userId), o.serverId ? String(o.serverId) : null, o.serviceId ? String(o.serviceId) : null, o.serviceName || 'Desconocido', o.imei || null, o.quantity || 1, o.price || 0, o.status || 'pending', statusText, o.date || null);
      });
    });
    transaction();
    return;
  }

  // 3. Interceptar AppConfig
  if (baseFile === 'whatsapp_settings.json') {
    const stmt = sqliteDb.prepare(`INSERT OR REPLACE INTO AppConfig (key, value) VALUES (?, ?)`);
    const deleteStmt = sqliteDb.prepare(`DELETE FROM AppConfig`);
    const transaction = sqliteDb.transaction(() => {
      deleteStmt.run();
      for (const [key, value] of Object.entries(data)) {
        stmt.run(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
    });
    transaction();
    return;
  }

  // 4. Interceptar WhatsApp Links
  if (baseFile === 'whatsapp_users.json') {
    const stmt = sqliteDb.prepare(`INSERT OR REPLACE INTO WhatsAppLinks (phone, userId, linkedAt) VALUES (?, ?, ?)`);
    const deleteStmt = sqliteDb.prepare(`DELETE FROM WhatsAppLinks`);
    const transaction = sqliteDb.transaction(() => {
      deleteStmt.run();
      for (const [phone, userId] of Object.entries(data)) {
        stmt.run(phone, userId, new Date().toISOString());
      }
    });
    transaction();
    return;
  }

  // Si no es ninguna de las tablas migradas, escribir al JSON
  dbCache[baseFile] = data;
  const filepath = path.isAbsolute(file) ? file : path.join(DATA_DIR, file);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

module.exports = { readDB, writeDB, DATA_DIR };
