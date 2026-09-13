const express = require('express');
const cors = require('cors');
const axios = require('axios');

const https = require('https');
const ipv4Agent = new https.Agent({ family: 4 });
const http = require('http');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const { getDepositAccount } = require('./paymentRouter');
const { validarPagoInteligente } = require('./banxicoCEP');
const { reportarPagoProveedor } = require('./providerPayment');

// WhatsApp Bot is now managed via AlwaysData User Services to run as a continuous daemon.
// The auto-spawn logic has been removed to prevent double connections.

function enqueueWhatsApp(type, message, userId = null) {
  const queueFile = path.join(__dirname, 'queue.json');
  let queue = [];
  try {
    if (fs.existsSync(queueFile)) {
      queue = JSON.parse(fs.readFileSync(queueFile));
    }
  } catch(e) {}
  queue.push({ type, message, userId });
  fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));
}

function enqueueWhatsAppAdmin(message) {
  const users = readDB('users.json') || [];
  const admins = users.filter(u => u.role === 'admin');
  admins.forEach(admin => {
    enqueueWhatsApp('private', message, admin.id);
  });
}

// Force IPv4 for all axios requests to prevent Dhru API IPv6 whitelist issues
axios.defaults.httpsAgent = new https.Agent({ family: 4 });
axios.defaults.httpAgent = new http.Agent({ family: 4 });

const app = express();
const PORT = process.env.PORT || 3000;
const IP = process.env.IP || '::';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve static frontend files with no cache for development
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: function (res, path) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Global Cache and State
let catalogCache = {
  server1: { data: null, lastFetch: 0 },
  server2: { data: null, lastFetch: 0 },
  server3: { data: null, lastFetch: 0 }
};
let catalogVersion = 1;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Database functions
const { readDB, writeDB, DATA_DIR } = require('./src/db');

// Auto-repair script: Wipe any legacy negative debt from Admin accounts
try {
  const users = readDB('users.json') || [];
  let fixed = false;
  users.forEach(u => {
    if (u.role === 'admin') {
      if (u.credits_1 !== 0) { u.credits_1 = 0; fixed = true; }
      if (u.credits_2 !== 0) { u.credits_2 = 0; fixed = true; }
      if (u.credits_3 !== 0) { u.credits_3 = 0; fixed = true; }
      if (u.credits !== 0) { u.credits = 0; fixed = true; }
    }
  });
  if (fixed) writeDB('users.json', users);
} catch (e) {
  console.log('Auto-repair skipped', e);
}

const BACKUP_DIR = path.join(DATA_DIR, 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

function createAutoBackup(reason) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeReason = reason.replace(/[^a-zA-Z0-9_]/g, '_');
    const filename = `autobackup_${timestamp}_${safeReason}.json`;
    const filepath = path.join(BACKUP_DIR, filename);
    
    const dbFiles = ['users.json', 'prices.json', 'custom_prices.json', 'history.json', 'settings.json', 'user_custom_prices.json', 'coupons.json'];
    const backupData = {};
    
    dbFiles.forEach(file => {
      backupData[file] = readDB(file);
    });
    
    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));
    
    let files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json') && f.startsWith('autobackup_'));
    if (files.length > 2) {
      files.sort().reverse();
      const filesToDelete = files.slice(2);
      filesToDelete.forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
    }
  } catch (e) {
    console.error('Error creating auto-backup:', e);
  }
}

// Force seed the primary admin user if missing
let initUsers = readDB('users.json');
if (!initUsers || !Array.isArray(initUsers)) initUsers = [];

const angelExists = initUsers.find(u => u.username.toLowerCase() === 'angel');
if (!angelExists) {
  // Remove the old default 'admin' if it exists to keep it clean
  initUsers = initUsers.filter(u => u.username !== 'admin');
  initUsers.push({
    id: Date.now(),
    username: 'Angel',
    password: 'angel067L',
    role: 'admin',
    credits: 0
  });
  writeDB('users.json', initUsers);
}

const initSettings = readDB('settings.json');
if (!initSettings || !initSettings.server1 || !initSettings.server1.apiaccesskey) {
  writeDB('settings.json', {
    server1: {
      name: 'LatamGSM',
      endpoint: 'https://latamgsm.com/dhru/',
      username: 'angeljuares067@gmail.com',
      apiaccesskey: 'pk60-qXSs-xXsF-qZPa',
      resellerMarkup: 0,
      clientMarkup: 0
    },
    server2: {
      name: 'POPI-GSM',
      endpoint: 'https://popi-gsm.com/public/',
      username: 'angeljuares067@gmail.com',
      apiaccesskey: 'B29Q-G7EJ-A3OU-629Z-VQYO-5ZX9-F8SE-QCRU',
      resellerMarkup: 0,
      clientMarkup: 0
    }
  });
}

// In-memory token store
const sessions = {};

// Multi-Server Helpers
const SERVER_DISPLAY_NAMES = { '1': '⚡ MEGA-SERVER', '2': '🛡 ALPHA-SERVER', '3': '🔱 OMEGA-SERVER' };
function getServerDisplayName(id) { return SERVER_DISPLAY_NAMES[String(id)] || 'Servidor ' + id; }
function getServerId(req) {
  const id = req.headers['x-server-id'] || req.body?.serverId || '1';
  return ['1', '2', '3'].includes(id) ? id : '1';
}

function getServerSettings(settings, serverId) {
  if (!settings) return null;
  
  let s = {};
  if (serverId === '3') {
    s = settings.server3 || {};
    s.endpoint = s.endpoint || "https://www.unlockerfast.com.mx/";
    s.username = s.username || "MegaUnlockPhone";
    s.apiaccesskey = s.apiaccesskey || "QXU-2HD-MAR-PKM-PAD-RFP-XK5-5ME";
  } else if (serverId === '2') {
    s = settings.server2 || {};
    s.endpoint = s.endpoint || "https://popi-gsm.com/public/";
    s.username = s.username || "angeljuares067@gmail.com";
    s.apiaccesskey = s.apiaccesskey || "B29Q-G7EJ-A3OU-629Z-VQYO-5ZX9-F8SE-QCRU";
  } else {
    // Server 1 (LatamGSM) with legacy fallback support
    s = settings.server1 || {};
    s.endpoint = s.endpoint || settings.endpoint || "https://latamgsm.com/dhru/";
    s.username = s.username || settings.username || settings.masterUsername || "angeljuares067@gmail.com";
    s.apiaccesskey = s.apiaccesskey || settings.apiaccesskey || "pk60-qXSs-xXsF-qZPa";
  }

  s.resellerMarkup = s.resellerMarkup || settings.resellerMarkup || 0;
  s.clientMarkup = s.clientMarkup || settings.clientMarkup || 0;
  
  return s;
}

function getUserCredit(user, serverId) {
  // Migrate legacy users to separated wallets
  if (user.credits_1 === undefined) {
    user.credits_1 = parseFloat(user.credits || 0);
    user.credits_2 = 0;
    user.credits_3 = 0;
    delete user.credits;
  }
  
  if (serverId === '3') return parseFloat(user.credits_3 || 0);
  if (serverId === '2') return parseFloat(user.credits_2 || 0);
  return parseFloat(user.credits_1 || 0);
}

function setUserCredit(user, serverId, amount) {
  if (serverId === '3') user.credits_3 = parseFloat(amount);
  else if (serverId === '2') user.credits_2 = parseFloat(amount);
  else user.credits_1 = parseFloat(amount);
}

// GSM Theme API Caller
async function callGsmThemeApi(targetUrl, action, parameters, username, apiaccesskey) {
  const jsonParams = parameters ? Buffer.from(JSON.stringify(parameters)).toString('base64') : '';
  const params = new URLSearchParams();
  params.append('username', username);
  params.append('apiaccesskey', apiaccesskey);
  params.append('action', action);
  params.append('requestformat', 'JSON');
  params.append('parameters', jsonParams);

  const res = await axios.post(targetUrl, params.toString(), {
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'MegaUnlock/1.0',
      'X-Powered-By': 'GSM-THEME'
    },
    timeout: 30000
  });
  return res;
}

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

// Login Endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readDB('users.json') || [];
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  
  // Generate a simple secure token
  const token = require('crypto').randomBytes(32).toString('hex');
  sessions[token] = user;
  res.json({ token, role: user.role, username: user.username, credits: user.credits, uid: user.id });
});

// Get My Account Info (Balance)
app.get('/api/me', requireAuth, (req, res) => {
  const users = readDB('users.json') || [];
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  // Update session
  sessions[req.headers['authorization'].split(' ')[1]] = user;
  res.json({ username: user.username, role: user.role, credits: user.credits, uid: user.id });
});

// API proxy endpoint for Products
app.get('/api/products', requireAuth, async (req, res) => {
  const settingsDb = readDB('settings.json');
  const serverId = getServerId(req);
  const settings = getServerSettings(settingsDb, serverId);
  
  if (!settings || !settings.username || !settings.apiaccesskey) {
    return res.status(400).json({ error: 'Settings misconfigured for Server ' + serverId });
  }

  const { apiaccesskey, username, endpoint, resellerMarkup, clientMarkup } = settings;
  const targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';

  try {
    let mergedList = {};
    let hasSuccess = false;
    
    const serverKey = 'server' + serverId;
    const forceSync = req.query.forceSync === 'true';
    const now = Date.now();
    
    // Use Cache if valid
    if (!forceSync && catalogCache[serverKey].data && (now - catalogCache[serverKey].lastFetch < CACHE_TTL)) {
       mergedList = JSON.parse(JSON.stringify(catalogCache[serverKey].data));
       hasSuccess = true;
    } else {
      // Fetch from External API
      if (serverId === '1' || serverId === '3') {
      const paramsImei = new URLSearchParams();
      paramsImei.append('username', username);
      paramsImei.append('apiaccesskey', apiaccesskey);
      paramsImei.append('action', 'imeiservicelist');
      paramsImei.append('requestformat', 'JSON');

      const paramsServer = new URLSearchParams();
      paramsServer.append('username', username);
      paramsServer.append('apiaccesskey', apiaccesskey);
      paramsServer.append('action', 'serverservicelist');
      paramsServer.append('requestformat', 'JSON');

      const [resImei, resServer] = await Promise.all([
        axios.post(targetUrl, paramsImei.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' },
          timeout: 15000, httpsAgent: ipv4Agent
        }).catch(e => ({ data: { ERROR: e.message } })),
        axios.post(targetUrl, paramsServer.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' },
          timeout: 15000, httpsAgent: ipv4Agent
        }).catch(e => ({ data: { ERROR: e.message } }))
      ]);

      if (resImei.data && resImei.data.SUCCESS && resImei.data.SUCCESS[0] && resImei.data.SUCCESS[0].LIST) {
        mergedList = { ...resImei.data.SUCCESS[0].LIST };
        for (const g in mergedList) {
          for (const s in mergedList[g].SERVICES || {}) {
             const t = mergedList[g].SERVICES[s].SERVICETYPE;
             mergedList[g].SERVICES[s]._SERVICE_TYPE = t ? t.toUpperCase() : 'IMEI';
          }
        }
        hasSuccess = true;
      }
      
      if (resServer.data && resServer.data.SUCCESS && resServer.data.SUCCESS[0] && resServer.data.SUCCESS[0].LIST) {
        const serverList = resServer.data.SUCCESS[0].LIST;
        for (const g in serverList) {
          for (const s in serverList[g].SERVICES || {}) {
            serverList[g].SERVICES[s]._SERVICE_TYPE = 'SERVER';
          }
          if (mergedList[g]) {
             mergedList[g].SERVICES = { ...mergedList[g].SERVICES, ...serverList[g].SERVICES };
          } else {
             mergedList[g] = serverList[g];
          }
        }
        hasSuccess = true;
      }
    } else {
      // SERVER 2: GSM THEME API
      const [resImei, resServer] = await Promise.all([
        callGsmThemeApi(targetUrl, 'imeiservicelist', null, username, apiaccesskey).catch(e => ({ data: { ERROR: e.message } })),
        callGsmThemeApi(targetUrl, 'serverservicelist', null, username, apiaccesskey).catch(e => ({ data: { ERROR: e.message } }))
      ]);

      if (resImei.data && resImei.data.SUCCESS && resImei.data.SUCCESS[0] && resImei.data.SUCCESS[0].LIST) {
        mergedList = { ...resImei.data.SUCCESS[0].LIST };
        for (const g in mergedList) {
          for (const s in mergedList[g].SERVICES || {}) {
             mergedList[g].SERVICES[s]._SERVICE_TYPE = 'IMEI';
          }
        }
        hasSuccess = true;
      }
      
      if (resServer.data && resServer.data.SUCCESS && resServer.data.SUCCESS[0] && resServer.data.SUCCESS[0].LIST) {
        const serverList = resServer.data.SUCCESS[0].LIST;
        for (const g in serverList) {
          for (const s in serverList[g].SERVICES || {}) {
            serverList[g].SERVICES[s]._SERVICE_TYPE = 'SERVER';
          }
          if (mergedList[g]) {
             mergedList[g].SERVICES = { ...mergedList[g].SERVICES, ...serverList[g].SERVICES };
          } else {
             mergedList[g] = serverList[g];
          }
        }
        hasSuccess = true;
      }
    }

      if (hasSuccess) {
        catalogCache[serverKey].data = JSON.parse(JSON.stringify(mergedList));
        catalogCache[serverKey].lastFetch = Date.now();
      }
    }

    if (hasSuccess) {
      const priceCache = {};
      const allCustomPrices = readDB('custom_prices.json') || {};
      const customPrices = allCustomPrices['server' + serverId] || {};
      const users = readDB('users.json') || [];
      const dbUser = users.find(u => u.id === req.user.id) || req.user;
      
      const allUserCustomPrices = readDB('user_custom_prices.json') || {};
      const serverUserCustomPrices = allUserCustomPrices['server' + serverId] || {};
      
      for (const groupKey in mergedList) {
        for (const serviceKey in mergedList[groupKey].SERVICES || {}) {
          const service = mergedList[groupKey].SERVICES[serviceKey];
          const realServiceId = service.SERVICEID || service.serviceid || serviceKey;
          
          const disabledDb = readDB('disabled_services.json') || {};
          const disabledServicesForServer = disabledDb['server' + serverId] || [];
          if (disabledServicesForServer.includes(realServiceId)) {
             service._DISABLED = true;
          }
          const exchangeRate = parseFloat(settingsDb.exchangeRate || 17.60);
          const rate = serverId === '3' ? 1 : exchangeRate;
          const realCredit = parseFloat(service.CREDIT || '0') * rate;
          priceCache[realServiceId] = realCredit;
          
          let resellerCost, clientPrice;
          const isManager = req.user.role === 'admin' || req.user.role === 'colaborador';
          const ucp = !isManager && serverUserCustomPrices[realServiceId] && serverUserCustomPrices[realServiceId][req.user.id];

          if (customPrices[realServiceId]) {
            service._CUSTOM_RESELLER = customPrices[realServiceId].resellerPrice != null ? customPrices[realServiceId].resellerPrice.toString() : '';
            service._CUSTOM_CLIENT = customPrices[realServiceId].clientPrice != null ? customPrices[realServiceId].clientPrice.toString() : '';
          } else {
            delete service._CUSTOM_RESELLER;
            delete service._CUSTOM_CLIENT;
          }

          if (ucp && ucp.resellerPrice !== undefined) {
            resellerCost = parseFloat(ucp.resellerPrice);
            clientPrice = ucp.clientPrice !== undefined ? parseFloat(ucp.clientPrice) : 
                (customPrices[realServiceId] ? parseFloat(customPrices[realServiceId].clientPrice) : Math.ceil(resellerCost + parseFloat(clientMarkup)));
          } else if (customPrices[realServiceId]) {
            resellerCost = parseFloat(customPrices[realServiceId].resellerPrice);
            clientPrice = parseFloat(customPrices[realServiceId].clientPrice);
          } else {
            const activeMarkup = (dbUser.markup !== null && dbUser.markup !== undefined && !isNaN(dbUser.markup)) ? parseFloat(dbUser.markup) : parseFloat(resellerMarkup);
            resellerCost = Math.ceil(realCredit + activeMarkup);
            clientPrice = Math.ceil(resellerCost + parseFloat(clientMarkup));
          }
          
          // Enforce minimum price (must be at least API cost)
          if (isNaN(resellerCost) || resellerCost < realCredit) resellerCost = Math.ceil(realCredit);
          if (isNaN(clientPrice) || clientPrice < resellerCost) clientPrice = resellerCost;

          service.CREDIT = resellerCost.toString();
          service._RESELLER_COST = resellerCost.toString();
          service._CLIENT_PRICE = clientPrice.toString();
          if (req.user.role === 'admin' || req.user.role === 'colaborador') {
            service._REAL_COST = realCredit.toFixed(2);
          }
        }
      }

      writeDB('prices_' + serverId + '.json', priceCache);
      
      const finalData = { SUCCESS: [ { LIST: mergedList } ] };
      return res.json(finalData);
    } else {
      return res.status(500).json({ error: 'Failed to fetch catalogs from API.' });
    }
  } catch (error) {
    console.error('API Proxy Error:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get account info proxy endpoint
app.get('/api/account', requireAuth, async (req, res) => {
  const serverId = getServerId(req);
  const users = readDB('users.json') || [];
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  // Base response: local credits based on server
  const localCredit = getUserCredit(user, serverId);
  
  if (user.role === 'admin') {
    const settingsDb = readDB('settings.json');
    if (!settingsDb) return res.status(500).json({ error: 'Settings missing' });
    const settings = getServerSettings(settingsDb, serverId);
    if (!settings) return res.status(500).json({ error: 'Server misconfigured' });
    const { apiaccesskey, username, endpoint } = settings;
    
    let targetUrl = endpoint || 'https://latamgsm.com/dhru/';
    if (!targetUrl.endsWith('/')) targetUrl += '/';
    if (!targetUrl.includes('/api/')) targetUrl += 'api/index.php';
    else if (targetUrl.endsWith('/api/')) targetUrl += 'index.php';
    
    try {
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('apiaccesskey', apiaccesskey);
      params.append('action', 'accountinfo');
      params.append('requestformat', 'JSON');
      
      const response = await axios.post(targetUrl, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' },
        timeout: 10000
      });
      
      const exchangeRate = parseFloat(settingsDb.exchangeRate || 17.60);
      const rate = serverId === '3' ? 1 : exchangeRate;
      const dhruCreditRaw = parseFloat(response.data?.SUCCESS?.[0]?.AccountInfo?.creditraw || 0);
      const dhruCredit = dhruCreditRaw * rate;
      
      // Calculate assigned credits based on server
      let assignedCredits = 0;
      users.forEach(u => {
        if (u.role !== 'admin') {
          assignedCredits += getUserCredit(u, serverId);
        }
      });
      const availableCredits = dhruCredit - assignedCredits;

      return res.json({
        SUCCESS: [{
          CREDIT: dhruCredit.toFixed(2),
          ASSIGNED: assignedCredits.toFixed(2),
          AVAILABLE: availableCredits.toFixed(2),
          IS_ADMIN: true
        }]
      });
    } catch (e) {
      // If Dhru fetch fails, still return local credit but indicate error
      return res.json({
        SUCCESS: [{
          CREDIT: "0"
        }]
      });
    }
  } else {
    // For normal resellers, just return their local virtual credit
    return res.json({
      SUCCESS: [{
        CREDIT: localCredit.toString()
      }]
    });
  }
});

app.get('/api/kill', (req, res) => {
  res.send('Killing process to force restart...');
  setTimeout(() => process.exit(0), 100);
});

app.get('/api/brute_dhru', async (req, res) => {
  try {
    const settings = readDB('settings.json');
    const { username, apiaccesskey, endpoint } = settings.server1;
    let targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';
    const axios = require('axios');
    const results = {};
    
    async function test(action, xml) {
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('apiaccesskey', apiaccesskey);
      params.append('action', action);
      params.append('requestformat', 'JSON');
      if (xml) params.append('parameters', xml);
      
      const response = await axios.post(targetUrl, params.toString(), {
        headers: { 
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Dhru-Fusion-Web-Client/1.0'
        }
      });
      return response.data;
    }
    
    // First, let's get the service info to see what fields it expects!
    const srv = await test('imeiservicelist', null);
    results.srv = srv;
    if (srv && srv.SUCCESS) {
        const list = srv.SUCCESS[0].LIST;
        for (const g in list) {
            const srvs = list[g].SERVICES;
            for (const k in srvs) {
                if (srvs[k].SERVICEID == '154') {
                    results.service_info = srvs[k];
                }
            }
        }
    }
    // CUSTOMFIELD format fixed to base64 JSON - test endpoint clean
    res.json({ status: 'ok', service_info: results.service_info, message: 'CUSTOMFIELD now uses base64 JSON format' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Place order proxy endpoint
async function processOrder(req, res) {
  const { serviceid, imei, custom_fields, serviceType, serviceName, qnt = 1 } = req.body;
  
  let finalImei = imei;
  if (custom_fields && typeof custom_fields === 'object') {
    const targetKeys = ['numero', 'referencia', 'telefono', 'linea', 'celular', 'phone', 'number', 'ref', 'playerid', 'id'];
    const customKeys = Object.keys(custom_fields);
    const keyToCopy = customKeys.find(k => targetKeys.includes(k.toLowerCase().replace(/[^a-z0-9]/g, '')));
    if (keyToCopy && custom_fields[keyToCopy]) {
      const val = String(custom_fields[keyToCopy]).trim();
      const isDummyImei = !finalImei || 
                          finalImei === '111111111111111' || 
                          (finalImei.length >= 13 && /^\d+$/.test(finalImei));
      if (isDummyImei && val.length <= 15) {
        finalImei = val;
        // Do NOT delete from custom_fields because Dhru API strictly requires it.
      }
    }
  }

  // Ensure qnt is a valid positive integer
  const quantity = Math.max(1, parseInt(qnt) || 1);
  const serverId = getServerId(req);
  const settingsDb = readDB('settings.json');
  const settings = getServerSettings(settingsDb, serverId);
  const users = readDB('users.json') || [];
  const prices = readDB('prices_' + serverId + '.json') || {};
  const history = readDB('history.json') || [];
  
  if (!settings || !serviceid) return res.status(400).json({ error: 'Missing serviceid or server settings.' });
  
  const userIndex = users.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
  const user = users[userIndex];

  let realCost = prices[serviceid] !== undefined ? prices[serviceid] : null;
  if (realCost === null) {
    // Robust fallback: if price is missing, try to read from the cached catalog directly in memory
    const serverKey = 'server' + serverId;
    if (catalogCache[serverKey] && catalogCache[serverKey].data) {
       const list = catalogCache[serverKey].data;
       for (const g in list) {
         if (list[g].SERVICES) {
            let s = null;
            if (Array.isArray(list[g].SERVICES)) {
                s = list[g].SERVICES.find(x => x && (x.SERVICEID == serviceid || x.serviceid == serviceid));
            } else {
                // It's an object, check if key is the id OR if values have the id
                s = list[g].SERVICES[serviceid] || Object.values(list[g].SERVICES).find(x => x && (x.SERVICEID == serviceid || x.serviceid == serviceid));
            }
            if (s) {
                const exchangeRate = parseFloat(settingsDb.exchangeRate || 17.60);
                const rate = serverId === '3' ? 1 : exchangeRate;
                realCost = parseFloat(s.CREDIT || '0') * rate;
                prices[serviceid] = realCost;
                writeDB('prices_' + serverId + '.json', prices); // Save it for next time
                break;
            }
         }
       }
    }
    
    if (realCost === null) {
      return res.status(400).json({ error: 'El catálogo se está sincronizando en el servidor. Por favor, espera 5 segundos y vuelve a intentarlo.' });
    }
  }
  const allCustomPrices = readDB('custom_prices.json') || {};
  const customPrices = allCustomPrices['server' + serverId] || {};
  const allUserCustomPrices = readDB('user_custom_prices.json') || {};
  const serverUserCustomPrices = allUserCustomPrices['server' + serverId] || {};
  
  let resellerCost;
  const ucp = serverUserCustomPrices[serviceid] && serverUserCustomPrices[serviceid][user.id];

  if (ucp && ucp.resellerPrice !== undefined) {
    resellerCost = parseFloat(ucp.resellerPrice);
  } else if (customPrices[serviceid]) {
    resellerCost = parseFloat(customPrices[serviceid].resellerPrice);
  } else {
    const activeMarkup = (user.markup !== null && user.markup !== undefined && !isNaN(user.markup)) ? parseFloat(user.markup) : parseFloat(settings.resellerMarkup);
    resellerCost = Math.ceil(realCost + activeMarkup);
  }
  
  const profit = resellerCost - realCost;
  const isReseller = user.role !== 'admin';
  const finalCostToDeduct = (isReseller ? resellerCost : realCost) * quantity;
  const baseCostToDeduct = isReseller ? resellerCost : realCost;

  const currentCredit = getUserCredit(user, serverId);
  if (isReseller && currentCredit < finalCostToDeduct) {
    return res.status(400).json({ error: `Saldo insuficiente. Tienes $${currentCredit.toFixed(2)} y el pedido cuesta $${finalCostToDeduct.toFixed(2)} (Cantidad: ${quantity} x $${baseCostToDeduct.toFixed(2)})` });
  }

  const { apiaccesskey, username, endpoint } = settings;
  let targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';

  try {
    let responseData;
    let orderId = 'Desconocido';
    let msg = 'Exitoso';

    if (serverId === '1' || serverId === '3') {
      let customXmlBase64 = '';
      let customXmlRaw = '';
      if (custom_fields && typeof custom_fields === 'object' && Object.keys(custom_fields).length > 0) {
        const cleanedFields = {};
        for (const [key, val] of Object.entries(custom_fields)) {
          if (key.trim() !== '') {
            cleanedFields[key] = val;
          }
        }
        if (Object.keys(cleanedFields).length > 0) {
          // Format 1: Base64
          const b64 = Buffer.from(JSON.stringify(cleanedFields)).toString('base64');
          customXmlBase64 = `<CUSTOMFIELD>${b64}</CUSTOMFIELD>`;
          
          // Format 2: Raw XML
          let rawXml = '';
          for (const [key, val] of Object.entries(cleanedFields)) {
            const cleanKey = key.toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (cleanKey) rawXml += `<${cleanKey}>${val}</${cleanKey}>`;
          }
          customXmlRaw = `<CUSTOMFIELD>${rawXml}</CUSTOMFIELD>`;
        }
      }

      const notes = req.body.notes || '';
      let notesXml = '';
      if (notes.trim() !== '') {
        notesXml = '<NOTES>' + notes.trim() + '</NOTES>';
      }

      const baseParameters = '<ID>' + serviceid + '</ID><IMEI>' + (finalImei && finalImei.trim() !== '' ? finalImei : '111111111111111') + '</IMEI>' + (quantity > 1 || serviceType === 'SERVER' || serviceType === 'server' ? '<QNT>' + quantity + '</QNT>' : '');

      let primaryAction = (serviceType === 'SERVER' || serviceType === 'server') ? 'placeserverorder' : 'placeimeiorder';
      let secondaryAction = primaryAction === 'placeserverorder' ? 'placeimeiorder' : 'placeserverorder';

      const sendDhruRequest = async (currentAction, currentCustomXml) => {
        const xmlParameters = `<PARAMETERS>${baseParameters}${currentCustomXml}${notesXml}</PARAMETERS>`;
        const params = new URLSearchParams();
        params.append('username', username);
        params.append('apiaccesskey', apiaccesskey);
        params.append('action', currentAction);
        params.append('requestformat', 'JSON');
        params.append('parameters', xmlParameters);
        
        const response = await axios.post(targetUrl, params.toString(), {
          headers: { 
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'Dhru-Fusion-Web-Client/1.0'
          }, 
          timeout: 20000
        });
        return response.data;
      };

      // Try combinations in order
      const combinations = [
        { action: primaryAction, xml: customXmlBase64 },
        { action: secondaryAction, xml: customXmlBase64 },
        { action: primaryAction, xml: customXmlRaw },
        { action: secondaryAction, xml: customXmlRaw }
      ];

      for (const combo of combinations) {
        responseData = await sendDhruRequest(combo.action, combo.xml);
        
        // If it succeeds, break out of loop
        if (responseData && responseData.SUCCESS) {
          break;
        }

        // Check if error is 'Invalid Action' or 'Command Not Found'
        if (responseData && responseData.ERROR && responseData.ERROR.length > 0) {
          let errorMsg = '';
          if (typeof responseData.ERROR[0] === 'object') {
            errorMsg = responseData.ERROR[0].MESSAGE || responseData.ERROR[0].message || responseData.ERROR[0].Error || responseData.ERROR[0].error || '';
          } else if (typeof responseData.ERROR[0] === 'string') {
            errorMsg = responseData.ERROR[0];
          }
          
          // Only continue loop if it's one of these specific routing errors, otherwise it's a real user error
          if (errorMsg !== 'Invalid Action' && errorMsg !== 'Command Not Found') {
            break;
          }
        }
      }

      // If we exhausted all loops and it's STILL an error, decorate it
      if (responseData && responseData.ERROR && responseData.ERROR.length > 0) {
        if (typeof responseData.ERROR[0] === 'object') {
           responseData.ERROR[0].MESSAGE = `Todos los intentos (Base64/Raw, IMEI/Server) fallaron. Original: ` + (responseData.ERROR[0].MESSAGE || responseData.ERROR[0].Error || '');
        } else if (typeof responseData.ERROR[0] === 'string') {
           responseData.ERROR[0] = `Todos los intentos (Base64/Raw, IMEI/Server) fallaron. Original: ` + responseData.ERROR[0];
        }
      }

    } else {
      // SERVER 2: GSM THEME API
      let gsmParams = { ID: serviceid };
      
      gsmParams.IMEI = finalImei && finalImei.trim() !== '' ? finalImei : '111111111111111';
      
      if (serviceType === 'SERVER' || serviceType === 'server') {
        gsmParams.QNT = quantity;
      }
      
      if (custom_fields && typeof custom_fields === 'object' && Object.keys(custom_fields).length > 0) {
        gsmParams.CUSTOMFIELD = Buffer.from(JSON.stringify(custom_fields)).toString('base64');
      }
      if (req.body.notes && req.body.notes.trim() !== '') {
        gsmParams.NOTES = req.body.notes.trim();
      }
      const action = (serviceType === 'SERVER' || serviceType === 'server') ? 'placeserverorder' : 'placeimeiorder';
      const response = await callGsmThemeApi(targetUrl, action, gsmParams, username, apiaccesskey);
      responseData = response.data;
    }

    if (responseData && responseData.SUCCESS) {
      if (isReseller) {
        const uCredit = getUserCredit(users[userIndex], serverId);
        setUserCredit(users[userIndex], serverId, uCredit - finalCostToDeduct);
        settingsDb.adminProfitBalance = (settingsDb.adminProfitBalance || 0) + profit;
      }
      
      writeDB('users.json', users);
      writeDB('settings.json', settingsDb);
      
      const successItem = Array.isArray(responseData.SUCCESS) ? responseData.SUCCESS[0] : responseData.SUCCESS;
      orderId = successItem.REFERENCEID || successItem.ORDERID || successItem.ID || 'Desconocido';
      msg = successItem.MESSAGE || 'Exitoso';

      let imeiDataString = finalImei || 'N/A';
      if (custom_fields && typeof custom_fields === 'object') {
        const customKeys = Object.keys(custom_fields);
        if (customKeys.length > 0) {
          imeiDataString += ' (';
          customKeys.forEach((key, index) => {
            imeiDataString += key + ': ' + custom_fields[key] + (index < customKeys.length - 1 ? ', ' : '');
          });
          imeiDataString += ')';
        }
      }

      history.unshift({
        id: 'txn_' + Date.now(),
        serverId: serverId,
        userId: user.id,
        username: user.username,
        date: new Date().toISOString(),
        serviceId: serviceid,
        serviceName: serviceName || 'Servicio',
        serviceType: serviceType || 'IMEI',
        imei: imeiDataString,
        costCharged: finalCostToDeduct,
        resellerCost: resellerCost,
        realCost: realCost,
        profit: isReseller ? profit : 0,
        orderId,
        status: 'pending',
        msg,
        notes: req.body.notes || ''
      });
      if (history.length > 500) history.pop();
      writeDB('history.json', history);
      
      createAutoBackup('Nuevo_Pedido_S' + serverId);

      const userNameDisplay = user.role === 'admin' ? 'Admin #1' : user.username;
      const adminMsg = `🛒 NUEVO PEDIDO RECIBIDO\n━━━━━━━━━━━━━━━━━━━━━━\n#️⃣ Orden: #${orderId}\n👨🏽💻 Usuario: ${userNameDisplay}\n🔧 Servicio: ${serviceName || 'N/A'}\n🔍 Detalles: ${imeiDataString}\n💲 Precio: $${parseFloat(resellerCost).toFixed(2)} MXN\n🖥️ Servidor: ${getServerDisplayName(serverId)}\n━━━━━━━━━━━━━━━━━━━━━━\n🛡️ MegaUnlockPhone`;
      enqueueWhatsAppAdmin(adminMsg);
      
      const groupMsg = `🛒 NUEVO PEDIDO RECIBIDO\n━━━━━━━━━━━━━━━━━━━━━━\n#️⃣ Orden: #${orderId}\n👨🏽💻 Usuario: ${userNameDisplay}\n🔧 Servicio: ${serviceName || 'N/A'}\n🖥️ Servidor: ${getServerDisplayName(serverId)}\n━━━━━━━━━━━━━━━━━━━━━━\n🌐 MegaUnlockPhone`;
      enqueueWhatsApp('group', groupMsg);

      const clientMsg = `📨 ORDEN EN PROCESO\n\n🆔 Orden: #${orderId}\n📱 IMEI: ${imeiDataString || 'N/A'}\n🔧 Servicio: ${serviceName || 'Servicio'}\n💲 Costo: $${parseFloat(resellerCost).toFixed(2)} MXN\n🔑 Código / Respuesta: Procesando...\n🎉 Estado: En proceso\n\n━━━━━━━━━━━━━━\n🌐 MegaUnlockPhone`;
      enqueueWhatsApp('private', clientMsg, user.id);

      return res.json(responseData);
    } else if (responseData && responseData.ERROR) {
      return res.json(responseData);
    } else {
      return res.status(500).json({ error: 'Respuesta inválida del servidor remoto.' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Fallo al comunicarse con el proveedor.', details: error.message });
  }
}

app.post('/api/order', requireAuth, processOrder);

// Get order status proxy endpoint
app.post('/api/order/status', requireAuth, async (req, res) => {
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
    if (serverId === '1' || serverId === '3') {
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('apiaccesskey', apiaccesskey);
      params.append('action', 'getimeiorder');
      params.append('requestformat', 'JSON');
      params.append('parameters', '<PARAMETERS><ID>' + orderid + '</ID></PARAMETERS>');

      const response = await axios.post(targetUrl, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000, httpsAgent: ipv4Agent
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

// Bulk order status proxy endpoint
app.post('/api/orders/bulk-status', requireAuth, async (req, res) => {
  const { ids, items } = req.body;
  if (!ids && !items) return res.status(400).json({ error: 'ids or items are required.' });

  const serverId = getServerId(req);
  const settingsDb = readDB('settings.json');
  if (!settingsDb) return res.status(500).json({ error: 'Server misconfigured' });
  const settings = getServerSettings(settingsDb, serverId);
  if (!settings) return res.status(500).json({ error: 'Server misconfigured' });
  const { apiaccesskey, username, endpoint } = settings;

  let targetUrl = endpoint || 'https://latamgsm.com/dhru/';
  if (!targetUrl.endsWith('/')) targetUrl += '/';
  if (!targetUrl.includes('/api/')) targetUrl += 'api/index.php';
  else if (targetUrl.endsWith('/api/')) targetUrl += 'index.php';

  try {
    let syncList = [];
    if (items && Array.isArray(items)) {
      syncList = items.filter(item => item && item.id);
    } else if (ids) {
      syncList = ids.split(',').map(id => ({ id: id.trim(), type: 'IMEI' })).filter(item => item.id);
    }

    const requests = syncList.map(async (itemObj) => {
      const orderid = itemObj.id;
      let action = 'getimeiorder';
      if (itemObj.type) {
        let t = String(itemObj.type).toLowerCase().trim();
        if (t !== 'server' && t !== 'file') {
          t = 'imei';
        }
        action = `get${t}order`; // Ensures remote services fall back to getimeiorder
      }

      const params = new URLSearchParams();
      params.append('username', username);
      params.append('apiaccesskey', apiaccesskey);
      params.append('action', action);
      params.append('requestformat', 'JSON');
      params.append('parameters', `<PARAMETERS><ID>${orderid}</ID></PARAMETERS>`);

      try {
        let response = await axios.post(targetUrl, params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000, httpsAgent: ipv4Agent
        });

        // Fallback for providers that mix SERVER orders into the IMEI database
        if ((!response.data || !response.data.SUCCESS || response.data.SUCCESS.length === 0) && action === 'getserverorder') {
          params.set('action', 'getimeiorder');
          response = await axios.post(targetUrl, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000, httpsAgent: ipv4Agent
          });
        }

        if (response.data && response.data.SUCCESS && response.data.SUCCESS.length > 0) {
          const item = response.data.SUCCESS[0];
          return {
            orderid: orderid,
            status: String(item.STATUS) === '4' ? 'success' : (String(item.STATUS) === '3' ? 'failed' : 'pending'),
            statusText: item.REPLY || item.REJECT_REASON || item.CODE || item.MESSAGE || (String(item.STATUS) === '4' ? 'Completado' : (String(item.STATUS) === '3' ? 'Rechazado' : 'En proceso')),
            raw: item
          };
        }
      } catch (err) {
        return { orderid, status: 'error', statusText: 'Fallo de conexión' };
      }
      return { orderid, status: 'unknown', statusText: 'Sin respuesta válida' };
    });

    const results = await Promise.all(requests);
    return res.json({ SUCCESS: results });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch bulk statuses.', details: error.message });
  }
});

// History Endpoints Modularized
require('./src/history')(app, { requireAuth, readDB, writeDB, getServerId, enqueueWhatsApp, enqueueWhatsAppAdmin });

// --- WHATSAPP BOT ENDPOINTS ---
const BOT_SECRET = process.env.BOT_SECRET || 'MEGA_BOT_SECRET_2026';

function requireBotSecret(req, res, next) {
  if (req.body.botSecret !== BOT_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const users = readDB('users.json') || [];
  const userIndex = users.findIndex(u => u.id === req.body.userId);
  if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
  req.user = users[userIndex];
  req.headers['x-server-id'] = req.body.serverId || '1';
  next();
}

app.post('/api/bot/search', requireBotSecret, async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query' });
  
  const serverId = getServerId(req);
  const settingsDb = readDB('settings.json') || {};
  const settings = getServerSettings(settingsDb, serverId);
  const prices = readDB('prices_' + serverId + '.json') || {};
  const allCustomPrices = readDB('custom_prices.json') || {};
  const customPrices = allCustomPrices['server' + serverId] || {};
  const allUserCustomPrices = readDB('user_custom_prices.json') || {};
  const serverUserCustomPrices = allUserCustomPrices['server' + serverId] || {};
  
  const serverKey = 'server' + serverId;
  let list = (catalogCache[serverKey] && catalogCache[serverKey].data) ? catalogCache[serverKey].data : null;

  if (!list) {
    if (settings && settings.username && settings.apiaccesskey) {
        const { apiaccesskey, username, endpoint } = settings;
        let targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';
        try {
            let mergedList = {};
            let hasSuccess = false;
            if (serverId === '1' || serverId === '3') {
                const p1 = new URLSearchParams(); p1.append('username', username); p1.append('apiaccesskey', apiaccesskey); p1.append('action', 'imeiservicelist'); p1.append('requestformat', 'JSON');
                const p2 = new URLSearchParams(); p2.append('username', username); p2.append('apiaccesskey', apiaccesskey); p2.append('action', 'serverservicelist'); p2.append('requestformat', 'JSON');
                const [r1, r2] = await Promise.all([
                    axios.post(targetUrl, p1.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' }, timeout: 15000, httpsAgent: ipv4Agent }).catch(e=>({})),
                    axios.post(targetUrl, p2.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' }, timeout: 15000, httpsAgent: ipv4Agent }).catch(e=>({}))
                ]);
                if (r1.data && r1.data.SUCCESS && r1.data.SUCCESS[0] && r1.data.SUCCESS[0].LIST) {
                    mergedList = { ...r1.data.SUCCESS[0].LIST }; hasSuccess = true;
                }
                if (r2.data && r2.data.SUCCESS && r2.data.SUCCESS[0] && r2.data.SUCCESS[0].LIST) {
                    const sList = r2.data.SUCCESS[0].LIST;
                    for (const g in sList) {
                        if (mergedList[g]) mergedList[g].SERVICES = { ...mergedList[g].SERVICES, ...sList[g].SERVICES };
                        else mergedList[g] = sList[g];
                    }
                    hasSuccess = true;
                }
            } else {
                const [r1, r2] = await Promise.all([
                    callGsmThemeApi(targetUrl, 'imeiservicelist', null, username, apiaccesskey).catch(e=>({})),
                    callGsmThemeApi(targetUrl, 'serverservicelist', null, username, apiaccesskey).catch(e=>({}))
                ]);
                if (r1.data && r1.data.SUCCESS && r1.data.SUCCESS[0] && r1.data.SUCCESS[0].LIST) {
                    mergedList = { ...r1.data.SUCCESS[0].LIST }; hasSuccess = true;
                }
                if (r2.data && r2.data.SUCCESS && r2.data.SUCCESS[0] && r2.data.SUCCESS[0].LIST) {
                    const sList = r2.data.SUCCESS[0].LIST;
                    for (const g in sList) {
                        if (mergedList[g]) mergedList[g].SERVICES = { ...mergedList[g].SERVICES, ...sList[g].SERVICES };
                        else mergedList[g] = sList[g];
                    }
                    hasSuccess = true;
                }
            }
            if (hasSuccess) {
                catalogCache[serverKey].data = JSON.parse(JSON.stringify(mergedList));
                catalogCache[serverKey].lastFetch = Date.now();
                list = catalogCache[serverKey].data;
            } else {
                list = {};
            }
        } catch (e) {
            list = {};
        }
    } else {
        list = {};
    }
  }
  
  if (query === 'debug') {
      return res.json({ 
          results: [{ 
              id: '999', 
              name: `DEBUG: serverKey=${serverKey}, list_exists=${!!list}, groups=${list ? Object.keys(list).length : 0}`, 
              price: 0 
          }] 
      });
  }
  
  const results = [];
  const q = query.toLowerCase();
  
  for (const g in list) {
    if (list[g].SERVICES) {
      const srvs = Array.isArray(list[g].SERVICES) ? list[g].SERVICES : Object.values(list[g].SERVICES);
      for (const s of srvs) {
        if (!s) continue;
        const name = (s.SERVICENAME || s.SERVICE_NAME || s.name || '').toLowerCase();
        if (name.includes(q)) {
          const serviceid = s.SERVICEID || s.serviceid;
          
          let realCost = prices[serviceid] !== undefined ? prices[serviceid] : null;
          if (realCost === null) {
            const exchangeRate = parseFloat(settingsDb.exchangeRate || 17.60);
            const rate = serverId === '3' ? 1 : exchangeRate;
            realCost = parseFloat(s.CREDIT || '0') * rate;
          }
          
          let resellerCost;
          const ucp = serverUserCustomPrices[serviceid] && serverUserCustomPrices[serviceid][req.user.id];
          if (ucp && ucp.resellerPrice !== undefined) {
            resellerCost = parseFloat(ucp.resellerPrice);
          } else if (customPrices[serviceid]) {
            resellerCost = parseFloat(customPrices[serviceid].resellerPrice);
          } else {
            const activeMarkup = (req.user.markup !== null && req.user.markup !== undefined && !isNaN(req.user.markup)) ? parseFloat(req.user.markup) : parseFloat(settings.resellerMarkup || 0);
            resellerCost = Math.ceil(realCost + activeMarkup);
          }
          
          results.push({ id: serviceid, name: s.SERVICENAME || s.SERVICE_NAME || s.name, price: resellerCost });
        }
      }
    }
  }
  
  results.sort((a, b) => a.price - b.price);
  return res.json({ results: results.slice(0, 20) });
});

app.post('/api/bot/service_info', requireBotSecret, async (req, res) => {
  const { serviceid } = req.body;
  if (!serviceid) return res.status(400).json({ error: 'Missing serviceid' });
  
  const serverId = getServerId(req);
  const serverKey = 'server' + serverId;
  let list = (catalogCache[serverKey] && catalogCache[serverKey].data) ? catalogCache[serverKey].data : null;
  
  if (!list) {
    const settingsDb = readDB('settings.json') || {};
    const settings = getServerSettings(settingsDb, serverId);
    if (settings && settings.username && settings.apiaccesskey) {
        const { apiaccesskey, username, endpoint } = settings;
        let targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';
        try {
            let mergedList = {};
            let hasSuccess = false;
            if (serverId === '1' || serverId === '3') {
                const p1 = new URLSearchParams(); p1.append('username', username); p1.append('apiaccesskey', apiaccesskey); p1.append('action', 'imeiservicelist'); p1.append('requestformat', 'JSON');
                const p2 = new URLSearchParams(); p2.append('username', username); p2.append('apiaccesskey', apiaccesskey); p2.append('action', 'serverservicelist'); p2.append('requestformat', 'JSON');
                const [r1, r2] = await Promise.all([
                    axios.post(targetUrl, p1.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }).catch(e=>({})),
                    axios.post(targetUrl, p2.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }).catch(e=>({}))
                ]);
                if (r1.data && r1.data.SUCCESS && r1.data.SUCCESS[0] && r1.data.SUCCESS[0].LIST) {
                    mergedList = { ...r1.data.SUCCESS[0].LIST }; hasSuccess = true;
                }
                if (r2.data && r2.data.SUCCESS && r2.data.SUCCESS[0] && r2.data.SUCCESS[0].LIST) {
                    const sList = r2.data.SUCCESS[0].LIST;
                    for (const g in sList) {
                        if (mergedList[g]) mergedList[g].SERVICES = { ...mergedList[g].SERVICES, ...sList[g].SERVICES };
                        else mergedList[g] = sList[g];
                    }
                    hasSuccess = true;
                }
            } else {
                const [r1, r2] = await Promise.all([
                    callGsmThemeApi(targetUrl, 'imeiservicelist', null, username, apiaccesskey).catch(e=>({})),
                    callGsmThemeApi(targetUrl, 'serverservicelist', null, username, apiaccesskey).catch(e=>({}))
                ]);
                if (r1.data && r1.data.SUCCESS && r1.data.SUCCESS[0] && r1.data.SUCCESS[0].LIST) {
                    mergedList = { ...r1.data.SUCCESS[0].LIST }; hasSuccess = true;
                }
                if (r2.data && r2.data.SUCCESS && r2.data.SUCCESS[0] && r2.data.SUCCESS[0].LIST) {
                    const sList = r2.data.SUCCESS[0].LIST;
                    for (const g in sList) {
                        if (mergedList[g]) mergedList[g].SERVICES = { ...mergedList[g].SERVICES, ...sList[g].SERVICES };
                        else mergedList[g] = sList[g];
                    }
                    hasSuccess = true;
                }
            }
            if (hasSuccess) {
                if (!catalogCache[serverKey]) catalogCache[serverKey] = {};
                catalogCache[serverKey].data = JSON.parse(JSON.stringify(mergedList));
                list = catalogCache[serverKey].data;
            } else {
                list = {};
            }
        } catch (e) {
            list = {};
        }
    } else {
        list = {};
    }
  }
  
  for (const g in list) {
    if (list[g].SERVICES) {
      const srvs = Array.isArray(list[g].SERVICES) ? list[g].SERVICES : Object.values(list[g].SERVICES);
      const s = srvs.find(x => x && (x.SERVICEID == serviceid || x.serviceid == serviceid));
      if (s) {
        const settingsDb = readDB('settings.json') || {};
        const settings = getServerSettings(settingsDb, serverId);
        const prices = readDB('prices_' + serverId + '.json') || {};
        const allCustomPrices = readDB('custom_prices.json') || {};
        const customPrices = allCustomPrices['server' + serverId] || {};
        const allUserCustomPrices = readDB('user_custom_prices.json') || {};
        const serverUserCustomPrices = allUserCustomPrices['server' + serverId] || {};
        
        let realCost = prices[serviceid] !== undefined ? prices[serviceid] : null;
        if (realCost === null) {
          const exchangeRate = parseFloat(settingsDb.exchangeRate || 17.60);
          const rate = serverId === '3' ? 1 : exchangeRate;
          realCost = parseFloat(s.CREDIT || '0') * rate;
        }
        
        let resellerCost;
        const ucp = serverUserCustomPrices[serviceid] && serverUserCustomPrices[serviceid][req.user.id];
        if (ucp && ucp.resellerPrice !== undefined) {
          resellerCost = parseFloat(ucp.resellerPrice);
        } else if (customPrices[serviceid]) {
          resellerCost = parseFloat(customPrices[serviceid].resellerPrice);
        } else {
          const activeMarkup = (req.user.markup !== null && req.user.markup !== undefined && !isNaN(req.user.markup)) ? parseFloat(req.user.markup) : parseFloat(settings.resellerMarkup);
          resellerCost = Math.ceil(realCost + activeMarkup);
        }
        
        const requiresImei = s.REQUIRES_IMEI === "1" || s.requires_imei === "1" || s.requires_imei === true || (s.service_type && s.service_type.toLowerCase() === 'imei');
        const requiresSn = s.REQUIRES_SN === "1" || s.requires_sn === "1" || s.requires_sn === true || (s.service_type && s.service_type.toLowerCase() === 'sn');
        let serviceType = requiresImei ? 'IMEI' : (requiresSn ? 'SN' : 'DATA');
        
        let customField = null;
        let customArr = s['Requires.Custom'] || s.requires_custom || s['REQUIRES.CUSTOM'];
        if (customArr && Array.isArray(customArr) && customArr.length > 0) {
            customField = customArr[0].fieldname || customArr[0].name;
        }
        
        const advancedParams = {
            QNT: s.QNT || "0",
            MINQNT: s.MINQNT || "1",
            MAXQNT: s.MAXQNT || "9999",
            CUSTOM: s.CUSTOM || {},
            IMEINAME: s.IMEINAME || s.CUSTOM_IMEI || null
        };

        return res.json({ id: serviceid, name: s.SERVICENAME || s.SERVICE_NAME || s.name, price: resellerCost, type: serviceType, customField, ...advancedParams });
      }
    }
  }
  return res.status(404).json({ error: 'Service not found' });
});

app.post('/api/bot/order', requireBotSecret, processOrder);


// --- ADMIN ENDPOINTS ---

// Manage Users (Admin Only)
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  const serverId = getServerId(req);
  const users = readDB('users.json') || [];
  // Return users without exposing passwords
  res.json(users.map(u => {
     const currentCredits = getUserCredit(u, serverId);
     const credits1 = getUserCredit(u, '1');
     const credits2 = getUserCredit(u, '2');
     const credits3 = getUserCredit(u, '3');
     return { 
       id: u.id, 
       username: u.username, 
       role: u.role, 
       credits: currentCredits, 
       credits1: credits1,
       credits2: credits2,
       credits3: credits3,
       createdAt: u.createdAt, 
       password: u.password, 
       markup: u.markup 
     };
  }));
});

app.put('/api/users/:id/password', requireAuth, (req, res) => {
  const { password } = req.body;
  const userId = String(req.params.id);
  
  // User can only change their own password, unless they are admin
  if (req.user.role !== 'admin' && String(req.user.id) !== userId) {
    return res.status(403).json({ error: 'Permiso denegado' });
  }
  
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Contraseña demasiado corta (mínimo 4 caracteres)' });
  }
  
  const users = readDB('users.json') || [];
  const userIndex = users.findIndex(u => String(u.id) === userId);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  
  users[userIndex].password = password;
  writeDB('users.json', users);
  
  res.json({ success: true });
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const { username, password, credits, role, markup } = req.body;
  const users = readDB('users.json') || [];
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  const newUser = {
    id: Date.now(),
    username,
    password,
    role: role || 'reseller',
    markup: markup !== undefined && markup !== '' ? parseFloat(markup) : null,
    credits_1: parseFloat(credits) || 0,
    credits_2: 0,
    credits_3: 0,
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  writeDB('users.json', users);
  createAutoBackup('Nuevo_Usuario');
  catalogVersion++;
  res.json(newUser);
});

app.put('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  const { credits, password, role, markup } = req.body;
  const serverId = getServerId(req);
  const users = readDB('users.json') || [];
  const user = users.find(u => String(u.id) === String(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (credits !== undefined) {
    const oldCredit = getUserCredit(user, serverId);
    setUserCredit(user, serverId, credits);
    
    if (parseFloat(credits) !== oldCredit) {
      const isAdd = parseFloat(credits) > oldCredit;
      const amount = Math.abs(parseFloat(credits) - oldCredit);
      const settingsDb = readDB('settings.json') || {};
      const exRate = parseFloat(settingsDb.exchangeRate || 17.6);
      const usdEq = (amount / exRate).toFixed(3);
      
      const resMsg = `💰 *${isAdd ? 'RECARGA EXITOSA' : 'SALDO DESCONTADO'}*\n\n📥 Tu saldo ha sido actualizado correctamente\n\n💳 Método: Ajuste de Panel\n💵 Monto: $${amount.toFixed(2)} MXN\n💱 Equivalente USD: $${usdEq} USD\n💱 Tipo de cambio: ${exRate} MXN por USD\n✅ Saldo acreditado: $${amount.toFixed(2)} MXN\n📉 Saldo anterior: $${oldCredit.toFixed(2)} MXN\n📈 Saldo actual: $${parseFloat(credits).toFixed(2)} MXN\n\n━━━━━━━━━━━━━━\n🌐 MegaUnlockPhone`;
      enqueueWhatsApp('private', resMsg, user.id);
      
      const adminMsg = `🤑 *Notificación de Saldo (Admin)*\n\nSe ha ${isAdd ? 'agregado' : 'descontado'} $${amount.toFixed(2)} al usuario *${user.username}* en *${getServerDisplayName(serverId)}*.\nNuevo saldo: $${parseFloat(credits).toFixed(2)}`;
      enqueueWhatsApp('group', adminMsg);
    }
  }
  if (password) user.password = password;
  if (role && user.role !== role) {
    const oldRole = user.role || 'reseller';
    if (role === 'colaborador') {
      const msg = `🎉 *¡Felicidades!*\n\nTu cuenta ha sido promovida a *Colaborador*.\nAhora tienes acceso para ajustar los precios de venta para clientes y revendedores.`;
      enqueueWhatsApp('private', msg, user.id);
    }
    const adminMsgRole = `👤 *Cambio de Rol (Admin)*\nEl usuario *${user.username}* ha cambiado de rol.\nDe: ${oldRole.toUpperCase()}\nA: ${role.toUpperCase()}`;
    enqueueWhatsAppAdmin(adminMsgRole);
    user.role = role;
  }
  if (markup !== undefined) {
    user.markup = (markup === '' || markup === null) ? null : parseFloat(markup);
  }

  writeDB('users.json', users);
  createAutoBackup('Actualizacion_Saldo_O_Clave_S' + serverId);
  catalogVersion++;
  res.json(user);
});

app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  const users = readDB('users.json') || [];
  if (String(req.params.id) === String(req.user.id)) return res.status(400).json({ error: 'Cannot delete yourself' });
  
  const newUsers = users.filter(u => String(u.id) !== String(req.params.id));
  writeDB('users.json', newUsers);
  createAutoBackup('Eliminacion_Usuario');
  res.json({ success: true });
});

// Admin Dashboard Stats
app.get('/api/admin/stats', requireAuth, requireAdmin, (req, res) => {
  const settings = readDB('settings.json') || {};
  res.json({ profitBalance: settings.adminProfitBalance || 0 });
});

// Admin Settings
app.get('/api/admin/settings', requireAuth, requireAdmin, (req, res) => {
  const settings = readDB('settings.json') || {};
  
  // SANITIZE: Never send sensitive API keys to the frontend!
  const safeSettings = { exchangeRate: settings.exchangeRate || 17.60 };
  
  if (settings.server1) safeSettings.server1 = { resellerMarkup: settings.server1.resellerMarkup, clientMarkup: settings.server1.clientMarkup };
  if (settings.server2) safeSettings.server2 = { resellerMarkup: settings.server2.resellerMarkup, clientMarkup: settings.server2.clientMarkup };
  if (settings.server3) safeSettings.server3 = { resellerMarkup: settings.server3.resellerMarkup, clientMarkup: settings.server3.clientMarkup };
  
  res.json(safeSettings);
});

// WhatsApp Bot Admin Controls
app.post('/api/admin/bot/start', requireAuth, requireAdmin, (req, res) => {
  const { exec, spawn } = require('child_process');
  
  // Siempre matamos cualquier zombie primero para evitar el error 400
  exec('pkill -9 -f "node whatsappBot.js"', () => {
    try {
      const out = fs.openSync(path.join(__dirname, 'bot_logs.txt'), 'a');
      const errLog = fs.openSync(path.join(__dirname, 'bot_logs.txt'), 'a');
      
      // Usar process.execPath garantiza que usamos la misma ruta exacta de Node.js
      // que está ejecutando el server.js, evitando errores si NVM cambia de versión.
      const child = spawn(process.execPath, ['whatsappBot.js'], {
        detached: true,
        cwd: __dirname,
        stdio: [ 'ignore', out, errLog ]
      });
      
      child.on('error', (err) => {
        fs.appendFileSync(path.join(__dirname, 'bot_logs.txt'), 'Error al spawnear bot: ' + err.message + '\\n');
      });
      
      child.unref();
      res.json({ message: 'Bot encendido forzosamente exitoso (PID: ' + child.pid + '). Tardará 1-2 minutos en conectarse.' });
    } catch (e) {
      res.status(500).json({ error: 'Error al iniciar el bot: ' + e.message });
    }
  });
});

app.post('/api/admin/bot/stop', requireAuth, requireAdmin, (req, res) => {
  const { exec } = require('child_process');
  exec('pkill -9 -f "node whatsappBot.js"', (err) => {
    // pkill returns error if no process matched, we can ignore it
    res.json({ message: 'Se envió la orden de apagar al bot.' });
  });
});

app.get('/api/admin/bot/logs', requireAuth, requireAdmin, (req, res) => {
  try {
    const logPath = path.join(__dirname, 'bot_logs.txt');
    if (!fs.existsSync(logPath)) return res.json({ logs: 'No hay logs todavía.' });
    
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.trim().split('\\n');
    const lastLines = lines.slice(-30).join('\\n'); // Last 30 lines
    res.json({ logs: lastLines || 'Logs vacíos.' });
  } catch (e) {
    res.status(500).json({ error: 'Error leyendo logs: ' + e.message });
  }
});

app.post('/api/admin/settings', requireAuth, requireAdmin, (req, res) => {
  const { server1, server2, server3, exchangeRate } = req.body;
  const settings = readDB('settings.json') || {};
  if (server1) {
    settings.server1 = settings.server1 || {};
    settings.server1.resellerMarkup = parseFloat(server1.resellerMarkup) || 0;
    settings.server1.clientMarkup = parseFloat(server1.clientMarkup) || 0;
  }
  if (server2) {
    settings.server2 = settings.server2 || {};
    settings.server2.resellerMarkup = parseFloat(server2.resellerMarkup) || 0;
    settings.server2.clientMarkup = parseFloat(server2.clientMarkup) || 0;
  }
  if (server3) {
    settings.server3 = settings.server3 || {};
    settings.server3.resellerMarkup = parseFloat(server3.resellerMarkup) || 0;
    settings.server3.clientMarkup = parseFloat(server3.clientMarkup) || 0;
  }
  if (exchangeRate !== undefined) {
    settings.exchangeRate = parseFloat(exchangeRate) || 17.60;
  }
  writeDB('settings.json', settings);
  catalogVersion++;
  res.json(settings);
});

app.post('/api/admin/toggle-service', requireAuth, requireAdminOrColaborador, (req, res) => {
  const { serviceid, disabled } = req.body;
  const serverId = getServerId(req);
  if (!serviceid) return res.status(400).json({ error: 'Falta serviceid' });

  const disabledDb = readDB('disabled_services.json') || {};
  if (!disabledDb['server' + serverId]) disabledDb['server' + serverId] = [];
  
  if (disabled) {
    if (!disabledDb['server' + serverId].includes(serviceid.toString())) {
      disabledDb['server' + serverId].push(serviceid.toString());
    }
  } else {
    disabledDb['server' + serverId] = disabledDb['server' + serverId].filter(id => id !== serviceid.toString());
  }

  writeDB('disabled_services.json', disabledDb);
  catalogVersion++;
  res.json({ success: true, disabled });
});

app.post('/api/admin/product-price', requireAuth, requireAdminOrColaborador, (req, res) => {
  const { serviceid, resellerPrice, clientPrice, bulk } = req.body;
  const serverId = getServerId(req);
  const allCustomPrices = readDB('custom_prices.json') || {};
  const serverKey = 'server' + serverId;
  const prices = readDB('prices_' + serverId + '.json') || {};
  if (!allCustomPrices[serverKey]) allCustomPrices[serverKey] = {};

  // Handle bulk save
  if (bulk && Array.isArray(bulk)) {
    for (const item of bulk) {
      if (item.serviceId && item.resellerPrice !== undefined && item.clientPrice !== undefined) {
        const rp = parseFloat(item.resellerPrice);
        const cp = parseFloat(item.clientPrice);
        const realCost = prices[item.serviceId] || 0;
        if (rp < realCost || cp < realCost) {
          return res.status(400).json({ error: `El precio para ${item.serviceId} no puede ser menor al costo API ($${realCost}).` });
        }
        allCustomPrices[serverKey][item.serviceId] = {
          resellerPrice: rp,
          clientPrice: cp
        };
      }
    }
    writeDB('custom_prices.json', allCustomPrices);
    catalogVersion++;
    return res.json({ success: true, count: bulk.length });
  }

  // Handle single save
  if (!serviceid || resellerPrice === undefined || clientPrice === undefined) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const rp = parseFloat(resellerPrice);
  const cp = parseFloat(clientPrice);
  const realCost = prices[serviceid] || 0;
  if (rp < realCost || cp < realCost) {
    return res.status(400).json({ error: `El precio no puede ser menor al costo API ($${realCost}).` });
  }

  allCustomPrices[serverKey][serviceid] = {
    resellerPrice: rp,
    clientPrice: cp
  };

  writeDB('custom_prices.json', allCustomPrices);
  catalogVersion++;
  res.json({ success: true, prices: allCustomPrices[serverKey][serviceid] });
});

app.delete('/api/admin/product-price/:serviceid', requireAuth, requireAdminOrColaborador, (req, res) => {
  const { serviceid } = req.params;
  const serverId = getServerId(req);
  const allCustomPrices = readDB('custom_prices.json') || {};
  const serverKey = 'server' + serverId;

  if (allCustomPrices[serverKey] && allCustomPrices[serverKey][serviceid]) {
    delete allCustomPrices[serverKey][serviceid];
    writeDB('custom_prices.json', allCustomPrices);
    catalogVersion++;
  }
  res.json({ success: true });
});

app.get('/api/admin/user-product-prices/:serviceid', requireAuth, requireAdminOrColaborador, (req, res) => {
  const { serviceid } = req.params;
  const serverId = getServerId(req);
  const allUserCustomPrices = readDB('user_custom_prices.json') || {};
  
  const serverPrices = allUserCustomPrices['server' + serverId] || {};
  const servicePrices = serverPrices[serviceid] || {};
  
  res.json(servicePrices);
});

app.post('/api/admin/user-product-prices/:serviceid', requireAuth, requireAdmin, (req, res) => {
  const { serviceid } = req.params;
  const { userPrices } = req.body;
  const serverId = getServerId(req);
  
  if (!userPrices || typeof userPrices !== 'object') {
    return res.status(400).json({ error: 'Invalid userPrices object' });
  }

  const allUserCustomPrices = readDB('user_custom_prices.json') || {};
  const serverKey = 'server' + serverId;
  
  if (!allUserCustomPrices[serverKey]) {
    allUserCustomPrices[serverKey] = {};
  }
  
  allUserCustomPrices[serverKey][serviceid] = userPrices;
  
  writeDB('user_custom_prices.json', allUserCustomPrices);
  catalogVersion++; // Increment version to trigger client reload
  res.json({ success: true });
});

app.get('/api/status', (req, res) => {
  res.json({ version: catalogVersion });
});

app.get('/api/admin/backup', requireAuth, requireAdmin, (req, res) => {
  const users = readDB('users.json') || [];
  const history = readDB('history.json') || [];
  const prices = readDB('prices.json') || {};
  const customPrices = readDB('custom_prices.json') || {};
  const userCustomPrices = readDB('user_custom_prices.json') || {};
  const settings = readDB('settings.json') || {};
  const coupons = readDB('coupons.json') || [];
  
  res.json({
    users,
    history,
    prices,
    customPrices,
    userCustomPrices,
    settings,
    coupons,
    exportDate: new Date().toISOString()
  });
});

// Restore: Cargar base de datos
app.post('/api/admin/restore', requireAuth, requireAdmin, (req, res) => {
  const backup = req.body;
  if (!backup || typeof backup !== 'object') {
    return res.status(400).json({ error: 'Archivo de respaldo inválido.' });
  }

  try {
    if (backup.users) writeDB('users.json', backup.users);
    if (backup.history) writeDB('history.json', backup.history);
    if (backup.prices) writeDB('prices.json', backup.prices);
    if (backup.customPrices) writeDB('custom_prices.json', backup.customPrices);
    if (backup.userCustomPrices) writeDB('user_custom_prices.json', backup.userCustomPrices);
    if (backup.settings) writeDB('settings.json', backup.settings);
    if (backup.coupons) writeDB('coupons.json', backup.coupons);
    
    // Also clear memory session if we restored users (to force re-login or clear ghosts)
    for (let token in sessions) {
      if (sessions[token].role !== 'admin') {
        delete sessions[token];
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Restore Error:', err);
    res.status(500).json({ error: 'Error al restaurar el archivo.' });
  }
});

// Autobackups APIs
app.get('/api/admin/autobackups', requireAuth, requireAdmin, (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return res.json([]);
    let files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json') && f.startsWith('autobackup_'));
    // Sort descending by timestamp (newest first)
    files.sort().reverse();
    
    const fileData = files.map(filename => {
      const stats = fs.statSync(path.join(BACKUP_DIR, filename));
      return {
        filename,
        size: stats.size,
        date: stats.mtime
      };
    });
    res.json(fileData);
  } catch(e) {
    res.status(500).json({ error: 'Error al leer backups automáticos.' });
  }
});

app.get('/api/admin/autobackups/:filename', requireAuth, requireAdmin, (req, res) => {
  const filename = req.params.filename;
  if (!filename.startsWith('autobackup_') || !filename.endsWith('.json')) {
    return res.status(400).json({ error: 'Archivo inválido.' });
  }
  const filepath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Respaldo no encontrado.' });
  }
  res.download(filepath);
});

// Debug endpoint to write client history to disk
// Debug endpoint to write client history to disk
app.post('/api/debug/history', (req, res) => {
  const fs = require('fs');
  fs.writeFileSync(path.join(__dirname, 'client_history_debug.json'), JSON.stringify(req.body, null, 2));
  return res.json({ success: true });
});

// --- BOT API ENDPOINT: CHECK SERVICE INFO ---
app.post('/api/bot/saldo', async (req, res) => {
  try {
    const { botSecret, userId } = req.body;
    if (botSecret !== 'MEGA_BOT_SECRET_2026') return res.status(403).json({ error: 'Unauthorized bot' });

    const users = readDB('users.json') || [];
    const user = users.find(u => u.id === userId);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized user' });

    const settingsDb = readDB('settings.json') || {};
    let balances = {};

    for (let sId of ['1', '2', '3']) {
      const conf = settingsDb['server' + sId];
      if (!conf || !conf.apiaccesskey) {
        balances[sId] = { error: 'No configurado' };
        continue;
      }
      
      let targetUrl = conf.endpoint;
      if (!targetUrl) {
          targetUrl = sId === '3' ? 'https://megaunlockphone-panel.alwaysdata.net/api/index.php' : 'https://latamgsm.com/dhru/';
      }
      if (!targetUrl.includes('/api/')) {
        targetUrl = targetUrl.endsWith('/') ? `${targetUrl}api/index.php` : `${targetUrl}/api/index.php`;
      } else if (targetUrl.endsWith('/api/')) {
        targetUrl += 'index.php';
      }

      try {
        const params = new URLSearchParams();
        params.append('username', conf.username);
        params.append('apiaccesskey', conf.apiaccesskey);
        params.append('action', 'accountinfo');
        params.append('requestformat', 'JSON');
        
        const response = await axios.post(targetUrl, params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' },
          timeout: 10000
        });
        
        const exRate = parseFloat(settingsDb.exchangeRate || 17.60);
        const rate = sId === '3' ? 1 : exRate;
        const real = parseFloat(response.data?.SUCCESS?.[0]?.AccountInfo?.creditraw || 0) * rate;
        
        let cedido = 0;
        users.forEach(u => {
          if (u.role !== 'admin' && u['credits_' + sId]) {
            cedido += parseFloat(u['credits_' + sId]);
          }
        });
        
        balances[sId] = { real, cedido, disp: real - cedido };
      } catch (e) {
        balances[sId] = { error: 'Error de conexión' };
      }
    }

    res.json({ balances });
  } catch (globalError) {
    res.status(500).json({ error: 'Crash Server: ' + globalError.message, stack: globalError.stack });
  }
});

// --- BOT API ENDPOINT: ADD MONEY ---
app.post('/api/bot/add_money', async (req, res) => {
  try {
    const { botSecret, adminId, resellerId, serverId, amount } = req.body;
    if (botSecret !== 'MEGA_BOT_SECRET_2026') return res.status(403).json({ error: 'Unauthorized bot' });

    let users = readDB('users.json') || [];
    const adminUser = users.find(u => u.id === adminId && u.role === 'admin');
    if (!adminUser) return res.status(403).json({ error: 'Unauthorized admin' });

    const resellerIdx = users.findIndex(u => u.id === resellerId && u.role !== 'admin');
    if (resellerIdx === -1) return res.status(404).json({ error: 'Reseller not found' });

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount === 0) return res.status(400).json({ error: 'Monto inválido' });

    const creditKey = 'credits_' + serverId;
    let currentCredit = parseFloat(users[resellerIdx][creditKey] || 0);
    
    if (currentCredit + numAmount < 0) return res.status(400).json({ error: 'El usuario no tiene suficiente saldo para descontar esa cantidad.' });

    users[resellerIdx][creditKey] = currentCredit + numAmount;
    
    writeDB('users.json', users);
    
    // Notificamos al reseller si tiene WhatsApp vinculado
    let msgToReseller = '';
    let groupMsg = '';
    if (numAmount > 0) {
        msgToReseller = `💰 *¡RECARGA EXITOSA!*\n\nTu administrador ha agregado *+$${numAmount.toFixed(2)} MXN* a tu saldo en ${getServerDisplayName(serverId)}.\n\n💳 *Saldo actual (${getServerDisplayName(serverId)}):* $${users[resellerIdx][creditKey].toFixed(2)} MXN\n\n_¡A desbloquear se ha dicho!_ 🚀`;
        groupMsg = `💰 *RECARGA APROBADA*\n━━━━━━━━━━━━━━━━━━━━━━\n👮 *Admin:* ${adminUser.username}\n👤 *Revendedor:* ${users[resellerIdx].username}\n🏢 *Servidor:* ${getServerDisplayName(serverId)}\n💲 *Monto:* +$${numAmount.toFixed(2)} MXN\n━━━━━━━━━━━━━━━━━━━━━━`;
    } else {
        msgToReseller = `📉 *REDUCCIÓN DE SALDO*\n\nTu administrador ha descontado *-$${Math.abs(numAmount).toFixed(2)} MXN* de tu saldo en ${getServerDisplayName(serverId)}.\n\n💳 *Saldo actual (${getServerDisplayName(serverId)}):* $${users[resellerIdx][creditKey].toFixed(2)} MXN`;
        groupMsg = `📉 *RETIRO DE SALDO*\n━━━━━━━━━━━━━━━━━━━━━━\n👮 *Admin:* ${adminUser.username}\n👤 *Revendedor:* ${users[resellerIdx].username}\n🏢 *Servidor:* ${getServerDisplayName(serverId)}\n💲 *Monto:* -$${Math.abs(numAmount).toFixed(2)} MXN\n━━━━━━━━━━━━━━━━━━━━━━`;
    }
    enqueueWhatsApp('private', msgToReseller, users[resellerIdx].id);
    enqueueWhatsApp('group', groupMsg);

    if (numAmount > 0) {
      logRecharge(users[resellerIdx].id, users[resellerIdx].username, numAmount, 'MANUAL_BOT', adminUser.username, serverId);
    }

    res.json({ success: true, newBalance: users[resellerIdx][creditKey], resellerName: users[resellerIdx].username });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Proxy Image to bypass CORS for html2canvas
// --- SPEI Automated Top-Up APIs ---

// Payments Endpoints Modularized
require('./src/payments')(app, { requireAuth, readDB, writeDB, enqueueWhatsApp });



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

// --- BOT API ENDPOINT: CHECK SERVICE INFO ---
app.post('/api/bot/service_info', async (req, res) => {
  const { botSecret, userId, serverId, serviceid } = req.body;
  if (botSecret !== 'MEGA_BOT_SECRET_2026') return res.status(403).json({ error: 'Unauthorized bot' });

  const users = readDB('users.json') || [];
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(403).json({ error: 'Unauthorized user' });

  const settingsDb = readDB('settings.json') || {};
  let targetUrl, username, apiaccesskey, markup = 0;

  if (serverId === '3') {
    const conf = settingsDb.server3 || {};
    targetUrl = conf.endpoint;
    if (!targetUrl) return res.status(404).json({ error: 'Servidor no configurado' });
    username = conf.username;
    apiaccesskey = conf.apiaccesskey;
    if (!targetUrl.includes('/api/')) {
      targetUrl = targetUrl.endsWith('/') ? `${targetUrl}api/index.php` : `${targetUrl}/api/index.php`;
    } else if (targetUrl.endsWith('/api/')) {
      targetUrl += 'index.php';
    }
    markup = user.role === 'client' ? (conf.clientMarkup || 0) : (conf.resellerMarkup || 0);
  } else {
    const conf = serverId === '2' ? settingsDb.server2 : settingsDb.server1;
    if (!conf) return res.status(404).json({ error: 'Servidor no configurado' });
    targetUrl = conf.endpoint;
    username = conf.username;
    apiaccesskey = conf.apiaccesskey;
    if (!targetUrl) targetUrl = 'https://latamgsm.com/dhru/';
    if (!targetUrl.includes('/api/')) {
      targetUrl = targetUrl.endsWith('/') ? `${targetUrl}api/index.php` : `${targetUrl}/api/index.php`;
    } else if (targetUrl.endsWith('/api/')) {
      targetUrl += 'index.php';
    }
    markup = user.role === 'client' ? (conf.clientMarkup || 0) : (conf.resellerMarkup || 0);
  }

  try {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('apiaccesskey', apiaccesskey);
    params.append('action', 'serviceinfo');
    params.append('requestformat', 'JSON');
    params.append('parameters', `<PARAMETERS><SERVICEID>${serviceid}</SERVICEID></PARAMETERS>`);
    
    const response = await axios.post(targetUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' },
      timeout: 10000
    });
    
    if (response.data.ERROR) return res.status(400).json({ error: response.data.ERROR[0]?.MESSAGE || 'Error API' });
    
    const sInfo = response.data.SUCCESS?.[0]?.LIST;
    if (!sInfo) return res.status(404).json({ error: 'Servicio no encontrado' });

    const exchangeRate = parseFloat(settingsDb.exchangeRate || 17.60);
    const rate = serverId === '3' ? 1 : exchangeRate;
    
    const basePrice = parseFloat(sInfo.CREDIT || 0);
    const finalPrice = (basePrice + markup) * rate;

    let customField = null;
    let customArr = sInfo['Requires.Custom'] || sInfo.requires_custom || sInfo['REQUIRES.CUSTOM'];
    if (customArr && Array.isArray(customArr) && customArr.length > 0) {
      customField = customArr[0].fieldname || customArr[0].name;
    }

    res.json({
      id: sInfo.SERVICEID,
      name: sInfo.SERVICENAME,
      price: finalPrice,
      type: sInfo.TYPE || 'IMEI',
      customField: customField
    });
  } catch (e) {
    res.status(500).json({ error: 'Fallo al comunicarse con el proveedor' });
  }
});

// --- COUPONS API (Admin Only) ---
app.get('/api/admin/coupons', requireAuth, requireAdmin, (req, res) => {
  const coupons = readDB('coupons.json') || [];
  res.json(coupons);
});

app.post('/api/admin/coupons', requireAuth, requireAdmin, (req, res) => {
  const { serviceName, normalPrice, promoPrice, showPercentage, conditions, maxRedemptions, imageUrl } = req.body;
  if (!serviceName || !promoPrice) {
    return res.status(400).json({ error: 'Faltan datos requeridos (Servicio y Precio Promo)' });
  }

  // Generate unique code like MEGA-XXXX-XXXX
  const code = 'MEGA-' + Math.random().toString(36).substr(2, 4).toUpperCase() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
  
  const newCoupon = {
    code,
    serviceName,
    imageUrl: imageUrl || '',
    normalPrice: normalPrice ? parseFloat(normalPrice) : null,
    promoPrice: parseFloat(promoPrice),
    showPercentage: !!showPercentage,
    conditions: conditions || '',
    maxRedemptions: parseInt(maxRedemptions) || 1,
    currentRedemptions: 0,
    status: 'active', // 'active', 'redeemed'
    createdAt: new Date().toISOString(),
    redeemedAt: null,
    redeemedBy: null
  };

  let coupons = readDB('coupons.json') || [];
  coupons.unshift(newCoupon);
  writeDB('coupons.json', coupons);
  createAutoBackup('Nuevo_Cupon');

  res.json({ success: true, coupon: newCoupon });
});

app.post('/api/admin/coupons/redeem', requireAuth, requireAdmin, (req, res) => {
  const { code, username } = req.body;
  if (!code || !username) {
    return res.status(400).json({ error: 'Falta código o usuario' });
  }

  let coupons = readDB('coupons.json') || [];
  const couponIndex = coupons.findIndex(c => c.code === code);
  
  if (couponIndex === -1) {
    return res.status(404).json({ error: 'Cupón no encontrado' });
  }
  
  if (coupons[couponIndex].status === 'redeemed' || (coupons[couponIndex].currentRedemptions || 0) >= (coupons[couponIndex].maxRedemptions || 1)) {
    return res.status(400).json({ error: 'El cupón ya ha alcanzado su límite de canjes' });
  }

  coupons[couponIndex].currentRedemptions = (coupons[couponIndex].currentRedemptions || 0) + 1;
  coupons[couponIndex].redeemedAt = new Date().toISOString();
  
  if (coupons[couponIndex].redeemedBy) {
    coupons[couponIndex].redeemedBy += ', ' + username;
  } else {
    coupons[couponIndex].redeemedBy = username;
  }

  if (coupons[couponIndex].currentRedemptions >= (coupons[couponIndex].maxRedemptions || 1)) {
    coupons[couponIndex].status = 'redeemed';
  }

  writeDB('coupons.json', coupons);
  createAutoBackup('Canje_Cupon');

  res.json({ success: true, coupon: coupons[couponIndex] });
});

app.delete('/api/admin/coupons/:code', requireAuth, requireAdmin, (req, res) => {
  const code = req.params.code;
  let coupons = readDB('coupons.json') || [];
  
  const filtered = coupons.filter(c => c.code !== code);
  if (filtered.length === coupons.length) {
    return res.status(404).json({ error: 'Cupón no encontrado' });
  }
  
  writeDB('coupons.json', filtered);
  createAutoBackup('Eliminar_Cupon');
  res.json({ success: true });
});

//// Permanent Wallet Migration on Startup
const startupUsers = readDB('users.json') || [];
let usersMigrated = false;
startupUsers.forEach(user => {
  if (user.credits_1 === undefined) {
    user.credits_1 = parseFloat(user.credits || 0);
    user.credits_2 = 0;
    user.credits_3 = 0;
    delete user.credits;
    usersMigrated = true;
  }
});
if (usersMigrated) {
  writeDB('users.json', startupUsers);
  console.log('Migrated legacy users to separated wallets.');
}
// ==========================================
// BACKGROUND POLLER FOR ORDER STATUS
// ==========================================
async function pollPendingOrders() {
  const history = readDB('history.json') || [];
  const settingsDb = readDB('settings.json') || {};
  
  const pendingByServer = {};
  history.forEach(order => {
    if (order.status === 'pending') {
      const sId = order.serverId || '1';
      if (!pendingByServer[sId]) pendingByServer[sId] = [];
      pendingByServer[sId].push(order);
    }
  });
  
  let hasUpdates = false;
  
  for (const sId of Object.keys(pendingByServer)) {
    const orders = pendingByServer[sId];
    if (orders.length === 0) continue;
    const settings = getServerSettings(settingsDb, sId);
    if (!settings || !settings.endpoint) continue;
    
    try {
      let bulkResults = {};
      
      const requests = orders.map(async (o) => {
        let action = o.serviceType === 'SERVER' ? 'getserverorder' : 'getimeiorder';
        if (sId === '1' || sId === '3') {
           const params = new URLSearchParams();
           params.append('username', settings.username);
           params.append('apiaccesskey', settings.apiaccesskey);
           params.append('action', action);
           params.append('requestformat', 'JSON');
           params.append('parameters', `<PARAMETERS><ID>${o.orderId}</ID></PARAMETERS>`);
           let res = await axios.post(targetUrl, params.toString(), {
             headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
           });
           
           if (res.data && res.data.SUCCESS) {
               const itemArr = Array.isArray(res.data.SUCCESS) ? res.data.SUCCESS : [res.data.SUCCESS];
               itemArr.forEach(item => {
                   bulkResults[String(item.REFERENCEID)] = {
                       status: String(item.STATUS) === '4' ? 'success' : (String(item.STATUS) === '3' ? 'failed' : 'pending'),
                       msg: item.REPLY || item.REJECT_REASON || item.CODE || item.MESSAGE || (String(item.STATUS) === '4' ? 'Completado' : (String(item.STATUS) === '3' ? 'Rechazado' : 'En proceso'))
                   };
               });
           }
        } else {
           const gsmParams = { ID: o.orderId };
           const res = await callGsmThemeApi(targetUrl, action, gsmParams, settings.username, settings.apiaccesskey);
           if (res && res.data && res.data.SUCCESS) {
               const itemArr = Array.isArray(res.data.SUCCESS) ? res.data.SUCCESS : [res.data.SUCCESS];
               itemArr.forEach(item => {
                   bulkResults[String(item.REFERENCEID || item.ID || o.orderId)] = {
                       status: String(item.STATUS) === '4' ? 'success' : (String(item.STATUS) === '3' ? 'failed' : 'pending'),
                       msg: item.REPLY || item.REJECT_REASON || item.CODE || item.MESSAGE || (String(item.STATUS) === '4' ? 'Completado' : (String(item.STATUS) === '3' ? 'Rechazado' : 'En proceso'))
                   };
               });
           }
        }
      });
      
      await Promise.all(requests);
      
      orders.forEach(order => {
          const remoteStatus = bulkResults[String(order.orderId)];
          if (remoteStatus && remoteStatus.status !== 'pending' && remoteStatus.status !== order.status) {
              const idx = history.findIndex(h => h.id === order.id);
              if (idx !== -1) {
                  history[idx].status = remoteStatus.status;
                  history[idx].statusText = remoteStatus.msg;
                  hasUpdates = true;
                  
                  let isSuccess = remoteStatus.status === 'success';
                  let headerIcon = isSuccess ? '✅ *SERVICIO COMPLETADO*' : '❌ *SERVICIO RECHAZADO*';
                  let statusTxt = isSuccess ? 'Completado' : 'Rechazado';
                  
                  let resMsg = `${headerIcon}\n━━━━━━━━━━━━━━━━━━━━━━\n`;
                  resMsg += `🆔 *Orden:* #${history[idx].orderId}\n`;
                  resMsg += `📱 *IMEI:* ${history[idx].imei || 'N/A'}\n`;
                  resMsg += `🔧 *Servicio:* ${history[idx].serviceName} ${isSuccess ? '✅' : '❌'}\n`;
                  resMsg += `💲 *Costo:* $${parseFloat(history[idx].resellerCost || history[idx].costCharged || 0).toFixed(2)} MXN\n`;
                  resMsg += `🔑 *Respuesta:* ${remoteStatus.msg}\n`;
                  resMsg += `🎉 *Estado:* ${statusTxt}\n\n`;
                  resMsg += `━━━━━━━━━━━━━━━━━━━━━━\n🌐 MegaUnlockPhone`;
                  
                  enqueueWhatsApp('private', resMsg, history[idx].userId);

                  let adminMsg = `🔄 ACTUALIZACIÓN AUTOMÁTICA\n━━━━━━━━━━━━━━━━━━━━━━\n#️⃣ Orden: #${history[idx].orderId}\n👨🏽💻 Usuario: ${history[idx].username}\n🔧 Servicio: ${history[idx].serviceName}\n📊 Estado: ${statusTxt} ${isSuccess ? '✅' : '❌'}\n━━━━━━━━━━━━━━━━━━━━━━`;
                  if (isSuccess || remoteStatus.status === 'failed') {
                      adminMsg = `👨🏽💻 Cliente: ${history[idx].username}\n${resMsg}`;
                  }
                  enqueueWhatsAppAdmin(adminMsg);
                  
                  let groupMsg = `🔄 ACTUALIZACIÓN AUTOMÁTICA\n━━━━━━━━━━━━━━━━━━━━━━\n#️⃣ Orden: #${history[idx].orderId}\n👨🏽💻 Usuario: ${history[idx].username}\n🔧 Servicio: ${history[idx].serviceName}\n📊 Estado: ${statusTxt} ${isSuccess ? '✅' : '❌'}\n━━━━━━━━━━━━━━━━━━━━━━`;
                  enqueueWhatsApp('group', groupMsg);
              }
          }
      });
    } catch (e) {
      console.error('Background poll error on server ' + sId, e.message);
    }
  }
  
  if (hasUpdates) {
    writeDB('history.json', history);
  }
}

setInterval(pollPendingOrders, 3 * 60 * 1000); // Poll every 3 minutes

// Cron endpoint to keep process alive and trigger polling (Use AlwaysData cron to ping this every 3 minutes)
app.get('/api/cron/sync', async (req, res) => {
  try {
    await pollPendingOrders();
    res.json({ status: 'ok', message: 'Sync cron executed' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});
// START SERVER
app.listen(PORT, IP, () => {
  console.log(`==================================================`);
  console.log(`Dhru Fusion Web Client running at http://localhost:${PORT}`);
  console.log(`==================================================`);
});
