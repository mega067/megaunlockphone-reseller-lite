module.exports = function(app, deps) {
  const { requireAuth, readDB, writeDB, getServerId, enqueueWhatsApp, enqueueWhatsAppAdmin } = deps;

  app.get('/api/history', requireAuth, (req, res) => {
    const serverId = getServerId(req);
    const history = readDB('history.json') || [];
    
    if (req.user.role === 'admin') {
      if (req.query.allServers === 'true') {
         return res.json(history); 
      }
      const serverHistory = history.filter(h => (h.serverId || '1') === serverId);
      return res.json(serverHistory); 
    } else {
      const serverHistory = history.filter(h => (h.serverId || '1') === serverId);
      return res.json(serverHistory.filter(h => h.userId === req.user.id));
    }
  });

  app.get('/api/recharges', requireAuth, (req, res) => {
    const recharges = readDB('recharges.json') || [];
    const userRecharges = recharges.filter(r => r.userId === req.user.id).sort((a,b) => new Date(b.date) - new Date(a.date));
    res.json(userRecharges);
  });

  app.get('/api/admin/recharges', requireAuth, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const recharges = readDB('recharges.json') || [];
    const sortedRecharges = recharges.sort((a,b) => new Date(b.date) - new Date(a.date));
    res.json(sortedRecharges);
  });

  app.post('/api/history/add', requireAuth, (req, res) => {
    const user = req.user;
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Sólo el administrador puede agregar pedidos manualmente.' });
    }

    const { orderId, serviceId, serviceName, imei, status, statusText, serverId: reqServerId, serviceType, cost } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const serverId = reqServerId || getServerId(req);
    let history = readDB('history.json') || [];
    
    const existingIdx = history.findIndex(o => String(o.orderId) === String(orderId) && (o.serverId || '1') === serverId);
    
    if (existingIdx !== -1) {
      history[existingIdx] = {
        ...history[existingIdx],
        serviceId: serviceId || history[existingIdx].serviceId,
        serviceName: serviceName || history[existingIdx].serviceName,
        serviceType: serviceType || history[existingIdx].serviceType,
        imei: (imei && imei !== 'N/A') ? imei : history[existingIdx].imei,
        costCharged: (cost !== undefined) ? Number(cost) : history[existingIdx].costCharged,
        realCost: (cost !== undefined) ? Number(cost) : history[existingIdx].realCost,
        status: status || history[existingIdx].status,
        msg: statusText || history[existingIdx].msg,
        date: new Date().toISOString()
      };
    } else {
      history.unshift({
        id: 'txn_' + Date.now(),
        serverId: serverId,
        userId: user.id,
        username: user.username,
        date: new Date().toISOString(),
        serviceId: serviceId || 'N/A',
        serviceName: serviceName || `Pedido Importado (ID: ${orderId})`,
        serviceType: serviceType || 'IMEI',
        imei: imei || 'N/A',
        costCharged: Number(cost || 0),
        realCost: Number(cost || 0),
        profit: 0,
        orderId: String(orderId),
        status: status || 'success',
        msg: statusText || 'Importado manualmente'
      });
    }

    if (history.length > 500) history.pop();
    writeDB('history.json', history);
    
    return res.json({ success: true, message: 'Pedido importado exitosamente.' });
  });

  app.delete('/api/history', requireAuth, (req, res) => {
    const user = req.user;
    const serverId = getServerId(req);
    let history = readDB('history.json') || [];
    
    if (user.role === 'admin') {
      history = history.filter(h => (h.serverId || '1') !== serverId);
    } else {
      history = history.filter(h => h.userId !== user.id || (h.serverId || '1') !== serverId);
    }
    
    writeDB('history.json', history);
    return res.json({ success: true });
  });

  app.put('/api/history', requireAuth, (req, res) => {
    const { updatedOrders } = req.body;
    if (!updatedOrders || !Array.isArray(updatedOrders)) return res.status(400).json({ error: 'Missing updatedOrders' });
    const serverId = getServerId(req);
    const history = readDB('history.json') || [];
    
    let changed = false;
    updatedOrders.forEach(uo => {
      const idx = history.findIndex(h => String(h.orderId) === String(uo.orderId) && (h.serverId || '1') === serverId);
      if (idx !== -1) {
        if (req.user.role === 'admin' || history[idx].userId === req.user.id) {
          const oldStatus = history[idx].status;
          history[idx].status = uo.status;
          history[idx].statusText = uo.statusText;
          history[idx].updateTimestamp = uo.updateTimestamp;
          
          if (oldStatus !== uo.status) {
            const isSuccess = uo.status === 'success';
            const isRejected = uo.status === 'rejected';
            const settingsDb = readDB('settings.json') || {};
            
            let privateMsg = '';
            const costToUse = history[idx].costCharged !== undefined ? history[idx].costCharged : (history[idx].realCost || 0);
            
            let cleanStatusText = (uo.statusText || 'Completado').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();

            if (isSuccess) {
              privateMsg = `✅ SERVICIO COMPLETADO\n\n🆔 Orden: #${history[idx].orderId}\n📱 IMEI: ${history[idx].imei || 'N/A'}\n🔧 Servicio: ${history[idx].serviceName}✅\n💲 Costo: $${parseFloat(costToUse).toFixed(2)} MXN\n🔑 Código / Respuesta: ${cleanStatusText}\n🎉 Estado: Completado\n\n━━━━━━━━━━━━━━\n🌐 MegaUnlockPhone`;
            } else if (isRejected) {
              privateMsg = `❌ SERVICIO RECHAZADO\n\n🆔 Orden: #${history[idx].orderId}\n📱 IMEI: ${history[idx].imei || 'N/A'}\n🔧 Servicio: ${history[idx].serviceName}❌\n❗ Motivo: ${cleanStatusText}\n💲 Costo: $${parseFloat(costToUse).toFixed(2)} MXN\n💸 Créditos: Reembolsados\n🎉 Estado: Rechazado\n\n━━━━━━━━━━━━━━\n🌐 MegaUnlockPhone`;
            } else {
              privateMsg = `🔔 ACTUALIZACIÓN DE ORDEN\n\n🆔 Orden: #${history[idx].orderId}\n📱 IMEI: ${history[idx].imei || 'N/A'}\n🔧 Servicio: ${history[idx].serviceName}\n📊 Estado: ${uo.status}\n📝 Detalles: ${cleanStatusText}\n\n━━━━━━━━━━━━━━\n🌐 MegaUnlockPhone`;
            }
            
            enqueueWhatsApp('private', privateMsg, history[idx].userId);
            
            const users = readDB('users.json') || [];
            const userObj = users.find(u => String(u.id) === String(history[idx].userId));
            const userNameDisplay = userObj ? (userObj.role === 'admin' ? 'Admin #1' : userObj.username) : 'Desconocido';
            
            let serverName = '⚡ MEGA-SERVER';
            if (String(history[idx].serverId) === '2') serverName = '🛡 ALPHA-SERVER';
            if (String(history[idx].serverId) === '3') serverName = '🔱 OMEGA-SERVER';
            
            const statusStr = isSuccess ? '✅ Completado' : (isRejected ? '❌ Rechazado' : '⏳ En proceso');
            
            let adminMsg = `🔄 ACTUALIZACIÓN DE ORDEN\n━━━━━━━━━━━━━━━━━━━━━━\n#️⃣ Orden: #${history[idx].orderId}\n👨🏽💻 Usuario: ${userNameDisplay}\n🔧 Servicio: ${history[idx].serviceName} \n📊 Estado: ${statusStr}\n🖥️ Servidor: ${serverName}\n━━━━━━━━━━━━━━━━━━━━━━\n🛡️ MegaUnlockPhone`;
            if (isSuccess || isRejected) {
                adminMsg = `👨🏽💻 Cliente: ${userNameDisplay}\n${privateMsg}`;
            }
            enqueueWhatsAppAdmin(adminMsg);

            const groupMsg = `📢 REPORTE DE ORDEN\n━━━━━━━━━━━━━━━━━━━━━━\n#️⃣ Orden: #${history[idx].orderId}\n👨🏽💻 Cliente: ${userNameDisplay}\n🔧 Servicio: ${history[idx].serviceName} \n📊 Estado: ${statusStr}\n🖥️ Servidor: ${serverName}\n━━━━━━━━━━━━━━━━━━━━━━\n🌐 MegaUnlockPhone`;
            enqueueWhatsApp('group', groupMsg);
          }
          
          changed = true;
        }
      }
    });

    if (changed) {
      writeDB('history.json', history);
    }
    res.json({ success: true });
  });

};
