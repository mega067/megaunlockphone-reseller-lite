const fs = require('fs');
const path = require('path');
const db = require('./src/database');

const DATA_DIR = path.join(__dirname, 'data');

const readJSON = (filename) => {
    try {
        const filePath = path.join(DATA_DIR, filename);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {
        console.error(`Error reading ${filename}:`, e.message);
    }
    return null;
};

const migrate = () => {
    console.log('Iniciando migración a SQLite...');

    // 1. Migrar Configuración de WhatsApp
    const wSettings = readJSON('whatsapp_settings.json');
    if (wSettings) {
        const stmt = db.prepare(`INSERT OR REPLACE INTO AppConfig (key, value) VALUES (?, ?)`);
        for (const [key, value] of Object.entries(wSettings)) {
            stmt.run(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
        }
        console.log('✅ AppConfig (whatsapp_settings) migradas.');
    }

    // 2. Migrar Usuarios
    const users = readJSON('users.json');
    if (users && Array.isArray(users)) {
        const stmt = db.prepare(`INSERT OR REPLACE INTO Users (id, username, password, role, credit, phone, createdAt, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        users.forEach(u => {
            stmt.run(
                String(u.id), 
                u.username, 
                u.password, 
                u.role, 
                u.credit || 0, 
                u.phone || null, 
                u.createdAt || null, 
                JSON.stringify(u)
            );
        });
        console.log(`✅ ${users.length} usuarios migrados.`);
    }

    // 3. Migrar Enlaces de WhatsApp
    const wUsers = readJSON('whatsapp_users.json');
    if (wUsers) {
        const stmt = db.prepare(`INSERT OR IGNORE INTO WhatsAppLinks (phone, userId, linkedAt) VALUES (?, ?, ?)`);
        let count = 0;
        for (const [phone, userId] of Object.entries(wUsers)) {
            stmt.run(phone, userId, new Date().toISOString());
            count++;
        }
        console.log(`✅ ${count} enlaces de WhatsApp migrados.`);
    }

    // 4. Migrar Historial de Órdenes
    const history = readJSON('history.json');
    if (history && Array.isArray(history)) {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO OrdersHistory 
            (orderId, userId, serverId, serviceId, serviceName, imei, quantity, price, status, statusText, date, data) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        let count = 0;
        history.forEach(o => {
            const statusText = typeof o.statusText === 'string' ? o.statusText : (o.status || 'N/A');
            try {
                stmt.run(
                    String(o.orderId), 
                    String(o.userId), 
                    o.serverId ? String(o.serverId) : null, 
                    o.serviceId ? String(o.serviceId) : null, 
                    o.serviceName || 'Desconocido', 
                    o.imei || null, 
                    o.quantity || 1, 
                    o.price || 0, 
                    o.status || 'pending', 
                    statusText, 
                    o.date || null,
                    JSON.stringify(o)
                );
                count++;
            } catch (err) {
                console.error(`Error migrando orden ${o.orderId}:`, err.message);
            }
        });
        console.log(`✅ ${count} órdenes en el historial migradas.`);
    }

    console.log('🚀 ¡Migración completada exitosamente!');
};

migrate();
