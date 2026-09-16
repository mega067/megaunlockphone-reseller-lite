const axios = require('axios');
const http = require('http');
const https = require('https');
const ipv4Agent = new https.Agent({ family: 4 });
const { buildTargetUrl, callGsmThemeApi } = require('./helpers');

/**
 * Realiza una consulta masiva de estados al proveedor.
 * 
 * @param {Array} syncList - Array de objetos { id, type }
 * @param {Object} settings - Configuración del servidor (debe tener username, apiaccesskey, endpoint)
 * @param {String} sId - ID del servidor (ej. '1', '2', '3')
 * @returns {Promise<Array>} - Array de objetos con el resultado { orderid, status, statusText, raw }
 */
async function fetchBulkOrdersStatus(syncList, settings, sId) {
  const targetUrl = buildTargetUrl(settings.endpoint);
  
  const requests = syncList.map(async (itemObj) => {
    const orderid = itemObj.id;
    let action = 'getimeiorder';
    
    if (itemObj.type) {
      let t = String(itemObj.type).toLowerCase().trim();
      if (t !== 'server' && t !== 'file') {
        t = 'imei';
      }
      action = `get${t}order`;
    }

    try {
      if (sId === '1' || sId === '3') {
        const params = new URLSearchParams();
        params.append('username', settings.username);
        params.append('apiaccesskey', settings.apiaccesskey);
        params.append('action', action);
        params.append('requestformat', 'JSON');
        params.append('parameters', `<PARAMETERS><ID>${orderid}</ID></PARAMETERS>`);

        let response = await axios.post(targetUrl, params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000, httpsAgent: ipv4Agent
        });

        if ((!response.data || !response.data.SUCCESS || response.data.SUCCESS.length === 0) && action === 'getserverorder') {
          params.set('action', 'getimeiorder');
          response = await axios.post(targetUrl, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000, httpsAgent: ipv4Agent
          });
        }

        if (response.data && response.data.SUCCESS) {
           const itemArr = Array.isArray(response.data.SUCCESS) ? response.data.SUCCESS : [response.data.SUCCESS];
           if (itemArr.length > 0) {
              const item = itemArr[0];
              const orderStatus = String(item.STATUS || item.status || '').toLowerCase();
              const isSuccess = orderStatus === '4' || orderStatus === 'completed' || orderStatus === 'success';
              const isFailed = orderStatus === '3' || orderStatus === 'failed' || orderStatus === 'rejected' || orderStatus === 'error' || orderStatus === 'cancel' || orderStatus === 'canceled' || orderStatus === 'cancelled';
              const finalStatus = isSuccess ? 'success' : (isFailed ? 'failed' : 'pending');
              
              return {
                orderid: orderid,
                status: finalStatus,
                statusText: item.REPLY || item.REJECT_REASON || item.CODE || item.MESSAGE || (isSuccess ? 'Completado' : (isFailed ? 'Rechazado' : 'En proceso')),
                raw: item
              };
           }
        }
      } else {
        const gsmParams = { ID: orderid };
        const res = await callGsmThemeApi(targetUrl, action, gsmParams, settings.username, settings.apiaccesskey);
        if (res && res.data && res.data.SUCCESS) {
           const itemArr = Array.isArray(res.data.SUCCESS) ? res.data.SUCCESS : [res.data.SUCCESS];
           if (itemArr.length > 0) {
              const item = itemArr[0];
              const orderStatus = String(item.STATUS || item.status || '').toLowerCase();
              const isSuccess = orderStatus === '4' || orderStatus === 'completed' || orderStatus === 'success';
              const isFailed = orderStatus === '3' || orderStatus === 'failed' || orderStatus === 'rejected' || orderStatus === 'error' || orderStatus === 'cancel' || orderStatus === 'canceled' || orderStatus === 'cancelled';
              const finalStatus = isSuccess ? 'success' : (isFailed ? 'failed' : 'pending');
              
              return {
                orderid: orderid,
                status: finalStatus,
                statusText: item.REPLY || item.REJECT_REASON || item.CODE || item.MESSAGE || (isSuccess ? 'Completado' : (isFailed ? 'Rechazado' : 'En proceso')),
                raw: item
              };
           }
        }
      }
    } catch (err) {
      return { orderid, status: 'error', statusText: 'Fallo de conexión' };
    }
    return { orderid, status: 'unknown', statusText: 'Sin respuesta válida' };
  });

  return await Promise.all(requests);
}

module.exports = {
  fetchBulkOrdersStatus
};
