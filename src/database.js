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

        CREATE TABLE IF NOT EXISTS ApiKeys (
            keyHash TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            name TEXT DEFAULT 'API Access Key',
            prefix TEXT NOT NULL,
            createdAt TEXT,
            lastUsedAt TEXT,
            isActive INTEGER DEFAULT 1,
            data TEXT
        );

        CREATE TABLE IF NOT EXISTS FinanceLedger (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL, /* 'income_ticket', 'income_manual', 'expense_manual', 'adjustment', 'transfer' */
            orderId TEXT,
            serviceName TEXT,
            chargedAmount REAL DEFAULT 0,
            costAmount REAL DEFAULT 0,
            grossProfit REAL DEFAULT 0,
            reinvestPercent REAL DEFAULT 50,
            reinvestAmount REAL DEFAULT 0,
            netProfit REAL DEFAULT 0,
            account TEXT DEFAULT 'General', /* Cuenta origen o cuenta receptora */
            destAccount TEXT, /* En transferencias entre cuentas */
            category TEXT DEFAULT 'servicios', /* 'servicios', 'comida', 'transporte', 'servidores', 'gustos', 'emergencia', 'inversion', 'otros' */
            notes TEXT,
            recordedBy TEXT,
            createdAt TEXT
        );

        CREATE TABLE IF NOT EXISTS FinanceAccounts (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            type TEXT DEFAULT 'bank', /* 'bank', 'card', 'cash', 'investment', 'emergency' */
            currency TEXT DEFAULT 'MXN',
            initialBalance REAL DEFAULT 0,
            currentBalance REAL DEFAULT 0,
            color TEXT DEFAULT '#38bdf8',
            icon TEXT DEFAULT 'wallet',
            description TEXT,
            isArchived INTEGER DEFAULT 0,
            createdAt TEXT,
            updatedAt TEXT
        );

        CREATE TABLE IF NOT EXISTS FinanceWeeklyAudits (
            id TEXT PRIMARY KEY,
            weekStart TEXT NOT NULL,
            weekEnd TEXT NOT NULL,
            totalIncome REAL DEFAULT 0,
            totalExpenses REAL DEFAULT 0,
            netSavings REAL DEFAULT 0,
            accountsSnapshot TEXT, /* JSON con los balances de cada cuenta al cerrar la semana */
            notes TEXT,
            verifiedBy TEXT DEFAULT 'Admin',
            createdAt TEXT
        );

        /* Control de Deudores (Me deben / Cuentas por cobrar) y Acreedores (Yo debo / Cuentas por pagar) */
        CREATE TABLE IF NOT EXISTS FinanceDebts (
            id TEXT PRIMARY KEY,
            personName TEXT NOT NULL,
            type TEXT NOT NULL, /* 'receivable' (me deben dinero) | 'payable' (yo le debo dinero) */
            totalAmount REAL DEFAULT 0,
            paidAmount REAL DEFAULT 0,
            remainingAmount REAL DEFAULT 0,
            concept TEXT,
            dueDate TEXT,
            phone TEXT,
            notes TEXT,
            status TEXT DEFAULT 'pending', /* 'pending' (pendiente) | 'partial' (abono parcial) | 'settled' (liquidada al 100%) */
            createdAt TEXT,
            updatedAt TEXT
        );

        /* Planes de Pago a Meses / Cuotas / Meses Sin Intereses (Nu, Bancos, etc.) */
        CREATE TABLE IF NOT EXISTS FinanceInstallments (
            id TEXT PRIMARY KEY,
            accountId TEXT NOT NULL, /* ID de la cuenta, e.g. acc_nu */
            accountName TEXT, /* Nombre de la cuenta, e.g. Nu Crédito */
            title TEXT NOT NULL, /* e.g. Disposición de saldo Cuenta Nu */
            totalAmount REAL NOT NULL DEFAULT 0, /* e.g. 383.56 */
            totalQuotas INTEGER NOT NULL DEFAULT 1, /* e.g. 6 */
            paidQuotas INTEGER NOT NULL DEFAULT 0, /* e.g. 0 */
            quotaAmount REAL NOT NULL DEFAULT 0, /* e.g. 63.93 */
            dueDay INTEGER DEFAULT 13, /* día de corte o pago del mes, e.g. 13 */
            interestRate REAL DEFAULT 0, /* Tasa de interés si aplica */
            referenceNumber TEXT, /* e.g. 6add1679-892a-4830-8bf9-793cd1f6112b */
            status TEXT DEFAULT 'active', /* 'active' | 'completed' */
            startDate TEXT, /* Fecha de inicio, e.g. 2026-10-15 */
            notes TEXT,
            createdAt TEXT,
            updatedAt TEXT
        );

        /* Control y Previsión de Recargas Telefónicas / Planes Móviles */
        CREATE TABLE IF NOT EXISTS FinanceMobilePlans (
            id TEXT PRIMARY KEY,
            phoneNumber TEXT, /* Número o línea, ej: 52221xxxxxxx */
            carrier TEXT NOT NULL, /* Telcel, AT&T, Movistar, Bait, CFE TEIT, etc. */
            planName TEXT, /* Paquete Amigo Sin Límite 200, Paquete 100, etc. */
            amount REAL NOT NULL DEFAULT 0, /* Costo de la recarga */
            durationDays INTEGER NOT NULL DEFAULT 30, /* Días de vigencia del paquete (ej: 15, 26, 30) */
            lastRechargeDate TEXT, /* Última fecha que se recargó YYYY-MM-DD */
            nextRenewalDate TEXT, /* Fecha calculada de vencimiento */
            preferredAccount TEXT DEFAULT 'acc_cash', /* Cuenta con la que se paga habitualmente */
            autoRemind INTEGER DEFAULT 1, /* Alerta de renovación */
            notes TEXT,
            status TEXT DEFAULT 'active', /* 'active' | 'paused' */
            createdAt TEXT,
            updatedAt TEXT
        );

        /* Historial de Inversiones: Snapshots periódicos, aportaciones, retiros y plusvalía / minusvalía */
        CREATE TABLE IF NOT EXISTS FinanceInvestmentLogs (
            id TEXT PRIMARY KEY,
            accountId TEXT NOT NULL, /* ID de la cuenta, ej: acc_investment */
            accountName TEXT, /* Nombre de la cuenta, ej: Revolut Cuenta Inversión */
            date TEXT NOT NULL, /* Fecha del corte o valuación YYYY-MM-DD */
            investedCapital REAL NOT NULL DEFAULT 0, /* Capital neto aportado acumulado */
            currentValue REAL NOT NULL DEFAULT 0, /* Valor o balance real actual del portafolio */
            netReturn REAL DEFAULT 0, /* Plusvalía (+) o Minusvalía (-) en monto monetario */
            returnPercentage REAL DEFAULT 0, /* Rendimiento porcentual % */
            injectedAmount REAL DEFAULT 0, /* Nueva inyección o aporte registrado en esta fecha */
            withdrawnAmount REAL DEFAULT 0, /* Retiro registrado en esta fecha si aplica */
            platform TEXT, /* e.g. Revolut, CetesDirecto, GBM, Nu, etc. */
            notes TEXT, /* Notas u observaciones */
            createdAt TEXT,
            updatedAt TEXT
        );
        /* Registro idempotente de transacciones bancarias SPEI validadas (Anti-Race condition y Duplicados) */
        CREATE TABLE IF NOT EXISTS BankTransactions (
            trackingNumber TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            username TEXT,
            amount REAL NOT NULL,
            bankCode TEXT,
            senderBankName TEXT,
            receiverBankName TEXT,
            serverId TEXT,
            status TEXT DEFAULT 'completed',
            createdAt TEXT
        );
    `);

    try {
        db.exec('ALTER TABLE FinanceLedger ADD COLUMN destAccount TEXT');
    } catch (e) {}

    try {
        db.exec('ALTER TABLE FinanceLedger ADD COLUMN category TEXT DEFAULT "servicios"');
    } catch (e) {}

    // Campos extendidos para Tarjetas de Crédito y Financiamiento
    try {
        db.exec('ALTER TABLE FinanceAccounts ADD COLUMN creditLimit REAL DEFAULT 0');
    } catch (e) {}
    try {
        db.exec('ALTER TABLE FinanceAccounts ADD COLUMN cutoffDay INTEGER DEFAULT 0');
    } catch (e) {}
    try {
        db.exec('ALTER TABLE FinanceAccounts ADD COLUMN paymentDueDay INTEGER DEFAULT 0');
    } catch (e) {}
    try {
        db.exec('ALTER TABLE FinanceAccounts ADD COLUMN currentDebt REAL DEFAULT 0');
    } catch (e) {}
    try {
        db.exec('ALTER TABLE FinanceAccounts ADD COLUMN minPayment REAL DEFAULT 0');
    } catch (e) {}
    
    try {
        db.exec('ALTER TABLE Users ADD COLUMN apiKey TEXT');
    } catch (e) {
        // Ignorar si la columna ya existe
    }

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
