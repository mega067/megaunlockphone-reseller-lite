const express = require('express');
const crypto = require('crypto');
const { readDB, writeDB } = require('../db');
const { requireAuth } = require('../auth');
const { getServerId, getServerDisplayName, getUserCredit, setUserCredit, logRecharge } = require('../helpers');
const catalogController = require('../controllers/catalogController');
const orderController = require('../controllers/orderController');

const router = express.Router();

/**
 * Hash seguro para comparar API Keys sin guardar la llave en plano
 */
function hashApiKey(rawKey) {
  return crypto.createHash('sha256').update(String(rawKey).trim()).digest('hex');
}

/**
 * Middleware de Autenticación por API Key (Compatible con Dhru y clientes puente)
 * Soporta Header: X-API-Key, Authorization: Bearer <key>, o body: apiaccesskey/apikey
 */
function requireApiKey(req, res, next) {
  let apiKey = req.headers['x-api-key'] || req.headers['x-api-token'];
  if (!apiKey && req.headers['authorization']) {
    const parts = req.headers['authorization'].split(' ');
    if (parts.length === 2 && (parts[0].toLowerCase() === 'bearer' || parts[0].toLowerCase() === 'key')) {
      apiKey = parts[1];
    }
  }
  if (!apiKey && req.body) {
    apiKey = req.body.apiaccesskey || req.body.apikey || req.body.apiKey;
  }
  if (!apiKey && req.query) {
    apiKey = req.query.apiaccesskey || req.query.apikey || req.query.apiKey;
  }

  if (!apiKey) {
    return res.status(401).json({
      SUCCESS: false,
      ERROR: [{ MESSAGE: 'API Key requerida. Envía tu llave mediante header "X-API-Key" o campo "apiaccesskey".' }]
    });
  }

  const cleanKey = String(apiKey).trim();
  const keyHash = hashApiKey(cleanKey);

  const users = readDB('users.json') || [];
  const user = users.find(u => {
    if (!u.apiKeyHash && !u.apiKey) return false;
    return u.apiKeyHash === keyHash || u.apiKey === cleanKey;
  });

  if (!user) {
    return res.status(403).json({
      SUCCESS: false,
      ERROR: [{ MESSAGE: 'API Key inválida o revocada. Genera una nueva llave desde tu Perfil de usuario.' }]
    });
  }

  if (user.isActive === false) {
    return res.status(403).json({
      SUCCESS: false,
      ERROR: [{ MESSAGE: 'Cuenta de usuario inactiva o suspendida. Contacta al Administrador.' }]
    });
  }

  // Comprobar si el usuario tiene autorización activa para usar la API Bridge
  const isApiAuthorized = user.role === 'admin' || Boolean(user.isApiEnabled);
  if (!isApiAuthorized) {
    return res.status(403).json({
      SUCCESS: false,
      ERROR: [{ MESSAGE: 'El acceso por API no está activado para tu cuenta. Comunícate con Soporte / Administrador para solicitar la activación de tu API Key.' }]
    });
  }

  req.user = {
    id: user.id,
    username: user.username,
    role: user.role || 'reseller',
    isApiBridge: true
  };

  // Registrar último uso (sin saturar disco)
  const now = new Date().toISOString();
  if (!user.apiKeyLastUsed || Date.now() - new Date(user.apiKeyLastUsed).getTime() > 60000) {
    user.apiKeyLastUsed = now;
    writeDB('users.json', users);
  }

  next();
}

/**
 * Middleware para fijar explícitamente el servidor de la ruta
 * @param {'1'|'3'} fixedServerId 
 */
function setFixedServer(fixedServerId) {
  return (req, res, next) => {
    req.headers['x-server-id'] = String(fixedServerId);
    if (req.body && typeof req.body === 'object') {
      req.body.serverId = String(fixedServerId);
    }
    if (req.query) {
      req.query.serverId = String(fixedServerId);
    }
    next();
  };
}

// ========================================================
// GESTIÓN DE API KEYS PARA EL USUARIO (DESDE SU PERFIL / WEB)
// ========================================================

/**
 * GET /api/user/apikey
 * Obtiene la información de la API Key del usuario y las URLs específicas para Server 1 y Server 3
 */
router.get('/user/apikey', requireAuth, (req, res) => {
  const users = readDB('users.json') || [];
  const user = users.find(u => String(u.id) === String(req.user.id));
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const hasKey = Boolean(user.apiKeyHash || user.apiKey);
  const isApiEnabled = user.role === 'admin' || Boolean(user.isApiEnabled);
  const host = `${req.protocol}://${req.get('host')}`;
  
  const creditS1 = getUserCredit(user, '1');
  const creditS3 = getUserCredit(user, '3');

  res.json({
    success: true,
    hasKey: hasKey,
    isApiEnabled: isApiEnabled,
    supportContactUrl: 'https://wa.me/522216936720?text=Hola%2C%20solicito%20la%20activaci%C3%B3n%20de%20mi%20API%20Key%20para%20conectar%20mi%20Fork%20o%20Bot%20a%20MegaUnlockPhone.',
    prefix: user.apiKeyPrefix || (hasKey ? 'mup_live_****' : null),
    createdAt: user.apiKeyCreatedAt || null,
    lastUsedAt: user.apiKeyLastUsed || null,
    credits: {
      server1: creditS1.toFixed(2),
      server3: creditS3.toFixed(2)
    },
    // Endpoints dedicados para cada servidor independiente
    server1: {
      id: '1',
      name: 'MEGA-SERVER (Desbloqueos, IMEI & Gaming)',
      balance: creditS1.toFixed(2),
      currency: 'MXN',
      dhruEndpoint: `${host}/api/v1/s1/dhru`,
      restEndpoint: `${host}/api/v1/s1`,
      recommendedClientServerKey: 'server1'
    },
    server3: {
      id: '3',
      name: 'OMEGA-SERVER (Streaming, IA, Cuentas & Hardware)',
      balance: creditS3.toFixed(2),
      currency: 'MXN',
      dhruEndpoint: `${host}/api/v1/s3/dhru`,
      restEndpoint: `${host}/api/v1/s3`,
      recommendedClientServerKey: 'server3'
    },
    bridgeConfig: {
      username: user.username,
      docsUrl: `${host}/api/v1/docs`
    }
  });
});

/**
 * POST /api/user/apikey/generate
 * Genera o rota la API Key criptográfica
 */
router.post('/user/apikey/generate', requireAuth, (req, res) => {
  const users = readDB('users.json') || [];
  const userIndex = users.findIndex(u => String(u.id) === String(req.user.id));
  if (userIndex === -1) return res.status(404).json({ error: 'Usuario no encontrado' });

  const randomBytes = crypto.randomBytes(24).toString('hex');
  const rawApiKey = `mup_live_${randomBytes}`;
  const keyHash = hashApiKey(rawApiKey);
  const prefix = `mup_live_${rawApiKey.substring(9, 15)}...${rawApiKey.substring(rawApiKey.length - 4)}`;
  const now = new Date().toISOString();

  users[userIndex].apiKeyHash = keyHash;
  users[userIndex].apiKey = rawApiKey;
  users[userIndex].apiKeyPrefix = prefix;
  users[userIndex].apiKeyCreatedAt = now;
  users[userIndex].apiKeyLastUsed = null;

  writeDB('users.json', users);

  res.json({
    success: true,
    message: 'API Key generada con éxito. Cópiala ahora, por seguridad no volverá a mostrarse completa.',
    apiKey: rawApiKey,
    prefix: prefix,
    createdAt: now
  });
});

/**
 * DELETE /api/user/apikey/revoke
 * Revoca inmediatamente la API Key activa
 */
router.delete('/user/apikey/revoke', requireAuth, (req, res) => {
  const users = readDB('users.json') || [];
  const userIndex = users.findIndex(u => String(u.id) === String(req.user.id));
  if (userIndex === -1) return res.status(404).json({ error: 'Usuario no encontrado' });

  delete users[userIndex].apiKeyHash;
  delete users[userIndex].apiKey;
  delete users[userIndex].apiKeyPrefix;
  delete users[userIndex].apiKeyCreatedAt;
  delete users[userIndex].apiKeyLastUsed;

  writeDB('users.json', users);

  res.json({
    success: true,
    message: 'API Key revocada correctamente. Todas las conexiones externas con esa llave han sido desconectadas.'
  });
});

// ========================================================
// CONTROLADOR COMPARTIDO DE DHRU FUSION POR SERVIDOR
// Permite aislar completamente el saldo y catálogo de Server 1 y Server 3
// ========================================================
async function handleDhruAction(req, res, targetServerId) {
  const action = (req.body.action || req.query.action || '').toLowerCase();
  const serverId = String(targetServerId || getServerId(req));
  req.headers['x-server-id'] = serverId;

  const users = readDB('users.json') || [];
  const user = users.find(u => String(u.id) === String(req.user.id));
  const credit = getUserCredit(user, serverId);

  // 1. Balance de cuenta (accountinfo)
  if (action === 'accountinfo') {
    return res.json({
      SUCCESS: [{
        AccountInfo: {
          credit: credit.toFixed(2),
          creditraw: credit.toFixed(2),
          currency: 'MXN',
          username: user.username,
          serverid: serverId,
          servername: getServerDisplayName(serverId),
          mail: user.email || `${user.username}@megaunlockphone.com`
        }
      }]
    });
  }

  // 2. Lista de servicios con los PRECIOS DE VENTA CALCULADOS (imeiservicelist, serverservicelist, fileservicelist)
  if (action === 'imeiservicelist' || action === 'serverservicelist' || action === 'fileservicelist') {
    return catalogController.getProducts(req, res);
  }

  // 3. Envío de órdenes (placeimeiorder, placeserverorder, placefileorder)
  if (action === 'placeimeiorder' || action === 'placeserverorder' || action === 'placefileorder') {
    req.body.serviceid = req.body.serviceid || req.body.ID || req.body.id;
    req.body.imei = req.body.imei || req.body.IMEI;
    req.body.serverId = serverId;
    req.body._isApiBridge = true;
    return orderController.processOrder(req, res);
  }

  // 4. Estado de órdenes (getimeiorder, getserverorder, getfileorder)
  if (action === 'getimeiorder' || action === 'getserverorder' || action === 'getfileorder') {
    req.body.orderid = req.body.orderid || req.body.ID || req.body.id;
    req.body.serverId = serverId;
    return orderController.getOrderStatus(req, res);
  }

  res.status(400).json({
    ERROR: [{ MESSAGE: `Acción desconocida "${action}". Consulta la documentación en /api/v1/docs` }]
  });
}

// ========================================================
// ENDPOINTS ESPECÍFICOS PARA SERVIDOR 1 (MEGA-SERVER)
// Saldo independiente: user.credits_1
// ========================================================

/** DHRU Fusion Gateway para Server 1 */
router.post('/v1/s1/dhru', requireApiKey, setFixedServer('1'), (req, res) => {
  return handleDhruAction(req, res, '1');
});

/** REST API para Server 1 */
router.get('/v1/s1/account', requireApiKey, setFixedServer('1'), (req, res) => {
  const users = readDB('users.json') || [];
  const user = users.find(u => String(u.id) === String(req.user.id));
  const credit = getUserCredit(user, '1');
  res.json({
    SUCCESS: [{
      USER_ID: user.id,
      USERNAME: user.username,
      SERVER_ID: '1',
      SERVER_NAME: getServerDisplayName('1'),
      CREDIT: credit.toFixed(2),
      CURRENCY: 'MXN'
    }]
  });
});

router.get('/v1/s1/catalog', requireApiKey, setFixedServer('1'), (req, res) => {
  catalogController.getProducts(req, res);
});

router.post('/v1/s1/order', requireApiKey, setFixedServer('1'), (req, res, next) => {
  req.body._isApiBridge = true;
  req.body.serverId = '1';
  orderController.processOrder(req, res, next);
});

router.post('/v1/s1/order/status', requireApiKey, setFixedServer('1'), (req, res, next) => {
  req.body.serverId = '1';
  orderController.getOrderStatus(req, res, next);
});

router.get('/v1/s1/history', requireApiKey, setFixedServer('1'), (req, res) => {
  const history = readDB('history.json') || [];
  const userHistory = history.filter(h => 
    String(h.userId) === String(req.user.id) && String(h.serverId || '1') === '1'
  ).map(item => ({
    orderId: item.orderId,
    serviceId: item.serviceId,
    serviceName: item.serviceName,
    serviceType: item.serviceType || 'IMEI',
    imei: item.imei,
    cost: item.costCharged || item.resellerCost || item.price || 0,
    status: item.status,
    statusText: item.statusText || item.msg || '',
    date: item.date,
    updateTimestamp: item.updateTimestamp,
    isRefunded: Boolean(item.isRefunded)
  }));
  res.json({ SUCCESS: true, SERVER_ID: '1', COUNT: userHistory.length, ORDERS: userHistory });
});

// ========================================================
// ENDPOINTS ESPECÍFICOS PARA SERVIDOR 3 (OMEGA-SERVER)
// Saldo independiente: user.credits_3
// ========================================================

/** DHRU Fusion Gateway para Server 3 */
router.post('/v1/s3/dhru', requireApiKey, setFixedServer('3'), (req, res) => {
  return handleDhruAction(req, res, '3');
});

/** REST API para Server 3 */
router.get('/v1/s3/account', requireApiKey, setFixedServer('3'), (req, res) => {
  const users = readDB('users.json') || [];
  const user = users.find(u => String(u.id) === String(req.user.id));
  const credit = getUserCredit(user, '3');
  res.json({
    SUCCESS: [{
      USER_ID: user.id,
      USERNAME: user.username,
      SERVER_ID: '3',
      SERVER_NAME: getServerDisplayName('3'),
      CREDIT: credit.toFixed(2),
      CURRENCY: 'MXN'
    }]
  });
});

router.get('/v1/s3/catalog', requireApiKey, setFixedServer('3'), (req, res) => {
  catalogController.getProducts(req, res);
});

router.post('/v1/s3/order', requireApiKey, setFixedServer('3'), (req, res, next) => {
  req.body._isApiBridge = true;
  req.body.serverId = '3';
  orderController.processOrder(req, res, next);
});

router.post('/v1/s3/order/status', requireApiKey, setFixedServer('3'), (req, res, next) => {
  req.body.serverId = '3';
  orderController.getOrderStatus(req, res, next);
});

router.get('/v1/s3/history', requireApiKey, setFixedServer('3'), (req, res) => {
  const history = readDB('history.json') || [];
  const userHistory = history.filter(h => 
    String(h.userId) === String(req.user.id) && String(h.serverId) === '3'
  ).map(item => ({
    orderId: item.orderId,
    serviceId: item.serviceId,
    serviceName: item.serviceName,
    serviceType: item.serviceType || 'IMEI',
    imei: item.imei,
    cost: item.costCharged || item.resellerCost || item.price || 0,
    status: item.status,
    statusText: item.statusText || item.msg || '',
    date: item.date,
    updateTimestamp: item.updateTimestamp,
    isRefunded: Boolean(item.isRefunded)
  }));
  res.json({ SUCCESS: true, SERVER_ID: '3', COUNT: userHistory.length, ORDERS: userHistory });
});

// ========================================================
// ENDPOINTS GENÉRICOS (SELECCIÓN DINÁMICA VÍA HEADER X-Server-Id O PARÁMETRO serverId)
// ========================================================
router.post('/v1/dhru', requireApiKey, (req, res) => {
  const targetServerId = getServerId(req);
  return handleDhruAction(req, res, targetServerId);
});

router.get('/v1/account', requireApiKey, (req, res) => {
  const serverId = getServerId(req);
  const users = readDB('users.json') || [];
  const user = users.find(u => String(u.id) === String(req.user.id));
  const credit = getUserCredit(user, serverId);
  res.json({
    SUCCESS: [{
      USER_ID: user.id,
      USERNAME: user.username,
      SERVER_ID: serverId,
      SERVER_NAME: getServerDisplayName(serverId),
      CREDIT: credit.toFixed(2),
      CURRENCY: 'MXN'
    }]
  });
});

router.get('/v1/catalog', requireApiKey, (req, res) => {
  catalogController.getProducts(req, res);
});

router.post('/v1/order', requireApiKey, (req, res, next) => {
  req.body._isApiBridge = true;
  orderController.processOrder(req, res, next);
});

router.post('/v1/order/status', requireApiKey, (req, res, next) => {
  orderController.getOrderStatus(req, res, next);
});

router.get('/v1/history', requireApiKey, (req, res) => {
  const serverId = getServerId(req);
  const history = readDB('history.json') || [];
  const userHistory = history.filter(h => 
    String(h.userId) === String(req.user.id) && (String(h.serverId || '1') === String(serverId))
  ).map(item => ({
    orderId: item.orderId,
    serviceId: item.serviceId,
    serviceName: item.serviceName,
    serviceType: item.serviceType || 'IMEI',
    imei: item.imei,
    cost: item.costCharged || item.resellerCost || item.price || 0,
    status: item.status,
    statusText: item.statusText || item.msg || '',
    date: item.date,
    updateTimestamp: item.updateTimestamp,
    isRefunded: Boolean(item.isRefunded)
  }));
  res.json({ SUCCESS: true, SERVER_ID: serverId, COUNT: userHistory.length, ORDERS: userHistory });
});

/**
 * GET /api/v1/docs
 * Documentación interactiva en JSON con la configuración de 1 o ambos servidores
 */
router.get('/v1/docs', (req, res) => {
  const host = `${req.protocol}://${req.get('host')}`;
  res.json({
    title: 'MegaUnlockPhone - API Bridge Gateway Documentation (Dual Server Support)',
    version: '1.1.0',
    description: 'Conector de puente API y proveedor modular con aislamiento de saldo para Servidor 1 (Mega) y Servidor 3 (Omega).',
    pricingNote: 'Los precios devueltos en las APIs corresponden exactamente a tus tarifas de revendedor asignadas por MegaUnlockPhone.',
    servers: {
      server1: {
        name: 'MEGA-SERVER (Servidor 1)',
        specialty: 'Desbloqueo de Red IMEI, Bypass, Free Fire y servicios de telefonía.',
        wallet: 'Saldo en Billetera Servidor 1 (credits_1)',
        dhruUrl: `${host}/api/v1/s1/dhru`,
        restUrl: `${host}/api/v1/s1`
      },
      server3: {
        name: 'OMEGA-SERVER (Servidor 3)',
        specialty: 'Cuentas de Streaming, Inteligencia Artificial, Licencias y Cajas Físicas Flash64.',
        wallet: 'Saldo en Billetera Servidor 3 (credits_3)',
        dhruUrl: `${host}/api/v1/s3/dhru`,
        restUrl: `${host}/api/v1/s3`
      }
    },
    clientForkSetupExamples: {
      optionA_bothServers: {
        description: 'Configuración en data/settings.json para conectar AMBOS servidores a tu fork:',
        settings_json: {
          server1: {
            name: "MEGA-PUENTE-S1",
            endpoint: `${host}/api/v1/s1/dhru`,
            username: "tu_usuario",
            apiaccesskey: "mup_live_tu_api_key",
            enabled: true
          },
          server3: {
            name: "OMEGA-PUENTE-S3",
            endpoint: `${host}/api/v1/s3/dhru`,
            username: "tu_usuario",
            apiaccesskey: "mup_live_tu_api_key",
            enabled: true
          }
        }
      },
      optionB_onlyServer1: {
        description: 'Si tu fork solo comercializará servicios de Telefonía / IMEI:',
        settings_json: {
          server1: {
            name: "MEGA-PUENTE-S1",
            endpoint: `${host}/api/v1/s1/dhru`,
            username: "tu_usuario",
            apiaccesskey: "mup_live_tu_api_key",
            enabled: true
          }
        }
      },
      optionC_onlyServer3: {
        description: 'Si tu fork solo comercializará Streaming e Inteligencia Artificial (DigitalPass):',
        settings_json: {
          server1: {
            name: "OMEGA-PUENTE-STREAMING",
            endpoint: `${host}/api/v1/s3/dhru`,
            username: "tu_usuario",
            apiaccesskey: "mup_live_tu_api_key",
            enabled: true
          }
        }
      }
    }
  });
});

module.exports = router;
