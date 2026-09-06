const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const regexStatus = /app\.post\('\/api\/order\/status', requireAuth, async \(req, res\) => \{[\s\S]*?\/\/ Bulk order status proxy endpoint/;

const replacementStatus = `app.post('/api/order/status', requireAuth, async (req, res) => {
  const { orderid } = req.body;
  if (!orderid) return res.status(400).json({ error: 'Order ID is required.' });

  const serverId = getServerId(req);
  const settingsDb = readDB('settings.json');
  const settings = getServerSettings(settingsDb, serverId);
  if (!settings) return res.status(500).json({ error: 'Server misconfigured' });
  const { apiaccesskey, username, endpoint } = settings;

  let targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';

  try {
    let responseData;
    if (serverId === '1') {
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('apiaccesskey', apiaccesskey);
      params.append('action', 'getimeiorder');
      params.append('requestformat', 'JSON');
      params.append('parameters', '<PARAMETERS><ID>' + orderid + '</ID></PARAMETERS>');

      const response = await axios.post(targetUrl, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000
      });
      responseData = response.data;
    } else {
      const response = await callGsmThemeApi(targetUrl, 'getimeiorder', { ID: orderid }, username, apiaccesskey);
      responseData = response.data;
    }

    if (responseData) {
      return res.json(responseData);
    } else {
      return res.status(500).json({ error: 'No response data received.' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch order status.', details: error.message });
  }
});

// Bulk order status proxy endpoint`;

code = code.replace(regexStatus, replacementStatus);

const regexHistory = /app\.get\('\/api\/history', requireAuth, \(req, res\) => \{[\s\S]*?\/\/ Get all users \(admin only\)/;

const replacementHistory = `app.get('/api/history', requireAuth, (req, res) => {
  const history = readDB('history.json') || [];
  const serverId = getServerId(req);
  let userHistory = history.filter(h => h.userId === req.user.id && (h.serverId === serverId || (!h.serverId && serverId === '1')));
  if (req.user.role === 'admin') {
    userHistory = history.filter(h => h.serverId === serverId || (!h.serverId && serverId === '1'));
  }
  res.json(userHistory);
});

// Get all users (admin only)`;

code = code.replace(regexHistory, replacementHistory);

fs.writeFileSync('server.js', code);
console.log('History and Status API updated.');
