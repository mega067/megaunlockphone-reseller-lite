/**
 * Gestor de Autenticación, Usuarios y Permisos Administrativos para Reseller Lite
 * 
 * - Creación del Primer Usuario Administrador (SuperAdmin / Propietario preferente).
 * - Alta de administradores secundarios y operadores con roles granulares.
 * - Registro y autenticación de clientes finales que compran en la web del reseller.
 */
const crypto = require('crypto');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../../data/reseller_database.sqlite');

class AuthManager {
  constructor() {
    this.initDatabase();
  }

  initDatabase() {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    this.db = new Database(DB_PATH);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ResellerUsers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL DEFAULT 'customer', -- 'superadmin', 'admin', 'operator', 'customer'
        isPrimaryAdmin INTEGER DEFAULT 0,      -- 1 para el dueño de la web (preferente/intocable)
        balance REAL DEFAULT 0.0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        lastLogin DATETIME
      );
    `);
  }

  hashPassword(password) {
    return crypto.createHash('sha256').update(String(password).trim()).digest('hex');
  }

  hasSuperAdmin() {
    const admin = this.db.prepare("SELECT id FROM ResellerUsers WHERE role = 'superadmin' OR isPrimaryAdmin = 1 LIMIT 1").get();
    return Boolean(admin);
  }

  createInitialSuperAdmin(username, password, email) {
    if (this.hasSuperAdmin()) {
      throw new Error('El Administrador Maestro ya ha sido configurado previamente.');
    }
    const hash = this.hashPassword(password);
    const stmt = this.db.prepare(`
      INSERT INTO ResellerUsers (username, passwordHash, email, role, isPrimaryAdmin)
      VALUES (?, ?, ?, 'superadmin', 1)
    `);
    const res = stmt.run(username.trim().toLowerCase(), hash, email || null);
    return { id: res.lastInsertRowid, username, role: 'superadmin', isPrimaryAdmin: true };
  }

  createSecondaryAdmin(requesterUser, newUsername, newPassword, newEmail, role = 'admin') {
    // Solo el superadmin puede dar de alta otros admins
    if (requesterUser.role !== 'superadmin' && !requesterUser.isPrimaryAdmin) {
      throw new Error('Solo el Administrador Principal (Dueño) tiene permisos para nombrar administradores secundarios.');
    }
    const hash = this.hashPassword(newPassword);
    const stmt = this.db.prepare(`
      INSERT INTO ResellerUsers (username, passwordHash, email, role, isPrimaryAdmin)
      VALUES (?, ?, ?, ?, 0)
    `);
    const res = stmt.run(newUsername.trim().toLowerCase(), hash, newEmail || null, role);
    return { id: res.lastInsertRowid, username: newUsername, role, isPrimaryAdmin: false };
  }

  registerCustomer(username, password, email) {
    const hash = this.hashPassword(password);
    const stmt = this.db.prepare(`
      INSERT INTO ResellerUsers (username, passwordHash, email, role, isPrimaryAdmin, balance)
      VALUES (?, ?, ?, 'customer', 0, 0.0)
    `);
    const res = stmt.run(username.trim().toLowerCase(), hash, email || null);
    return { id: res.lastInsertRowid, username, role: 'customer', balance: 0 };
  }

  login(username, password) {
    const hash = this.hashPassword(password);
    const user = this.db.prepare("SELECT * FROM ResellerUsers WHERE username = ? AND passwordHash = ?").get(
      username.trim().toLowerCase(), hash
    );
    if (!user) {
      throw new Error('Credenciales incorrectas');
    }
    this.db.prepare("UPDATE ResellerUsers SET lastLogin = CURRENT_TIMESTAMP WHERE id = ?").run(user.id);
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isPrimaryAdmin: Boolean(user.isPrimaryAdmin),
      balance: user.balance
    };
  }

  getAllUsers(requesterUser) {
    if (requesterUser.role !== 'superadmin' && requesterUser.role !== 'admin') {
      throw new Error('Acceso no autorizado.');
    }
    return this.db.prepare("SELECT id, username, email, role, isPrimaryAdmin, balance, createdAt, lastLogin FROM ResellerUsers ORDER BY id ASC").all();
  }

  adjustCustomerBalance(adminUser, targetUserId, deltaAmount) {
    if (adminUser.role !== 'superadmin' && adminUser.role !== 'admin') {
      throw new Error('Permisos insuficientes para modificar saldo.');
    }
    const stmt = this.db.prepare("UPDATE ResellerUsers SET balance = balance + ? WHERE id = ?");
    return stmt.run(parseFloat(deltaAmount), targetUserId);
  }
}

module.exports = new AuthManager();
