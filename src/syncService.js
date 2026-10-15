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
        const actionsToTry = [];
        if (action === 'getserverorder') {
          actionsToTry.push('getserverorder', 'getimeiorder', 'getfileorder');
        } else if (action === 'getfileorder') {
          actionsToTry.push('getfileorder', 'getimeiorder', 'getserverorder');
        } else {
          actionsToTry.push('getimeiorder', 'getserverorder', 'getfileorder');
        }

        let bestResponse = null;
        let lastErrorMsg = '';

        for (const act of actionsToTry) {
          // Formato estándar Dhru Fusion: action con parameters XML <PARAMETERS><ID>orderid</ID></PARAMETERS>
          const params = new URLSearchParams();
          params.append('username', settings.username);
          params.append('apiaccesskey', settings.apiaccesskey);
          params.append('action', act);
          params.append('requestformat', 'JSON');
          params.append('parameters', `<PARAMETERS><ID>${orderid}</ID></PARAMETERS>`);

          try {
            const resp = await axios.post(targetUrl, params.toString(), {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' },
              timeout: 15000,
              httpsAgent: ipv4Agent
            });

            if (resp.data && resp.data.SUCCESS && (!Array.isArray(resp.data.SUCCESS) || resp.data.SUCCESS.length > 0)) {
              bestResponse = { data: resp.data, actionUsed: act };
              break;
            }

            if (resp.data && resp.data.ERROR && resp.data.ERROR.length > 0) {
              const eMsg = typeof resp.data.ERROR[0] === 'object' ? resp.data.ERROR[0].MESSAGE : resp.data.ERROR[0];
              lastErrorMsg = eMsg || lastErrorMsg;
            }

            // Intento 2 para proveedores con formato plano de ID
            const paramsPlain = new URLSearchParams();
            paramsPlain.append('username', settings.username);
            paramsPlain.append('apiaccesskey', settings.apiaccesskey);
            paramsPlain.append('action', act);
            paramsPlain.append('requestformat', 'JSON');
            paramsPlain.append('ID', String(orderid));

            const respPlain = await axios.post(targetUrl, paramsPlain.toString(), {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' },
              timeout: 15000,
              httpsAgent: ipv4Agent
            });

            if (respPlain.data && respPlain.data.SUCCESS && (!Array.isArray(respPlain.data.SUCCESS) || respPlain.data.SUCCESS.length > 0)) {
              bestResponse = { data: respPlain.data, actionUsed: act };
              break;
            }
          } catch (eAct) {
            lastErrorMsg = eAct.message;
          }
        }

        if (bestResponse && bestResponse.data && bestResponse.data.SUCCESS) {
          const itemArr = Array.isArray(bestResponse.data.SUCCESS) ? bestResponse.data.SUCCESS : [bestResponse.data.SUCCESS];
          if (itemArr.length > 0) {
            const item = itemArr[0];
            const orderStatus = String(item.STATUS || item.status || '').toLowerCase();
            const isSuccess = orderStatus === '4' || orderStatus === 'completed' || orderStatus === 'success';
            const isFailed = orderStatus === '3' || orderStatus === '2' || orderStatus === 'failed' || orderStatus === 'rejected' || orderStatus === 'error' || orderStatus === 'cancel' || orderStatus === 'canceled' || orderStatus === 'cancelled';
            const finalStatus = isSuccess ? 'success' : (isFailed ? 'failed' : 'pending');

            let rawReply = item.CODE || item.REPLY || item.REJECT_REASON || item.MESSAGE || item.COMMENT || '';
            if (typeof rawReply === 'object' && rawReply !== null) rawReply = JSON.stringify(rawReply);
            let cleanText = String(rawReply).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
            if (!cleanText) cleanText = isSuccess ? 'Completado' : (isFailed ? 'Rechazado' : 'En proceso');

            // Determinar tipo de servicio inferido
            const detectedType = bestResponse.actionUsed === 'getserverorder' ? 'SERVER' : (bestResponse.actionUsed === 'getfileorder' ? 'FILE' : 'IMEI');

            return {
              orderid: orderid,
              status: finalStatus,
              statusText: cleanText,
              serviceType: detectedType,
              raw: item
            };
          }
        }

        return { orderid, status: 'unknown', statusText: lastErrorMsg || 'Pedido no encontrado en el servidor' };
      } else {
        const gsmParams = { ID: orderid };
        let res = await callGsmThemeApi(targetUrl, action, gsmParams, settings.username, settings.apiaccesskey);
        let hasSuccessGsm = res && res.data && res.data.SUCCESS && (!Array.isArray(res.data.SUCCESS) || res.data.SUCCESS.length > 0);
        if (!hasSuccessGsm) {
          const altAction = (action === 'getserverorder') ? 'getimeiorder' : 'getserverorder';
          try {
            const altRes = await callGsmThemeApi(targetUrl, altAction, gsmParams, settings.username, settings.apiaccesskey);
            if (altRes && altRes.data && altRes.data.SUCCESS && (!Array.isArray(altRes.data.SUCCESS) || altRes.data.SUCCESS.length > 0)) {
              res = altRes;
            }
          } catch (eAlt) { }
        }

        if (res && res.data && res.data.SUCCESS) {
          const itemArr = Array.isArray(res.data.SUCCESS) ? res.data.SUCCESS : [res.data.SUCCESS];
          if (itemArr.length > 0) {
            const item = itemArr[0];
            const orderStatus = String(item.STATUS || item.status || '').toLowerCase();
            const isSuccess = orderStatus === '4' || orderStatus === 'completed' || orderStatus === 'success';
            const isFailed = orderStatus === '3' || orderStatus === 'failed' || orderStatus === 'rejected' || orderStatus === 'error' || orderStatus === 'cancel' || orderStatus === 'canceled' || orderStatus === 'cancelled';
            const finalStatus = isSuccess ? 'success' : (isFailed ? 'failed' : 'pending');

            let rawReply = item.CODE || item.REPLY || item.REJECT_REASON || item.MESSAGE || item.COMMENT || '';
            if (typeof rawReply === 'object' && rawReply !== null) rawReply = JSON.stringify(rawReply);
            let cleanText = String(rawReply).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
            if (!cleanText) cleanText = isSuccess ? 'Completado' : (isFailed ? 'Rechazado' : 'En proceso');

            return {
              orderid: orderid,
              status: finalStatus,
              statusText: cleanText,
              serviceType: 'IMEI',
              raw: item
            };
          }
        }
      }
    } catch (err) {
      return { orderid, status: 'error', statusText: err.message || 'Fallo de conexión' };
    }
    return { orderid, status: 'unknown', statusText: 'Sin respuesta válida' };
  });

  return await Promise.all(requests);
}

module.exports = {
  fetchBulkOrdersStatus
};
