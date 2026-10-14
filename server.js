require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const axios = require('axios');
const https = require('https');
const http = require('http');

// Force IPv4 for all axios requests to prevent Dhru API IPv6 whitelist issues
axios.defaults.httpsAgent = new https.Agent({ family: 4 });
axios.defaults.httpAgent = new http.Agent({ family: 4 });

// Initialize dependencies
const { initializeApp } = require('./src/init');
initializeApp();

const app = express();
const PORT = process.env.PORT || 3000;
const IP = process.env.IP || '::';

// Middlewares
app.use(cors());
app.use(compression());

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve static files with optimized caching
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: function (res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (filePath.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i)) {
      // Images & Fonts: Cache for 7 days
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    } else if (filePath.match(/\.(css|js)$/i)) {
      // CSS & JS: Cache for 1 hour with revalidation to ensure quick updates without full reload lag
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=600');
    }
  }
}));
app.use('/logos', express.static(path.join(__dirname, 'data/logos'), {
  maxAge: '7d'
}));

// Route for DigitalPass Fork
app.get(['/digital-pass', '/digital-pass/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'digitalpass', 'index.html'));
});

// Helpers and Utilities for Legacy Routes
const { readDB, writeDB } = require('./src/db');
const { requireAuth, requireAdmin } = require('./src/auth');
const { getServerId } = require('./src/helpers');
const { enqueueWhatsApp, enqueueWhatsAppAdmin } = require('./src/whatsappQueue');

// Modular Routes
const authRoutes = require('./src/routes/authRoutes');
const catalogRoutes = require('./src/routes/catalogRoutes');
const accountRoutes = require('./src/routes/accountRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const botRoutes = require('./src/routes/botRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const serviceRoutes = require('./src/routes/serviceRoutes');
const ticketConfigRoutes = require('./src/routes/ticketConfigRoutes');

app.use('/api', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api', accountRoutes);
app.use('/api', orderRoutes);
app.use('/api/bot', botRoutes);
app.use('/api', adminRoutes);
app.use('/api', serviceRoutes);
app.use('/api', ticketConfigRoutes({ requireAuth, readDB, writeDB }));

// Legacy Modular Routes
require('./src/history')(app, { requireAuth, readDB, writeDB, getServerId, enqueueWhatsApp, enqueueWhatsAppAdmin });
require('./src/payments')(app, { requireAuth, readDB, writeDB, enqueueWhatsApp, enqueueWhatsAppAdmin });

// Utility Endpoints
app.get('/api/public_settings', (req, res) => {
  const settings = readDB('settings.json') || {};
  let marqueeImages = settings.global?.marqueeImages;
  if (!marqueeImages) {
    marqueeImages = 'https://i.postimg.cc/pLMkLymR/fullbrand.png, https://i.postimg.cc/Hnnx2JKY/brand2.png';
  }
  res.json({ marqueeImages });
});

app.get('/api/kill', requireAuth, requireAdmin, (req, res) => {
  res.send('Killing process to force restart...');
  setTimeout(() => process.exit(0), 100);
});

app.get('/api/proxy-image', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).send('No URL provided');
    
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream'
    });
    
    res.set('Content-Type', response.headers['content-type']);
    res.set('Cache-Control', 'public, max-age=31536000');
    response.data.pipe(res);
  } catch (error) {
    console.error('Proxy Image Error:', error.message);
    res.status(500).send('Error proxying image');
  }
});

// Cron Sync and Debug Endpoints
const { initPoller, pollPendingOrders } = require('./src/poller');
initPoller();

app.get('/api/cron/sync', async (req, res) => {
  try {
    await pollPendingOrders();
    res.json({ status: 'ok', message: 'Sync cron executed' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

app.get('/api/debug-poll', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const history = fs.existsSync(path.join(__dirname, 'data', 'history.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'history.json'))) : [];
    const myOrders = history.filter(h => h.userId === '1').slice(0, 5);
    res.json({ dhru_response: "removed", bulkResults: "removed", history_snippet: myOrders });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message, stack: e.stack });
  }
});

app.post('/api/debug/history', (req, res) => {
  const fs = require('fs');
  fs.writeFileSync(path.join(__dirname, 'client_history_debug.json'), JSON.stringify(req.body, null, 2));
  return res.json({ success: true });
});

app.get('/api/status', (req, res) => {
  const { getCatalogVersion, getHistoryVersion } = require('./src/cacheManager');
  res.json({
    version: getCatalogVersion(),
    historyVersion: getHistoryVersion ? getHistoryVersion() : 1
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.stack);
  res.status(500).json({ error: 'Ocurrió un error interno en el servidor. Por favor, intenta de nuevo más tarde.' });
});

// START SERVER
app.listen(PORT, IP, () => {
  console.log(`==================================================`);
  console.log(`Dhru Fusion Web Client running at http://localhost:${PORT}`);
  console.log(`==================================================`);
});
