const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const regex = /app\.post\('\/api\/order', requireAuth, async \(req, res\) => \{[\s\S]*?\/\/ Get order status proxy endpoint/;

const replacement = `app.post('/api/order', requireAuth, async (req, res) => {
  const { serviceid, imei, custom_fields, serviceType, serviceName } = req.body;
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

  const realCost = prices[serviceid] !== undefined ? prices[serviceid] : null;
  if (realCost === null) return res.status(400).json({ error: 'Service cost not cached. Refresh catalog.' });
  
  const allCustomPrices = readDB('custom_prices.json') || {};
  const customPrices = allCustomPrices['server' + serverId] || {};
  
  let resellerCost;
  if (customPrices[serviceid]) {
    resellerCost = parseFloat(customPrices[serviceid].resellerPrice);
  } else {
    resellerCost = Math.ceil(realCost + parseFloat(settings.resellerMarkup));
  }
  
  const profit = resellerCost - realCost;
  const isReseller = user.role !== 'admin';
  const finalCostToDeduct = isReseller ? resellerCost : realCost;

  const currentCredit = serverId === '2' ? user.credits_2 : user.credits_1;
  if (currentCredit < finalCostToDeduct) {
    if (isReseller) {
      return res.status(400).json({ error: 'Saldo insuficiente. Contacte al administrador.' });
    } else {
      if (!req.body.bypassAdminBalance) {
        return res.status(400).json({ error: 'ADMIN_INSUFFICIENT_BALANCE', message: 'Saldo personal de Admin insuficiente.' });
      }
    }
  }

  const { apiaccesskey, username, endpoint } = settings;
  let targetUrl = endpoint.endsWith('/') ? endpoint + 'api/index.php' : endpoint + '/api/index.php';

  try {
    let responseData;
    let orderId = 'Desconocido';
    let msg = 'Exitoso';

    if (serverId === '1') {
      let customXml = '';
      if (custom_fields && typeof custom_fields === 'object' && Object.keys(custom_fields).length > 0) {
        const jsonStr = JSON.stringify(custom_fields);
        const base64Str = Buffer.from(jsonStr).toString('base64');
        customXml = '<CUSTOMFIELD>' + base64Str + '</CUSTOMFIELD>';
      }

      const notes = req.body.notes || '';
      let notesXml = '';
      if (notes.trim() !== '') {
        notesXml = '<NOTES>' + notes.trim() + '</NOTES>';
      }

      let xmlParameters = serviceType === 'SERVER' 
        ? '<PARAMETERS><ID>' + serviceid + '</ID><QNT>1</QNT>' + customXml + notesXml + '</PARAMETERS>'
        : '<PARAMETERS><ID>' + serviceid + '</ID><IMEI>' + (imei && imei.trim() !== '' ? imei : '111111111111111') + '</IMEI>' + customXml + notesXml + '</PARAMETERS>';

      const params = new URLSearchParams();
      params.append('username', username);
      params.append('apiaccesskey', apiaccesskey);
      params.append('action', 'placeimeiorder');
      params.append('requestformat', 'JSON');
      params.append('parameters', xmlParameters);

      const response = await axios.post(targetUrl, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20000
      });
      responseData = response.data;
    } else {
      // SERVER 2: GSM THEME API
      let gsmParams = { ID: serviceid };
      if (serviceType !== 'SERVER') {
        gsmParams.IMEI = imei && imei.trim() !== '' ? imei : '111111111111111';
      } else {
        gsmParams.QNT = 1;
      }
      if (custom_fields && typeof custom_fields === 'object' && Object.keys(custom_fields).length > 0) {
        gsmParams.CUSTOMFIELD = Buffer.from(JSON.stringify(custom_fields)).toString('base64');
      }
      if (req.body.notes && req.body.notes.trim() !== '') {
        gsmParams.NOTES = req.body.notes.trim();
      }

      const response = await callGsmThemeApi(targetUrl, 'placeimeiorder', gsmParams, username, apiaccesskey);
      responseData = response.data;
    }

    if (responseData && responseData.SUCCESS) {
      if (serverId === '2') {
        users[userIndex].credits_2 -= finalCostToDeduct;
      } else {
        users[userIndex].credits_1 -= finalCostToDeduct;
      }
      
      if (isReseller) {
        settingsDb.adminProfitBalance = (settingsDb.adminProfitBalance || 0) + profit;
      }
      
      writeDB('users.json', users);
      writeDB('settings.json', settingsDb);
      
      const successItem = Array.isArray(responseData.SUCCESS) ? responseData.SUCCESS[0] : responseData.SUCCESS;
      orderId = successItem.REFERENCEID || successItem.ORDERID || successItem.ID || 'Desconocido';
      msg = successItem.MESSAGE || 'Exitoso';

      let imeiDataString = imei || 'N/A';
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
        realCost: realCost,
        profit: isReseller ? profit : 0,
        orderId,
        status: 'pending',
        msg
      });
      if (history.length > 500) history.pop();
      writeDB('history.json', history);
      
      createAutoBackup('Nuevo_Pedido_S' + serverId);

      return res.json(responseData);
    } else if (responseData && responseData.ERROR) {
      return res.json(responseData);
    } else {
      return res.status(500).json({ error: 'Respuesta inválida del servidor remoto.' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Fallo al comunicarse con el proveedor.', details: error.message });
  }
});

// Get order status proxy endpoint`;

if (code.match(regex)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('server.js', code);
  console.log('Order API updated.');
} else {
  console.log('Regex did not match.');
}
