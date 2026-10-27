/**
 * Módulo de Recargas & Billetera Local para Clientes del Reseller
 * 
 * Permite que los clientes del Reseller:
 * 1. Soliciten recargar saldo vía SPEI o Transferencia a las cuentas bancarias del Reseller.
 * 2. Comprueben transferencias o suban comprobante.
 * 3. Acreditación automática o con revisión manual.
 * 4. Gestión de saldos independientes en SQLite.
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '../../../data/reseller_database.sqlite');
const SETTINGS_PATH = path.join(__dirname, '../../../data/payment_settings.json');

class PaymentRechargeModule {
  constructor() {
    this.initDatabase();
    this.ensureSettings();
  }

  initDatabase() {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    this.db = new Database(DB_PATH);
    // Tabla de transacciones de recargas de clientes
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS CustomerRecharges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customerId TEXT NOT NULL,
        customerName TEXT NOT NULL,
        amount REAL NOT NULL,
        paymentMethod TEXT NOT NULL,
        trackingKey TEXT UNIQUE,
        receiptProof TEXT,
        status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
        approvedBy TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ResellerBankAccounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bankName TEXT NOT NULL,
        clabe TEXT NOT NULL,
        beneficiary TEXT NOT NULL,
        isActive INTEGER DEFAULT 1,
        minAmount REAL DEFAULT 50.0
      );
    `);
  }

  ensureSettings() {
    if (!fs.existsSync(SETTINGS_PATH)) {
      const defaultSettings = {
        enabled: true,
        autoApprove: false, // Requiere aprobación del admin del reseller
        currency: 'MXN',
        instructions: 'Realiza tu transferencia SPEI a nuestra cuenta y captura tu clave de rastreo de 18-30 dígitos para abonar saldo al instante.',
        adminNotificationPhone: ''
      };
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(defaultSettings, null, 2), 'utf8');
    }
  }

  getSettings() {
    try {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    } catch (e) {
      return { enabled: true, autoApprove: false, currency: 'MXN' };
    }
  }

  updateSettings(newSettings) {
    const current = this.getSettings();
    const updated = { ...current, ...newSettings };
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  }

  getBankAccounts() {
    return this.db.prepare('SELECT * FROM ResellerBankAccounts WHERE isActive = 1').all();
  }

  addBankAccount(bankName, clabe, beneficiary, minAmount = 50) {
    const stmt = this.db.prepare(`
      INSERT INTO ResellerBankAccounts (bankName, clabe, beneficiary, minAmount)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(bankName, clabe, beneficiary, minAmount);
  }

  requestRecharge(customerId, customerName, amount, trackingKey, receiptProof) {
    const stmt = this.db.prepare(`
      INSERT INTO CustomerRecharges (customerId, customerName, amount, paymentMethod, trackingKey, receiptProof, status)
      VALUES (?, ?, ?, 'SPEI', ?, ?, 'pending')
    `);
    const result = stmt.run(customerId, customerName, parseFloat(amount), trackingKey, receiptProof || null);
    return {
      rechargeId: result.lastInsertRowid,
      status: 'pending',
      amount: parseFloat(amount)
    };
  }

  getPendingRecharges() {
    return this.db.prepare('SELECT * FROM CustomerRecharges ORDER BY id DESC LIMIT 50').all();
  }

  approveRecharge(rechargeId, adminUsername) {
    const stmt = this.db.prepare(`
      UPDATE CustomerRecharges 
      SET status = 'approved', approvedBy = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'
    `);
    return stmt.run(adminUsername, rechargeId);
  }

  rejectRecharge(rechargeId, adminUsername) {
    const stmt = this.db.prepare(`
      UPDATE CustomerRecharges 
      SET status = 'rejected', approvedBy = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'
    `);
    return stmt.run(adminUsername, rechargeId);
  }
}

module.exports = new PaymentRechargeModule();
