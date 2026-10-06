const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.sqlite');
const db = new Database(dbPath);

// Activar WAL (Write-Ahead Logging) para mejor rendimiento concurrente
// db.pragma('journal_mode = WAL'); // DISABED DUE TO NFS ISSUES

// Inicializar tablas si no existen
const initTables = () => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS Users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'reseller',
            credit REAL DEFAULT 0,
            phone TEXT,
            createdAt TEXT,
            data TEXT
        );
        CREATE TABLE IF NOT EXISTS OrdersHistory (
            orderId TEXT PRIMARY KEY,
            userId TEXT,
            serverId TEXT,
            serviceId TEXT,
            serviceName TEXT,
            imei TEXT,
            quantity INTEGER DEFAULT 1,
            price REAL DEFAULT 0,
            status TEXT DEFAULT 'pending',
            statusText TEXT,
            date TEXT,
            data TEXT
        );

        CREATE TABLE IF NOT EXISTS WhatsAppLinks (
            phone TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            linkedAt TEXT
        );

        CREATE TABLE IF NOT EXISTS AppConfig (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    `);
    
    try {
        db.exec('ALTER TABLE Users ADD COLUMN data TEXT');
    } catch (e) {
        // Ignorar si la columna ya existe
    }

    try {
        db.exec('ALTER TABLE OrdersHistory ADD COLUMN data TEXT');
    } catch (e) {
        // Ignorar si la columna ya existe
    }
};

initTables();

module.exports = db;
