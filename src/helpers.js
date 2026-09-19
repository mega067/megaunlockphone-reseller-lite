const axios = require('axios');

const SERVER_DISPLAY_NAMES = { '1': '⚡ MEGA-SERVER', '2': '🛡 ALPHA-SERVER', '3': '🔱 OMEGA-SERVER' };

function getServerDisplayName(id) { 
  return SERVER_DISPLAY_NAMES[String(id)] || 'Servidor ' + id; 
}

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
    // Server 1 (Omega Server) with legacy fallback support
    s = settings.server1 || {};
    s.endpoint = s.endpoint || settings.endpoint || "https://latamgsm.com/dhru/";
    s.username = s.username || settings.username || settings.masterUsername || "angeljuares067@gmail.com";
    s.apiaccesskey = s.apiaccesskey || settings.apiaccesskey || "pk60-qXSs-xXsF-qZPa";
  }

  s.resellerTier1 = parseFloat(s.resellerTier1 || settings.resellerTier1 || s.resellerMarkup || settings.resellerMarkup || 0);
  s.resellerTier2 = parseFloat(s.resellerTier2 || settings.resellerTier2 || s.resellerMarkup || settings.resellerMarkup || 0);
  s.resellerTier3 = parseFloat(s.resellerTier3 || settings.resellerTier3 || 0);
  
  s.clientTier1 = parseFloat(s.clientTier1 || settings.clientTier1 || s.clientMarkup || settings.clientMarkup || 0);
  s.clientTier2 = parseFloat(s.clientTier2 || settings.clientTier2 || s.clientMarkup || settings.clientMarkup || 0);
  s.clientTier3 = parseFloat(s.clientTier3 || settings.clientTier3 || 0);

  // Keep legacy properties for backward compatibility
  s.resellerMarkup = s.resellerTier1;
  s.clientMarkup = s.clientTier1;

  return s;
}

function calculateMarkup(basePrice, tier1 = 0, tier2 = 0, tier3 = 0) {
  const price = parseFloat(basePrice) || 0;
  let percentage = 0;
  
  if (price <= 100) {
    percentage = parseFloat(tier1) || 0;
  } else if (price <= 500) {
    percentage = parseFloat(tier2) || 0;
  } else {
    percentage = parseFloat(tier3) || 0;
  }
  
  return price * (percentage / 100);
}

function calculateGroupMarkup(basePrice, groupMarkupObj, isClient = false, settings = null) {
  if (!groupMarkupObj) return null;
  const type = isClient ? groupMarkupObj.clientType : groupMarkupObj.type;
  let value = parseFloat(isClient ? groupMarkupObj.clientValue : groupMarkupObj.value);
  
  if (type === 'tier1' && settings) {
    value = parseFloat(isClient ? (settings.clientTier1 || settings.clientMarkup) : (settings.resellerTier1 || settings.resellerMarkup));
  } else if (type === 'tier2' && settings) {
    value = parseFloat(isClient ? (settings.clientTier2 || settings.clientMarkup) : (settings.resellerTier2 || settings.resellerMarkup));
  } else if (type === 'tier3' && settings) {
    value = parseFloat(isClient ? settings.clientTier3 : settings.resellerTier3);
  } else {
    if (isNaN(value)) return null;
  }

  const price = parseFloat(basePrice) || 0;
  if (type === 'percent' || type === 'tier1' || type === 'tier2' || type === 'tier3') {
    return price * (value / 100);
  } else {
    return value;
  }
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

  const http = require('http');
  const https = require('https');
  const ipv4Agent = new https.Agent({ family: 4 });

  const res = await axios.post(targetUrl, params.toString(), {
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Dhru-Fusion-Web-Client/1.0',
      'X-Powered-By': 'GSM-THEME'
    },
    timeout: 30000,
    httpsAgent: ipv4Agent
  });
  return res;
}

function buildTargetUrl(endpoint) {
  let targetUrl = endpoint || 'https://latamgsm.com/dhru/';
  if (!targetUrl.endsWith('/')) targetUrl += '/';
  if (!targetUrl.includes('/api/')) targetUrl += 'api/index.php';
  else if (targetUrl.endsWith('/api/')) targetUrl += 'index.php';
  return targetUrl;
}

module.exports = {
  getServerDisplayName,
  getServerId,
  getServerSettings,
  calculateMarkup,
  calculateGroupMarkup,
  getUserCredit,
  setUserCredit,
  callGsmThemeApi,
  buildTargetUrl
};
