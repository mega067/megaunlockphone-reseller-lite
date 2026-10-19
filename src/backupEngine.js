const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR, readDB, writeDB } = require('./db');
const sqliteDb = require('./database');

const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const AUDIT_LOG_FILE = path.join(DATA_DIR, 'audit_blackbox.log');
const DAILY_DIR = path.join(BACKUPS_DIR, 'daily');
const INSTANT_DIR = path.join(BACKUPS_DIR, 'instant');

// Asegurar directorios requeridos
[BACKUPS_DIR, DAILY_DIR, INSTANT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * Lista maestra de archivos JSON críticos que contienen configuraciones,
 * reglas comerciales, precios, plantillas y estados.
 */
const CRITICAL_JSON_FILES = [
  'users.json',
  'settings.json',
  'history.json',
  'recharges.json',
  'custom_prices.json',
  'user_custom_prices.json',
  'custom_groups.json',
  'group_markups.json',
  'service_warnings.json',
  'warning_templates.json',
  'disabled_services.json',
  'disabled_imei.json',
  'allowed_free_services.json',
  'ticket_configs.json',
  'whatsapp_users.json',
  'whatsapp_settings.json',
  'coupons.json',
  'prices.json',
  'prices_1.json',
  'prices_2.json',
  'prices_3.json'
];

/**
 * 1. CAJA NEGRA INALTERABLE (Append-Only Cryptographic Audit Log)
 * Cada registro incluye timestamp ISO, razón/evento, autor, datos y un HMAC/Hash encadenado (Hash Chaining).
 */
let lastAuditHash = 'GENESIS_BLOCK_00000000000000000000000000000000000000000000000000000000';

// Recuperar último hash si el archivo de auditoría ya existe
try {
  if (fs.existsSync(AUDIT_LOG_FILE)) {
    const lines = fs.readFileSync(AUDIT_LOG_FILE, 'utf8').trim().split('\n').filter(Boolean);
    if (lines.length > 0) {
      const lastLine = JSON.parse(lines[lines.length - 1]);
      if (lastLine.entryHash) {
        lastAuditHash = lastLine.entryHash;
      }
    }
  }
} catch (e) {
  // Mantener hash génesis si está vacío o corrupto
}

function logAuditTrail(event, details = {}, author = 'SYSTEM') {
  try {
    const timestamp = new Date().toISOString();
    const payload = {
      timestamp,
      event,
      author,
      details,
      prevHash: lastAuditHash
    };

    const entryHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    payload.entryHash = entryHash;
    lastAuditHash = entryHash;

    const logLine = JSON.stringify(payload) + '\n';
    fs.appendFileSync(AUDIT_LOG_FILE, logLine, 'utf8');
  } catch (err) {
    console.error('[BlackBox Audit] Error writing audit log:', err.message);
  }
}

/**
 * Genera el paquete completo de respaldo con SQLite + JSONs + Metadatos
 */
function generateFullBackupSnapshot(reason = 'MANUAL') {
  const timestamp = new Date().toISOString();
  const snapshot = {
    metadata: {
      version: '2.0.0',
      reason,
      createdAt: timestamp,
      generator: 'MegaUnlockPhone Backup Engine',
      environment: process.env.NODE_ENV || 'production'
    },
    sqlite: {},
    files: {},
    checksums: {}
  };

  // 1. Extraer todas las tablas de SQLite
  try {
    const tablesStmt = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    const tables = tablesStmt.all().map(t => t.name);

    tables.forEach(tableName => {
      try {
        const rows = sqliteDb.prepare(`SELECT * FROM ${tableName}`).all();
        snapshot.sqlite[tableName] = rows;
      } catch (err) {
        snapshot.sqlite[tableName] = { error: err.message };
      }
    });
  } catch (err) {
    snapshot.sqlite._error = err.message;
  }

  // 2. Extraer archivos JSON
  CRITICAL_JSON_FILES.forEach(file => {
    try {
      const data = readDB(file);
      if (data !== null && data !== undefined) {
        snapshot.files[file] = data;
        const fileContent = JSON.stringify(data);
        snapshot.checksums[file] = crypto.createHash('sha256').update(fileContent).digest('hex');
      }
    } catch (err) {
      // Ignorar archivos que aún no han sido creados
    }
  });

  // Checksum global del snapshot
  const rawData = JSON.stringify(snapshot.files) + JSON.stringify(snapshot.sqlite);
  snapshot.metadata.snapshotHash = crypto.createHash('sha256').update(rawData).digest('hex');

  return snapshot;
}

/**
 * Crea un respaldo automático ante eventos de negocio (Cambio de saldo, nuevo pedido, edición de usuarios)
 */
function createAutoBackup(reason = 'AUTO_EVENT') {
  try {
    const safeReason = String(reason).replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `autobackup_${timestamp}_${safeReason}.json`;
    const filepath = path.join(INSTANT_DIR, filename);

    const snapshot = generateFullBackupSnapshot(reason);
    fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2), 'utf8');

    // Mantener los últimos 30 backups instantáneos para no saturar disco
    pruneOldBackups(INSTANT_DIR, 30);

    // Registrar en la caja negra inalterable
    logAuditTrail('AUTO_BACKUP_CREATED', {
      filename,
      reason,
      snapshotHash: snapshot.metadata.snapshotHash,
      usersCount: Array.isArray(snapshot.files['users.json']) ? snapshot.files['users.json'].length : 0
    });

    return { success: true, filename, filepath };
  } catch (err) {
    console.error('[Backup Engine] Error creating auto backup:', err.message);
    logAuditTrail('AUTO_BACKUP_FAILED', { error: err.message, reason });
    return { success: false, error: err.message };
  }
}

/**
 * Ejecuta el respaldo diario programado (cada 24 horas)
 * Guarda en data/backups/daily/ y conserva un historial rotativo de 30 días
 */
function createDailyBackup() {
  try {
    const dateStr = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `daily_backup_${dateStr}_${timestamp}.json`;
    const filepath = path.join(DAILY_DIR, filename);

    const snapshot = generateFullBackupSnapshot('DAILY_SCHEDULED_24H');
    fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2), 'utf8');

    // Mantener hasta 30 días de respaldos diarios
    pruneOldBackups(DAILY_DIR, 30);

    logAuditTrail('DAILY_BACKUP_COMPLETED', {
      filename,
      date: dateStr,
      snapshotHash: snapshot.metadata.snapshotHash
    });

    console.log(`[Backup Engine] Respaldo diario completado exitosamente: ${filename}`);

    // Disparar sincronización opcional con Google Drive en segundo plano
    try {
      const { syncBackupToGoogleDrive } = require('./gdriveSync');
      syncBackupToGoogleDrive(filepath).then(syncRes => {
        if (syncRes && syncRes.success) {
          console.log(`[Backup Engine] Respaldo diario sincronizado con Google Drive exitosamente.`);
        }
      }).catch(syncErr => {
        console.error(`[Backup Engine] Fallo en sincronización a Google Drive:`, syncErr.message);
      });
    } catch (e) {}

    return { success: true, filename, filepath };
  } catch (err) {
    console.error('[Backup Engine] Error en respaldo diario:', err.message);
    logAuditTrail('DAILY_BACKUP_FAILED', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Elimina archivos viejos manteniendo los N más recientes
 */
function pruneOldBackups(dirPath, keepCount = 30) {
  try {
    if (!fs.existsSync(dirPath)) return;
    const files = fs.readdirSync(dirPath)
      .filter(f => f.endsWith('.json'))
      .map(name => ({
        name,
        path: path.join(dirPath, name),
        time: fs.statSync(path.join(dirPath, name)).mtimeMs
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > keepCount) {
      const toDelete = files.slice(keepCount);
      toDelete.forEach(f => {
        try { fs.unlinkSync(f.path); } catch (e) {}
      });
    }
  } catch (e) {
    console.error('[Backup Engine] Prune error:', e.message);
  }
}

/**
 * Restaura completamente un respaldo (Soporta formato v2.0 completo o v1.0 plano)
 */
function restoreSnapshot(backupPayload, restoredBy = 'ADMIN') {
  if (!backupPayload || typeof backupPayload !== 'object') {
    throw new Error('Formato de respaldo inválido.');
  }

  const isV2 = Boolean(backupPayload.metadata && (backupPayload.files || backupPayload.sqlite));
  const filesToRestore = isV2 ? (backupPayload.files || {}) : backupPayload;

  // 1. Restaurar todos los archivos JSON interceptados / directos
  CRITICAL_JSON_FILES.forEach(file => {
    if (filesToRestore[file] !== undefined) {
      writeDB(file, filesToRestore[file]);
    }
  });

  // Soporte para respaldos legacy donde las claves no tenían '.json'
  ['users', 'history', 'prices', 'customPrices', 'userCustomPrices', 'settings', 'coupons'].forEach(key => {
    if (filesToRestore[key] !== undefined) {
      const mapping = {
        users: 'users.json',
        history: 'history.json',
        prices: 'prices.json',
        customPrices: 'custom_prices.json',
        userCustomPrices: 'user_custom_prices.json',
        settings: 'settings.json',
        coupons: 'coupons.json'
      };
      writeDB(mapping[key], filesToRestore[key]);
    }
  });

  // 2. Si contiene tablas SQLite dedicadas adicionales (v2.0)
  if (isV2 && backupPayload.sqlite) {
    try {
      if (Array.isArray(backupPayload.sqlite.WhatsAppLinks)) {
        const delStmt = sqliteDb.prepare('DELETE FROM WhatsAppLinks');
        const insStmt = sqliteDb.prepare('INSERT OR REPLACE INTO WhatsAppLinks (phone, userId, linkedAt) VALUES (?, ?, ?)');
        sqliteDb.transaction(() => {
          delStmt.run();
          backupPayload.sqlite.WhatsAppLinks.forEach(w => insStmt.run(w.phone, w.userId, w.linkedAt || new Date().toISOString()));
        })();
      }
      if (Array.isArray(backupPayload.sqlite.ApiKeys)) {
        const delStmt = sqliteDb.prepare('DELETE FROM ApiKeys');
        const insStmt = sqliteDb.prepare('INSERT OR REPLACE INTO ApiKeys (keyHash, userId, name, prefix, createdAt, lastUsedAt, isActive, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        sqliteDb.transaction(() => {
          delStmt.run();
          backupPayload.sqlite.ApiKeys.forEach(k => insStmt.run(k.keyHash, k.userId, k.name, k.prefix, k.createdAt, k.lastUsedAt, k.isActive, k.data));
        })();
      }
    } catch (err) {
      console.error('[Backup Engine] SQLite sub-tables restore notice:', err.message);
    }
  }

  // Registrar en caja negra inalterable
  logAuditTrail('SYSTEM_RESTORE_PERFORMED', {
    restoredBy,
    isV2,
    originalMetadata: backupPayload.metadata || null
  }, restoredBy);

  return { success: true, isV2 };
}

/**
 * Consulta de registros de auditoría de la caja negra
 */
function getAuditLogs(limit = 100) {
  try {
    if (!fs.existsSync(AUDIT_LOG_FILE)) return [];
    const lines = fs.readFileSync(AUDIT_LOG_FILE, 'utf8').trim().split('\n').filter(Boolean);
    const entries = lines.slice(-limit).map(l => {
      try { return JSON.parse(l); } catch (e) { return null; }
    }).filter(Boolean);
    return entries.reverse();
  } catch (err) {
    return [];
  }
}

/**
 * Lista todos los respaldos disponibles (tanto diarios como instantáneos)
 */
function listAllBackups() {
  const result = [];

  const scanDir = (dir, type) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    files.forEach(filename => {
      try {
        const stats = fs.statSync(path.join(dir, filename));
        result.push({
          filename,
          type,
          size: stats.size,
          date: stats.mtime,
          path: path.join(dir, filename)
        });
      } catch (e) {}
    });
  };

  scanDir(DAILY_DIR, 'daily');
  scanDir(INSTANT_DIR, 'instant');
  // Compatibilidad con respaldos viejos en BACKUPS_DIR raíz
  if (fs.existsSync(BACKUPS_DIR)) {
    fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.json') && f.startsWith('autobackup_')).forEach(filename => {
      try {
        const stats = fs.statSync(path.join(BACKUPS_DIR, filename));
        result.push({
          filename,
          type: 'legacy',
          size: stats.size,
          date: stats.mtime,
          path: path.join(BACKUPS_DIR, filename)
        });
      } catch (e) {}
    });
  }

  return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Timer que se encarga del respaldo automático cada 24 horas
 */
let dailyBackupTimer = null;
function initBackupScheduler() {
  // Ejecutar un respaldo diario al inicio si han pasado más de 24h del último
  const dailyFiles = listAllBackups().filter(b => b.type === 'daily');
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  if (dailyFiles.length === 0 || (now - new Date(dailyFiles[0].date).getTime() > ONE_DAY_MS)) {
    createDailyBackup();
  }

  // Intervalo regular cada 24 horas
  if (dailyBackupTimer) clearInterval(dailyBackupTimer);
  dailyBackupTimer = setInterval(() => {
    createDailyBackup();
  }, ONE_DAY_MS);
}

module.exports = {
  createAutoBackup,
  createDailyBackup,
  generateFullBackupSnapshot,
  restoreSnapshot,
  logAuditTrail,
  getAuditLogs,
  listAllBackups,
  initBackupScheduler,
  BACKUPS_DIR,
  DAILY_DIR,
  INSTANT_DIR,
  AUDIT_LOG_FILE
};
