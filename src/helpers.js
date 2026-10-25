const axios = require('axios');
const https = require('https');
const ipv4Agent = new https.Agent({ family: 4, keepAlive: true });

const SERVER_DISPLAY_NAMES = { '1': '⚡ MEGA-SERVER', '2': '🛡 ALPHA-SERVER', '3': '🔱 OMEGA-SERVER' };

function getServerDisplayName(id) { 
  return SERVER_DISPLAY_NAMES[String(id)] || 'Servidor ' + id; 
}

function getServerId(req) {
  const id = req.headers['x-server-id'] || req.query?.serverId || req.body?.serverId || '1';
  return ['1', '2', '3'].includes(id) ? id : '1';
}

function getServerSettings(settings, serverId) {
  if (!settings) return null;
  
  let s = {};
  if (serverId === '3') {
    s = settings.server3 || {};
    s.endpoint = s.endpoint || "https://www.unlockerfast.com.mx/";
    s.username = s.username || "MegaUnlockPhone";
    s.apiaccesskey = s.apiaccesskey || "5RL-UD9-FQ7-311-H4S-NBK-SB2-9DB";
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

// GSM Theme / Dhru Fusion API Caller
async function callGsmThemeApi(targetUrl, action, parameters, username, apiaccesskey) {
  let paramValue = '';
  if (typeof parameters === 'string') {
    paramValue = parameters;
  } else if (parameters && typeof parameters === 'object') {
    if (parameters.rawXml) {
      paramValue = parameters.rawXml;
    } else if (parameters.ID && !parameters.parameters) {
      paramValue = `<PARAMETERS><ID>${parameters.ID}</ID></PARAMETERS>`;
    } else {
      paramValue = Buffer.from(JSON.stringify(parameters)).toString('base64');
    }
  }

  const params = new URLSearchParams();
  params.append('username', username);
  params.append('apiaccesskey', apiaccesskey);
  params.append('action', action);
  params.append('requestformat', 'JSON');
  if (paramValue) {
    params.append('parameters', paramValue);
  }

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

function processRefund(order) {
  if (!order) return { success: false, error: 'Orden no válida' };
  if (order.isRefunded) return { success: false, error: 'La orden ya fue reembolsada previamente' };

  const { readDB, writeDB } = require('./db');
  const { incrementHistoryVersion } = require('./cacheManager');

  const users = readDB('users.json') || [];
  const history = readDB('history.json') || [];
  const settingsDb = readDB('settings.json') || {};

  const user = users.find(u => String(u.id) === String(order.userId));
  if (!user) return { success: false, error: 'Usuario no encontrado para reembolsar' };

  const serverId = String(order.serverId || '1');
  const amountToRefund = parseFloat(order.costCharged !== undefined ? order.costCharged : (order.resellerCost || order.price || 0));

  if (amountToRefund > 0) {
    const currentCredit = getUserCredit(user, serverId);
    const newCredit = parseFloat((currentCredit + amountToRefund).toFixed(4));
    setUserCredit(user, serverId, newCredit);

    // Deduct admin profit if it was accounted for
    const orderProfit = parseFloat(order.profit || 0);
    if (orderProfit > 0) {
      settingsDb.adminProfitBalance = Math.max(0, parseFloat(((settingsDb.adminProfitBalance || 0) - orderProfit).toFixed(4)));
      writeDB('settings.json', settingsDb);
    }

    writeDB('users.json', users);
  }

  const refundTimestamp = new Date().toISOString();

  // Update order in history.json
  const targetOrderId = String(order.orderId || order.id);
  const historyIdx = history.findIndex(h => String(h.orderId || h.id) === targetOrderId && String(h.serverId || '1') === serverId);
  if (historyIdx !== -1) {
    history[historyIdx].isRefunded = true;
    history[historyIdx].refundDate = refundTimestamp;
    history[historyIdx].refundAmount = amountToRefund;
  }
  order.isRefunded = true;
  order.refundDate = refundTimestamp;
  order.refundAmount = amountToRefund;

  writeDB('history.json', history);
  incrementHistoryVersion();

  // Sincronizar en SQLite si existe la tabla OrdersHistory
  try {
    const sqliteDb = require('./database');
    if (sqliteDb && typeof sqliteDb.prepare === 'function') {
      const stmt = sqliteDb.prepare('UPDATE OrdersHistory SET status = ?, statusText = ?, data = ? WHERE orderId = ?');
      const dataPayload = JSON.stringify({ isRefunded: true, refundDate: refundTimestamp, refundAmount: amountToRefund });
      stmt.run('rejected', order.statusText || 'Rechazado y Reembolsado', dataPayload, targetOrderId);

      // Reversión Contable en FinanceLedger
      const existingLedger = sqliteDb.prepare('SELECT * FROM FinanceLedger WHERE orderId = ? AND type = "income_ticket" LIMIT 1').get(targetOrderId);
      if (existingLedger) {
        const financeManager = require('./financeManager');
        financeManager.recordTransaction({
          type: 'adjustment',
          orderId: targetOrderId,
          serviceName: `Reembolso / Anulación: ${order.serviceName || existingLedger.serviceName}`,
          chargedAmount: -Math.abs(parseFloat(existingLedger.chargedAmount || amountToRefund)),
          costAmount: -Math.abs(parseFloat(existingLedger.costAmount || 0)),
          account: existingLedger.account || 'Server',
          notes: `Reembolso Orden #${targetOrderId} - Orden Rechazada o Cancelada`,
          recordedBy: 'Sistema Reembolsos'
        });
      }
    }
  } catch(e) {
    // Si la tabla no está disponible o falla SQLite, history.json ya está blindado
  }

  return {
    success: true,
    amountRefunded: amountToRefund,
    newBalance: user ? getUserCredit(user, serverId) : 0
  };
}

function logRecharge(userId, username, amount, type = 'MANUAL_ADMIN', adminUsername = 'Admin', serverId = '1', extra = {}) {
  const { readDB, writeDB } = require('./db');
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount === 0) return null;

  const recharges = readDB('recharges.json') || [];
  const entry = {
    id: "rec_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    date: new Date().toISOString(),
    userId: userId,
    username: username || ('User #' + userId),
    amount: Math.abs(numAmount),
    isDeduction: numAmount < 0,
    serverId: String(serverId || '1'),
    type: type, // 'MANUAL_ADMIN', 'MANUAL_BOT', 'SPEI', etc.
    adminUsername: adminUsername || 'Admin',
    processedBy: adminUsername || 'Admin',
    trackingNumber: extra.trackingNumber || (type === 'MANUAL_ADMIN' ? 'Ajuste de Saldo (Panel)' : (type === 'MANUAL_BOT' ? 'Ajuste WhatsApp' : 'N/A')),
    senderBankName: extra.senderBankName || '',
    receiverBankName: extra.receiverBankName || '',
    note: extra.note || (numAmount > 0 ? 'Saldo asignado por Administrador' : 'Saldo descontado por Administrador')
  };

  recharges.unshift(entry);
  if (recharges.length > 500) recharges.pop();
  writeDB('recharges.json', recharges);

  try {
    const { createAutoBackup } = require('./backupEngine');
    createAutoBackup(numAmount > 0 ? 'Recarga_Saldo_User_' + userId : 'Deduccion_Saldo_User_' + userId);
  } catch(e) {}

  // Sincronizar automáticamente con el Módulo de Finanzas Personales si es un ingreso
  if (numAmount > 0) {
    try {
      const financeManager = require('./financeManager');
      let targetAccountName = 'Nu Crédito / Débito';
      const rBank = (extra.receiverBankName || '').toUpperCase();
      if (rBank.includes('REVOLUT') || rBank.includes('STP')) {
        targetAccountName = 'Revolut';
      } else if (rBank.includes('BBVA')) {
        targetAccountName = 'BBVA';
      } else if (rBank.includes('MERCADO')) {
        targetAccountName = 'Mercado Pago';
      } else if (rBank.includes('EFECTIVO')) {
        targetAccountName = 'Efectivo / Caja';
      }

      financeManager.recordTransaction({
        type: 'income_ticket',
        serviceName: `Recarga Saldo S${serverId} (${username || userId})`,
        chargedAmount: numAmount,
        costAmount: 0,
        reinvestPercent: 100, // 100% fondo de saldo disponible para el usuario, 0 ganancia de bolsillo hasta que compre
        account: targetAccountName,
        category: 'servidores',
        notes: `Depósito cliente ${extra.trackingNumber ? 'Rastreo: ' + extra.trackingNumber : 'Ajuste Admin'}`
      });
    } catch(finErr) {
      console.warn('[FINANCE RECHARGE SYNC ERR]', finErr.message);
    }
  }

  return entry;
}

function computeLuhnCheckDigit(digits14) {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(digits14.charAt(i), 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return (10 - (sum % 10)) % 10;
}

function generateValidLuhnImei() {
  const tac = '35301409'; // Valid TAC prefix (Apple iPhone)
  let body = tac;
  while (body.length < 14) {
    body += Math.floor(Math.random() * 10).toString();
  }
  const check = computeLuhnCheckDigit(body);
  return body + check;
}

function isValidLuhnImei(str) {
  if (!str || !/^\d{15}$/.test(String(str).trim())) return false;
  const s = String(str).trim();
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let digit = parseInt(s.charAt(i), 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
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
  buildTargetUrl,
  processRefund,
  logRecharge,
  computeLuhnCheckDigit,
  generateValidLuhnImei,
  isValidLuhnImei
};
