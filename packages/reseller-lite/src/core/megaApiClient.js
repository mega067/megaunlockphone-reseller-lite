/**
 * Cliente de Conexión Criptográfica Exclusiva a MegaUnlockPhone API
 * 
 * SEGURIDAD Y BLOQUEO:
 * - Endpoints fijados a la API del proveedor principal (megaunlockphone-panel.alwaysdata.net).
 * - Imposibilita cambiar el host a un proveedor competidor o externo.
 * - Validación de firma SHA-256 en cada requerimiento.
 */
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Host y Firma Maestro inmutables
const MASTER_PROVIDER_HOST = 'https://megaunlockphone-panel.alwaysdata.net';
const MASTER_PROVIDER_ID = 'MEGA_UNLOCK_PHONE_CORE';

class MegaApiClient {
  constructor(configPath) {
    this.configPath = configPath || path.join(__dirname, '../../data/client_config.json');
    this.cachedConfig = null;
  }

  getConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      }
    } catch (e) {
      console.error('[MegaApiClient] Error leyendo config:', e.message);
    }
    return {
      apiKey: process.env.MEGA_API_KEY || '',
      username: process.env.MEGA_USERNAME || '',
      serverMode: 'dual', // 's1', 's3', 'dual'
      profitMarginPercent: 15
    };
  }

  saveConfig(newConfig) {
    const current = this.getConfig();
    const updated = { ...current, ...newConfig };
    fs.writeFileSync(this.configPath, JSON.stringify(updated, null, 2), 'utf8');
    this.cachedConfig = updated;
    return updated;
  }

  /**
   * Genera el token de verificación de integridad
   */
  generateIntegritySignature(timestamp, pathStr) {
    return crypto.createHmac('sha256', MASTER_PROVIDER_ID)
      .update(`${timestamp}:${pathStr}:${MASTER_PROVIDER_HOST}`)
      .digest('hex');
  }

  /**
   * Ejecuta peticiones HTTP forzadas contra el host oficial
   */
  async request(endpointPath, options = {}) {
    const config = this.getConfig();
    if (!config.apiKey) {
      throw new Error('API Key no configurada. Configure su llave en el Asistente Gráfico.');
    }

    // Endpoint forzado a megaunlockphone-panel.alwaysdata.net
    const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
    const url = `${MASTER_PROVIDER_HOST}${cleanPath}`;

    const timestamp = Date.now().toString();
    const signature = this.generateIntegritySignature(timestamp, cleanPath);

    const headers = {
      'X-API-Key': config.apiKey,
      'X-Client-Signature': signature,
      'X-Client-Timestamp': timestamp,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    try {
      const response = await axios({
        url,
        method: options.method || 'GET',
        headers,
        data: options.data,
        params: options.params,
        timeout: 30000
      });
      return response.data;
    } catch (err) {
      const errMsg = err.response?.data?.ERROR?.[0]?.MESSAGE || err.response?.data?.error || err.message;
      throw new Error(`[MegaProvider] ${errMsg}`);
    }
  }

  /**
   * Consulta el saldo de ambos servidores o específico
   */
  async getBalance(serverId = '1') {
    return this.request(`/api/v1/s${serverId}/account`);
  }

  /**
   * Obtiene el catálogo de servicios con el margen de ganancia aplicado
   */
  async getCatalog(serverId = '1') {
    const rawCatalog = await this.request(`/api/v1/s${serverId}/catalog`);
    const config = this.getConfig();
    const margin = parseFloat(config.profitMarginPercent) || 0;

    // Aplicar margen local de ganancia si se requiere para el cliente final del reseller
    if (rawCatalog && rawCatalog.SUCCESS && Array.isArray(rawCatalog.SUCCESS)) {
      return rawCatalog.SUCCESS.map(group => {
        const services = Array.isArray(group.SERVICES) ? group.SERVICES.map(srv => {
          const basePrice = parseFloat(srv.PRICE || srv.price || 0);
          const finalPrice = margin > 0 ? (basePrice * (1 + margin / 100)).toFixed(2) : basePrice.toFixed(2);
          return {
            ...srv,
            ORIGINAL_PRICE: basePrice,
            PRICE: finalPrice,
            CURRENCY: 'MXN'
          };
        }) : [];

        return {
          ...group,
          SERVICES: services
        };
      });
    }

    return rawCatalog;
  }

  /**
   * Envía una orden a procesar al servidor principal
   */
  async placeOrder(serverId, orderPayload) {
    return this.request(`/api/v1/s${serverId}/order`, {
      method: 'POST',
      data: orderPayload
    });
  }

  /**
   * Consulta el estado de una orden
   */
  async getOrderStatus(serverId, orderId) {
    return this.request(`/api/v1/s${serverId}/order/status`, {
      method: 'POST',
      data: { orderId, orderid: orderId }
    });
  }

  /**
   * Obtiene el historial de órdenes
   */
  async getHistory(serverId = '1') {
    return this.request(`/api/v1/s${serverId}/history`);
  }
}

module.exports = new MegaApiClient();
