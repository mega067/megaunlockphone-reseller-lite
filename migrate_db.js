const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

const dbPath = __dirname + '/data/database.db';
const usersJsonPath = __dirname + '/data/users.json';

const db = new Database(dbPath);

console.log('Creando esquema de la base de datos...');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'reseller',
  createdAt TEXT NOT NULL,
  credits REAL DEFAULT 0,
  credits_1 REAL DEFAULT 0,
  credits_2 REAL DEFAULT 0,
  credits_3 REAL DEFAULT 0,
  markup REAL DEFAULT 0,
  totpSecret TEXT,
  totpEnabled INTEGER DEFAULT 0,
  recoveryCode TEXT,
  recoveryCodeExpires INTEGER
);
`);

if (!fs.existsSync(usersJsonPath)) {
  console.log('No users.json found, skipping migration.');
  process.exit(0);
}

const users = JSON.parse(fs.readFileSync(usersJsonPath, 'utf8'));
console.log(`Encontrados ${users.length} usuarios en users.json. Migrando...`);

const insertUser = db.prepare(`
  INSERT INTO users (id, username, email, password, role, createdAt, credits, credits_1, credits_2, credits_3, markup)
  VALUES (@id, @username, @email, @password, @role, @createdAt, @credits, @credits_1, @credits_2, @credits_3, @markup)
`);

const checkUser = db.prepare('SELECT id FROM users WHERE username = ?');

let migrated = 0;
let skipped = 0;

db.transaction(() => {
  for (const user of users) {
    const existing = checkUser.get(user.username);
    if (existing) {
      skipped++;
      continue;
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(user.password, salt);

    insertUser.run({
      id: String(user.id),
      username: user.username,
      email: null, // Los usuarios antiguos no tienen correo aún
      password: hashedPassword,
      role: user.role || 'reseller',
      createdAt: user.createdAt || new Date().toISOString(),
      credits: user.credits || 0,
      credits_1: user.credits_1 || 0,
      credits_2: user.credits_2 || 0,
      credits_3: user.credits_3 || 0,
      markup: user.markup || 0
    });
    migrated++;
  }
})();

console.log(`Migración completada. Nuevos usuarios migrados: ${migrated}. Usuarios omitidos (ya existían): ${skipped}.`);
