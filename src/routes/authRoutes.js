const express = require('express');
const router = express.Router();
const { readDB } = require('../db');
const { generateToken, requireAuth } = require('../auth');
const rateLimit = require('express-rate-limit');

// Rate limiting para login (prevenir brute force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 intentos por IP
  message: { error: 'Demasiados intentos de inicio de sesión, por favor intenta más tarde.' }
});

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  const users = readDB('users.json') || [];
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  
  const token = generateToken(user);
  res.json({ token, role: user.role, username: user.username, credits: user.credits, uid: user.id });
});

router.get('/me', requireAuth, (req, res) => {
  const users = readDB('users.json') || [];
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ username: user.username, role: user.role, credits: user.credits, uid: user.id });
});

module.exports = router;
