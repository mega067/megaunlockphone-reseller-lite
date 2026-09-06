import re

with open('server.js', 'r') as f:
    code = f.read()

# Add requires at the top
requires = """
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const otplib = require('otplib');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');
const Database = require('better-sqlite3');
const db = new Database(path.join(__dirname, 'data', 'database.db'));

const JWT_SECRET = 'SuperSecretMegaUnlockFastKey2026'; // Change in prod

// DB Helper functions
function getDbUsers() {
    return db.prepare('SELECT * FROM users').all();
}
function saveDbUsers(usersArray) {
    const stmt = db.prepare(`
        UPDATE users 
        SET username=@username, email=@email, password=@password, role=@role, 
            credits=@credits, credits_1=@credits_1, credits_2=@credits_2, credits_3=@credits_3, 
            markup=@markup, totpSecret=@totpSecret, totpEnabled=@totpEnabled, 
            recoveryCode=@recoveryCode, recoveryCodeExpires=@recoveryCodeExpires 
        WHERE id=@id
    `);
    const insert = db.prepare(`
        INSERT INTO users (id, username, email, password, role, createdAt, credits, credits_1, credits_2, credits_3, markup, totpSecret, totpEnabled)
        VALUES (@id, @username, @email, @password, @role, @createdAt, @credits, @credits_1, @credits_2, @credits_3, @markup, @totpSecret, @totpEnabled)
    `);
    
    db.transaction(() => {
        for (const u of usersArray) {
            const res = stmt.run({
                id: String(u.id),
                username: u.username,
                email: u.email || null,
                password: u.password,
                role: u.role || 'reseller',
                credits: u.credits || 0,
                credits_1: u.credits_1 || 0,
                credits_2: u.credits_2 || 0,
                credits_3: u.credits_3 || 0,
                markup: u.markup || 0,
                totpSecret: u.totpSecret || null,
                totpEnabled: u.totpEnabled ? 1 : 0,
                recoveryCode: u.recoveryCode || null,
                recoveryCodeExpires: u.recoveryCodeExpires || null
            });
            if (res.changes === 0) {
                // new user
                insert.run({
                    id: String(u.id),
                    username: u.username,
                    email: u.email || null,
                    password: u.password,
                    role: u.role || 'reseller',
                    createdAt: u.createdAt || new Date().toISOString(),
                    credits: u.credits || 0,
                    credits_1: u.credits_1 || 0,
                    credits_2: u.credits_2 || 0,
                    credits_3: u.credits_3 || 0,
                    markup: u.markup || 0,
                    totpSecret: u.totpSecret || null,
                    totpEnabled: u.totpEnabled ? 1 : 0
                });
            }
        }
    })();
}
"""

if "const bcrypt =" not in code:
    code = code.replace("const fs = require('fs');", "const fs = require('fs');\n" + requires)

# Override readDB and writeDB for users.json
readDB_override = """
function readDB(file) {
  if (file === 'users.json') return getDbUsers();
"""
code = code.replace("function readDB(file) {\n", readDB_override)

writeDB_override = """
function writeDB(file, data) {
  if (file === 'users.json') {
      saveDbUsers(data);
      return;
  }
"""
code = code.replace("function writeDB(file, data) {\n", writeDB_override)

# Rewrite requireAuth middleware
auth_middleware = """
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
  } catch(e) {
      return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
"""
code = re.sub(r"function requireAuth\(req, res, next\) \{.*?\}\n", auth_middleware + "\n", code, flags=re.DOTALL)

# Remove old login endpoint and add new auth endpoints
new_auth_endpoints = """
// Setup Nodemailer
const transporter = nodemailer.createTransport({
  host: "smtp.alwaysdata.com",
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: "soporte@megaunlockphone-panel.alwaysdata.net", 
    pass: "angel067L", 
  },
});

app.post('/api/login', (req, res) => {
  const { username, password, totpCode } = req.body;
  const users = getDbUsers();
  
  // Find user by username or email
  const user = users.find(u => (u.username && u.username.toLowerCase() === username.toLowerCase()) || (u.email && u.email.toLowerCase() === username.toLowerCase()));
  
  if (!user) {
    return res.status(401).json({ error: 'Usuario o contraseña inválidos' });
  }

  // Check bcrypt hash
  const validPass = bcrypt.compareSync(password, user.password);
  if (!validPass) {
    return res.status(401).json({ error: 'Usuario o contraseña inválidos' });
  }

  // Check TOTP if enabled
  if (user.totpEnabled) {
      if (!totpCode) {
          return res.status(403).json({ error: 'Se requiere código 2FA', require2FA: true });
      }
      const isValidTotp = otplib.authenticator.verify({ token: totpCode, secret: user.totpSecret });
      if (!isValidTotp) {
          return res.status(401).json({ error: 'Código 2FA inválido' });
      }
  }

  // Legacy user check for missing email
  if (!user.email) {
      return res.status(403).json({ error: 'Debes vincular un correo electrónico', requireEmail: true, tempId: user.id });
  }

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role, credits: user.credits }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, role: user.role, username: user.username, credits: user.credits, uid: user.id });
});

app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'Faltan datos' });
    
    let users = getDbUsers();
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase() || (u.email && u.email.toLowerCase() === email.toLowerCase()))) {
        return res.status(400).json({ error: 'Usuario o correo ya registrado' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);
    
    const newUser = {
        id: String(Date.now()),
        username,
        email,
        password: hashedPassword,
        role: 'reseller',
        createdAt: new Date().toISOString(),
        credits: 0, credits_1: 0, credits_2: 0, credits_3: 0, markup: 0
    };
    users.push(newUser);
    saveDbUsers(users);
    res.json({ success: true, message: 'Usuario registrado exitosamente' });
});

app.post('/api/link-email', (req, res) => {
    const { tempId, email, password } = req.body;
    let users = getDbUsers();
    const userIndex = users.findIndex(u => u.id == tempId);
    if (userIndex === -1) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    // verify password again
    if (!bcrypt.compareSync(password, users[userIndex].password)) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    if (users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase())) {
        return res.status(400).json({ error: 'Correo ya está en uso por otra cuenta' });
    }

    users[userIndex].email = email;
    saveDbUsers(users);
    res.json({ success: true, message: 'Correo vinculado exitosamente. Inicia sesión ahora.' });
});

// TOTP Endpoints
app.get('/api/2fa/generate', requireAuth, async (req, res) => {
    let users = getDbUsers();
    const userIndex = users.findIndex(u => u.id == req.user.id);
    if (userIndex === -1) return res.status(404).json({error: 'Usuario no encontrado'});

    const secret = otplib.authenticator.generateSecret();
    users[userIndex].totpSecret = secret;
    saveDbUsers(users);

    const otpauth = otplib.authenticator.keyuri(req.user.username, 'MegaUnlockPhone', secret);
    const qrImage = await QRCode.toDataURL(otpauth);
    res.json({ secret, qrImage });
});

app.post('/api/2fa/enable', requireAuth, (req, res) => {
    const { token } = req.body;
    let users = getDbUsers();
    const userIndex = users.findIndex(u => u.id == req.user.id);
    if (userIndex === -1) return res.status(404).json({error: 'Usuario no encontrado'});

    const isValid = otplib.authenticator.verify({ token, secret: users[userIndex].totpSecret });
    if (isValid) {
        users[userIndex].totpEnabled = 1;
        saveDbUsers(users);
        res.json({ success: true, message: '2FA activado' });
    } else {
        res.status(400).json({ error: 'Código 2FA inválido' });
    }
});

// Password Recovery
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    let users = getDbUsers();
    const userIndex = users.findIndex(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    
    if (userIndex !== -1) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        users[userIndex].recoveryCode = code;
        users[userIndex].recoveryCodeExpires = Date.now() + 15 * 60 * 1000; // 15 mins
        saveDbUsers(users);
        
        try {
            await transporter.sendMail({
                from: '"Soporte MegaUnlockPhone" <soporte@megaunlockphone-panel.alwaysdata.net>',
                to: email,
                subject: "Código de recuperación de contraseña",
                text: `Tu código de recuperación es: ${code}\\nEste código expirará en 15 minutos.`,
            });
        } catch(e) {
            console.error(e);
        }
    }
    // Always return success to prevent email enumeration
    res.json({ success: true, message: 'Si el correo existe, se ha enviado un código de recuperación.' });
});

app.post('/api/reset-password', (req, res) => {
    const { email, code, newPassword } = req.body;
    let users = getDbUsers();
    const userIndex = users.findIndex(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    
    if (userIndex === -1 || users[userIndex].recoveryCode !== code || Date.now() > users[userIndex].recoveryCodeExpires) {
        return res.status(400).json({ error: 'Código inválido o expirado' });
    }
    
    const salt = bcrypt.genSaltSync(10);
    users[userIndex].password = bcrypt.hashSync(newPassword, salt);
    users[userIndex].recoveryCode = null;
    users[userIndex].recoveryCodeExpires = null;
    saveDbUsers(users);
    
    res.json({ success: true, message: 'Contraseña actualizada exitosamente' });
});

"""

code = re.sub(r"// Login Endpoint\napp\.post\('/api/login', \(req, res\) => \{.*?\n\}\);\n", new_auth_endpoints, code, flags=re.DOTALL)

with open('server_patched.js', 'w') as f:
    f.write(code)

print("Patched successfully")
