const { readDB } = require('./db');

// In-memory token store
const sessions = {};

// Auth Middleware
function requireAuth(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized. Please login again.' });
  }

  if (sessions[token]) {
    req.user = sessions[token]; // attach user object to request
    return next();
  }

  // Fallback para Bot de WhatsApp (Token = userId, con BotSecret en el body)
  if (req.body && req.body.botSecret === 'MEGA_BOT_SECRET_2026') {
    const users = readDB('users.json') || [];
    const botUser = users.find(u => String(u.id) === String(token));
    if (botUser) {
      req.user = botUser;
      return next();
    }
  }

  return res.status(401).json({ error: 'Unauthorized. Please login again.' });
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden. Admin access required.' });
  }
  next();
}

function requireAdminOrColaborador(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'colaborador') {
    return res.status(403).json({ error: 'Forbidden. Admin or Colaborador access required.' });
  }
  next();
}

module.exports = {
  sessions,
  requireAuth,
  requireAdmin,
  requireAdminOrColaborador
};
