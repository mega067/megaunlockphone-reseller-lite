const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const regexUsers = /app\.post\('\/api\/users', requireAuth, requireAdmin, \(req, res\) => \{[\s\S]*?app\.delete\('\/api\/users\/:id', requireAuth, requireAdmin, \(req, res\) => \{/;

const replacementUsers = `app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const { username, password, credits, role } = req.body;
  const users = readDB('users.json') || [];
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  const newUser = {
    id: Date.now(),
    username,
    password,
    role: role || 'reseller',
    credits_1: parseFloat(credits) || 0,
    credits_2: 0,
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  writeDB('users.json', users);
  createAutoBackup('Nuevo_Usuario');
  res.json(newUser);
});

app.put('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  const { credits, password } = req.body;
  const serverId = getServerId(req);
  const users = readDB('users.json') || [];
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (credits !== undefined) {
    if (serverId === '2') {
      user.credits_2 = parseFloat(credits);
    } else {
      user.credits_1 = parseFloat(credits);
    }
  }
  if (password) user.password = password;

  writeDB('users.json', users);
  createAutoBackup('Actualizacion_Saldo_O_Clave_S' + serverId);
  res.json(user);
});

app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {`;

code = code.replace(regexUsers, replacementUsers);

const regexSettings = /app\.get\('\/api\/admin\/settings', requireAuth, requireAdmin, \(req, res\) => \{[\s\S]*?app\.post\('\/api\/admin\/product-price', requireAuth, requireAdmin, \(req, res\) => \{/;

const replacementSettings = `app.get('/api/admin/settings', requireAuth, requireAdmin, (req, res) => {
  const settings = readDB('settings.json');
  res.json(settings || {});
});

app.post('/api/admin/settings', requireAuth, requireAdmin, (req, res) => {
  const { server1, server2 } = req.body;
  const settings = readDB('settings.json') || {};
  if (server1) {
    settings.server1.resellerMarkup = parseFloat(server1.resellerMarkup) || 0;
    settings.server1.clientMarkup = parseFloat(server1.clientMarkup) || 0;
  }
  if (server2) {
    settings.server2.resellerMarkup = parseFloat(server2.resellerMarkup) || 0;
    settings.server2.clientMarkup = parseFloat(server2.clientMarkup) || 0;
  }
  writeDB('settings.json', settings);
  res.json(settings);
});

app.post('/api/admin/product-price', requireAuth, requireAdmin, (req, res) => {`;

code = code.replace(regexSettings, replacementSettings);

const regexProductPrice = /app\.post\('\/api\/admin\/product-price', requireAuth, requireAdmin, \(req, res\) => \{[\s\S]*?app\.get\('\/api\/admin\/backup'/;

const replacementProductPrice = `app.post('/api/admin/product-price', requireAuth, requireAdmin, (req, res) => {
  const { serviceid, resellerPrice, clientPrice } = req.body;
  const serverId = getServerId(req);
  if (!serviceid || resellerPrice === undefined || clientPrice === undefined) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const allCustomPrices = readDB('custom_prices.json') || {};
  const serverKey = 'server' + serverId;
  if (!allCustomPrices[serverKey]) allCustomPrices[serverKey] = {};

  allCustomPrices[serverKey][serviceid] = {
    resellerPrice: parseFloat(resellerPrice),
    clientPrice: parseFloat(clientPrice)
  };

  writeDB('custom_prices.json', allCustomPrices);
  res.json({ success: true, prices: allCustomPrices[serverKey][serviceid] });
});

app.get('/api/admin/backup'`;

code = code.replace(regexProductPrice, replacementProductPrice);

fs.writeFileSync('server.js', code);
console.log('Admin APIs updated.');
