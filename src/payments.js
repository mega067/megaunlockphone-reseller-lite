const { getDepositAccount } = require('../paymentRouter');
const { validarPagoInteligente } = require('../banxicoCEP');
const { reportarPagoProveedor } = require('../providerPayment');
const axios = require('axios');

module.exports = function(app, deps) {
  const { requireAuth, readDB, writeDB, enqueueWhatsApp } = deps;

  app.post('/api/fund/route', requireAuth, async (req, res) => {
    const { amount, bankCode, serverId } = req.body;
    if (!amount || !bankCode || !serverId) return res.status(400).json({ error: 'Faltan datos (monto, banco o servidor)' });

    const requestedAmount = parseFloat(amount);
    const settingsDb = readDB('settings.json') || {};
    let serverLiquidity = 0;
    let targetProviderKey = null;

    try {
      const server = settingsDb['server' + serverId];
      if (server) {
        if (String(serverId) === '1') targetProviderKey = 'latamgsm';
        if (String(serverId) === '3') targetProviderKey = 'unlockerfast';
        const conf = {
          username: server.username,
          apiaccesskey: server.apiaccesskey,
          url: server.endpoint,
        };
        
        let targetUrl = conf.url;

        if (!targetUrl.includes('/api/')) {
          targetUrl = targetUrl.endsWith('/') ? `${targetUrl}api/index.php` : `${targetUrl}/api/index.php`;
        } else if (targetUrl.endsWith('/api/')) {
          targetUrl += 'index.php';
        }

        const params = new URLSearchParams();
        params.append('username', conf.username);
        params.append('apiaccesskey', conf.apiaccesskey);
        params.append('action', 'accountinfo');
        params.append('requestformat', 'JSON');
        
        const response = await axios.post(targetUrl, params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        
        const exRate = parseFloat(settingsDb.exchangeRate || 17.60);
        const rate = String(serverId) === '3' ? 1 : exRate;
        const serverCreditsRaw = parseFloat(response.data?.SUCCESS?.[0]?.AccountInfo?.creditraw || 0);
        
        if (!isNaN(serverCreditsRaw)) {
          const creditMXN = serverCreditsRaw * rate;
          let cedido = 0;
          const allUsers = readDB('users.json') || [];
          allUsers.forEach(u => {
              if (u['credits_' + serverId] !== undefined) {
                  cedido += parseFloat(u['credits_' + serverId]);
              }
          });
          serverLiquidity = creditMXN - cedido;
        }
      }

      let overrideMode = 'INTELLIGENT';
      const overrideSettings = readDB('payment_override.json');
      if (overrideSettings && overrideSettings.mode) {
        overrideMode = overrideSettings.mode;
      }

      if (req.user && req.user.role === 'admin') {
        overrideMode = 'FORCE_SERVER';
      }

      const routeResult = await getDepositAccount(requestedAmount, bankCode, serverLiquidity, overrideMode, targetProviderKey);
      res.json(routeResult);

    } catch (err) {
      console.error('Error calculando liquidez:', err.message);
      res.status(500).json({ error: 'Error del sistema calculando liquidez', details: err.message });
    }
  });

  app.post('/api/fund/verify', requireAuth, async (req, res) => {
    const { amount, bankCode, trackingNumber, accountId, providerKey, serverId } = req.body;
    
    if (!amount || !trackingNumber || !accountId || !serverId) {
      return res.status(400).json({ error: 'Faltan datos para la validación (incluyendo servidor)' });
    }

    const processedRastros = readDB('processed_rastreos.json') || [];
    if (processedRastros.includes(trackingNumber)) {
      return res.status(400).json({ error: 'Esta clave de rastreo ya fue procesada anteriormente.' });
    }

    try {
      const requestedAmount = parseFloat(amount);
      
      if (providerKey) {
        const config = require('../bankConfig');
        const provider = config.PROVIDER_ACCOUNTS[providerKey];
        if (!provider) return res.status(400).json({ error: 'Proveedor no encontrado' });
        
        const providerAccount = provider.accounts.find(a => a.id === accountId);
        if (!providerAccount) return res.status(400).json({ error: 'Cuenta de proveedor no encontrada' });

        providerAccount.providerKey = providerKey;
        providerAccount.providerApiKey = provider.apiKey;
        providerAccount.providerApiUrl = provider.apiUrl;

        const settingsDb = readDB('settings.json') || {};
        let serverConf = null;
        if (providerKey === 'latamgsm') serverConf = settingsDb.server1;
        if (providerKey === 'unlockerfast') serverConf = settingsDb.server3;
        
        const userEmail = serverConf ? serverConf.username : '';

        const reportResult = await reportarPagoProveedor(providerAccount, trackingNumber, bankCode, requestedAmount, userEmail);
        
        if (!reportResult.success) {
          return res.status(400).json({ error: reportResult.message });
        }

      } else {
        const config = require('../bankConfig');
        const adminAccount = config.ADMIN_ACCOUNTS.find(a => a.id === accountId);
        if (!adminAccount) return res.status(400).json({ error: 'Cuenta de admin no encontrada' });

        const banxicoResult = await validarPagoInteligente(trackingNumber, bankCode, adminAccount.bankCode, adminAccount.clabe, requestedAmount);
        
        if (!banxicoResult || !banxicoResult.valido) {
          return res.status(400).json({ error: 'No se encontró la transferencia en Banxico. Por favor verifica que la transferencia se haya completado o intenta más tarde. Si crees que hay un error, contacta a soporte al 2216936720.' });
        }
        
        if (banxicoResult.montoValidado < requestedAmount) {
          return res.status(400).json({ error: `El monto reportado por Banxico ($${banxicoResult.montoValidado}) es menor al solicitado.` });
        }
      }

      const users = readDB('users.json') || [];
      const userId = req.user.id;
      const userIndex = users.findIndex(u => u.id === userId);
      
      if (userIndex === -1) return res.status(404).json({ error: 'Usuario no encontrado en la base de datos' });
      
      const serverIdToCredit = String(serverId);
      const creditKey = 'credits_' + serverIdToCredit;
      users[userIndex][creditKey] = (parseFloat(users[userIndex][creditKey]) || 0) + requestedAmount;
      
      writeDB('users.json', users);

      processedRastros.push(trackingNumber);
      writeDB('processed_rastreos.json', processedRastros);

      const history = readDB('history.json') || [];
      history.unshift({
        id: "txn_" + Date.now(),
        serverId: serverIdToCredit,
        userId: userId,
        username: users[userIndex].username,
        date: new Date().toISOString(),
        serviceId: "RECARGA",
        serviceName: "Recarga de Saldo - SPEI",
        serviceType: "FUNDS",
        imei: trackingNumber,
        costCharged: requestedAmount,
        realCost: requestedAmount,
        profit: 0,
        orderId: "DEP-" + trackingNumber.substring(0,6),
        status: "success",
        msg: `Recarga aplicada por $${requestedAmount} MXN`,
        statusText: `Transferencia SPEI verificada con éxito. Clave: ${trackingNumber}`,
        updateTimestamp: new Date().toLocaleString('es-MX')
      });
      writeDB('history.json', history);
      
      const recharges = readDB('recharges.json') || [];
      recharges.unshift({
        id: "rec_" + Date.now(),
        date: new Date().toISOString(),
        userId: userId,
        username: users[userIndex].username,
        amount: requestedAmount,
        serverId: serverIdToCredit,
        method: 'SPEI / Banxico',
        trackingNumber: trackingNumber,
        processedBy: 'system'
      });
      writeDB('recharges.json', recharges);

      try {
        const wsettings = readDB('data/whatsapp_settings.json') || {};
        if (wsettings.enabled) {
          const userPhone = users[userIndex].phone || userId;
          enqueueWhatsApp('private', `✅ Tu recarga de *$${requestedAmount}* mediante SPEI (Rastreo: ${trackingNumber}) ha sido confirmada. Ya tienes el saldo en tu cuenta.`, userPhone);
        }
      } catch(e) {}

      res.json({ success: true, message: 'Pago verificado y saldo agregado con éxito.' });
    } catch (err) {
      console.error('Error procesando el pago:', err);
      res.status(500).json({ error: 'Error interno del servidor procesando el pago.', details: err.message });
    }
  });
};
