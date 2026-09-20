const { readDB, writeDB } = require('./db');
const { getServerSettings } = require('./helpers');
const { fetchBulkOrdersStatus } = require('./syncService');
const { enqueueWhatsApp, enqueueWhatsAppAdmin } = require('./whatsappQueue');

let isPollingOrders = false;

async function pollPendingOrders() {
  if (isPollingOrders) return;
  isPollingOrders = true;

  try {
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
        const syncList = orders.map(o => ({ id: o.orderId, type: o.serviceType }));
        const bulkResultsArr = await fetchBulkOrdersStatus(syncList, settings, sId);
        
        const bulkResults = {};
        bulkResultsArr.forEach(r => {
           if (r && r.orderid) {
               bulkResults[String(r.orderid)] = {
                   status: r.status,
                   msg: r.statusText
               };
           }
        });
        
        orders.forEach(order => {
            const remoteStatus = bulkResults[String(order.orderId)];
            if (remoteStatus && (remoteStatus.status === 'success' || remoteStatus.status === 'failed') && remoteStatus.status !== order.status) {
                const idx = history.findIndex(h => h.id === order.id);
                if (idx !== -1) {
                    history[idx].status = remoteStatus.status;
                    history[idx].statusText = remoteStatus.msg;
                    hasUpdates = true;
                    
                    let isSuccess = remoteStatus.status === 'success';
                    let headerIcon = isSuccess ? '✅ *SERVICIO COMPLETADO*' : '❌ *SERVICIO RECHAZADO*';
                    let statusTxt = isSuccess ? 'Completado' : 'Rechazado';
                    
                    let cleanMsg = String(remoteStatus.msg || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
                    
                    let resMsg = `${headerIcon}\n━━━━━━━━━━━━━━━━━━━━━━\n`;
                    resMsg += `🆔 *Orden:* #${history[idx].orderId}\n`;
                    resMsg += `📱 *IMEI:* ${history[idx].imei || 'N/A'}\n`;
                    resMsg += `🔧 *Servicio:* ${history[idx].serviceName} ${isSuccess ? '✅' : '❌'}\n`;
                    resMsg += `💲 *Costo:* $${parseFloat(history[idx].resellerCost || history[idx].costCharged || 0).toFixed(2)} MXN\n`;
                    resMsg += `🔑 *Respuesta:* ${cleanMsg}\n`;
                    resMsg += `🎉 *Estado:* ${statusTxt}\n\n`;
                    resMsg += `━━━━━━━━━━━━━━━━━━━━━━\n🌐 MegaUnlockPhone`;
                    
                    enqueueWhatsApp('private', resMsg, history[idx].userId);
  
                    const usersList = readDB('users.json') || [];
                    const orderUser = usersList.find(u => u.id === history[idx].userId);
                    const userNameDisplay = (orderUser && orderUser.role === 'admin') ? 'Admin #1' : history[idx].username;
  
                    let adminMsg = `🔄 ACTUALIZACIÓN AUTOMÁTICA\n━━━━━━━━━━━━━━━━━━━━━━\n#️⃣ Orden: #${history[idx].orderId}\n👨🏽💻 Usuario: ${userNameDisplay}\n🔧 Servicio: ${history[idx].serviceName}\n📊 Estado: ${statusTxt} ${isSuccess ? '✅' : '❌'}\n━━━━━━━━━━━━━━━━━━━━━━`;
                    if (isSuccess || remoteStatus.status === 'failed') {
                        adminMsg = `👨🏽💻 Usuario: ${userNameDisplay}\n${resMsg}`;
                    }
                    enqueueWhatsAppAdmin(adminMsg);
                    
                    let groupMsg = `🔄 ACTUALIZACIÓN AUTOMÁTICA\n━━━━━━━━━━━━━━━━━━━━━━\n#️⃣ Orden: #${history[idx].orderId}\n👨🏽💻 Usuario: ID ${history[idx].userId}\n🔧 Servicio: ${history[idx].serviceName}\n📊 Estado: ${statusTxt} ${isSuccess ? '✅' : '❌'}\n━━━━━━━━━━━━━━━━━━━━━━`;
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
  } finally {
    isPollingOrders = false;
  }
}

function initPoller() {
  setInterval(pollPendingOrders, 3 * 60 * 1000); // Poll every 3 minutes
}

module.exports = {
  pollPendingOrders,
  initPoller
};
