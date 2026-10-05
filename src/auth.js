const jwt = require('jsonwebtoken');
const { readDB } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';
const MEGA_BOT_SECRET = process.env.MEGA_BOT_SECRET || 'MEGA_BOT_SECRET_2026';

// Generates a JWT token for a user
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' } // Session expires in 24 hours
  );
}

// Auth Middleware using JWT
function requireAuth(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];

  // Fallback for WhatsApp Bot (Token = userId, with BotSecret in body or headers)
  const botSecret = req.body?.botSecret || req.headers['x-bot-secret'];
  if (botSecret === MEGA_BOT_SECRET && token) {
    const users = readDB('users.json') || [];
    const botUser = users.find(u => String(u.id) === String(token));
    if (botUser) {
      req.user = botUser;
      return next();
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized. Please login again.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please login again.' });
  }
}

function optionalAuth(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    req.user = { id: 'guest', role: 'guest' };
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    req.user = { id: 'guest', role: 'guest' };
    return next();
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden. Admin access required.' });
  }
  next();
}

function requireAdminOrColaborador(req, res, next) {
  if (req.user?.role !== 'admin' && req.user?.role !== 'colaborador') {
    return res.status(403).json({ error: 'Forbidden. Admin or Colaborador access required.' });
  }
  next();
}

function requireBotSecretOnly(req, res, next) {
  const botSecret = req.body?.botSecret || req.headers['x-bot-secret'];
  if (botSecret !== MEGA_BOT_SECRET) {
    return res.status(403).json({ error: 'Unauthorized bot' });
  }
  next();
}

module.exports = {
  generateToken,
  requireAuth,
  optionalAuth,
  requireAdmin,
  requireAdminOrColaborador,
  requireBotSecretOnly
};
