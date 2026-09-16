const fs = require('fs');

// Exact copy of server.js logic for activeMarkup
const settingsDb = JSON.parse(fs.readFileSync('data/settings.json', 'utf8'));
const settings = settingsDb.server3;
const users = JSON.parse(fs.readFileSync('data/users.json', 'utf8'));
const req = { user: users.find(u => u.id === 1) }; // Admin #1

const activeMarkup = (req.user.markup !== null && req.user.markup !== undefined && !isNaN(req.user.markup)) ? parseFloat(req.user.markup) : parseFloat(settings.resellerMarkup || 0);

console.log("req.user.markup:", req.user.markup);
console.log("isNaN(req.user.markup):", isNaN(req.user.markup));
console.log("settings.resellerMarkup:", settings.resellerMarkup);
console.log("activeMarkup:", activeMarkup);

const realCost = 11;
const resellerCost = Math.ceil(realCost + activeMarkup);
console.log("resellerCost:", resellerCost);
