/**
 * Gestor Gráfico y Dinámico de Módulos para Reseller Lite
 * 
 * Permite activar/desactivar y configurar paso a paso:
 * 1. Conexión de API (Llave y modo Dual S1/S3)
 * 2. Módulo Bot de WhatsApp
 * 3. Módulo de Finanzas & Gastos
 * 4. Módulo DigitalPass (Streaming & AI)
 * 5. Margen de Ganancia Global
 */
const fs = require('fs');
const path = require('path');

const MODULES_FILE = path.join(__dirname, '../../data/modules.json');

class ModuleManager {
  constructor() {
    this.ensureFile();
  }

  ensureFile() {
    const dataDir = path.dirname(MODULES_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(MODULES_FILE)) {
      const defaultState = {
        apiConnection: {
          id: 'apiConnection',
          title: 'Conexión MegaUnlockPhone API',
          description: 'Enlace criptográfico exclusivo con el servidor maestro.',
          enabled: true,
          locked: true, // No se puede desactivar
          status: 'ready',
          setupStep: 1,
          config: {
            apiKey: '',
            username: '',
            profitMargin: 15,
            defaultServer: '1'
          }
        },
        whatsappBot: {
          id: 'whatsappBot',
          title: 'Demonio de WhatsApp & Notificaciones',
          description: 'Atención automática de clientes, tickets y avisos de órdenes.',
          enabled: false,
          status: 'not_configured',
          setupStep: 2,
          config: {
            botName: 'Mi Bot Reseller',
            adminPhone: '',
            welcomeMessage: '¡Hola! Bienvenido a nuestro servicio de desbloqueos y cuentas.',
            autoNotifyOrders: true
          }
        },
        finanzas: {
          id: 'finanzas',
          title: 'Motor Financiero & Ganancias',
          description: 'Control de caja, ingresos, deudores y balance neto.',
          enabled: true,
          status: 'active',
          setupStep: 3,
          config: {
            currency: 'MXN',
            trackReinvest: true,
            defaultPaymentMethod: 'Transferencia'
          }
        },
        digitalPass: {
          id: 'digitalPass',
          title: 'Portal DigitalPass (Streaming & IA)',
          description: 'Venta de licencias, cuentas de entretenimiento y servicios digitales.',
          enabled: true,
          status: 'active',
          setupStep: 4,
          config: {
            showStreaming: true,
            showAiTools: true
          }
        }
      };
      fs.writeFileSync(MODULES_FILE, JSON.stringify(defaultState, null, 2), 'utf8');
    }
  }

  getAll() {
    this.ensureFile();
    try {
      return JSON.parse(fs.readFileSync(MODULES_FILE, 'utf8'));
    } catch (e) {
      console.error('[ModuleManager] Error leyendo modules.json:', e.message);
      return {};
    }
  }

  getModule(moduleId) {
    const all = this.getAll();
    return all[moduleId] || null;
  }

  toggleModule(moduleId, enabled) {
    const all = this.getAll();
    if (!all[moduleId]) throw new Error(`Módulo "${moduleId}" no encontrado`);
    if (all[moduleId].locked) throw new Error(`El módulo "${moduleId}" es el núcleo del sistema y no puede desactivarse.`);

    all[moduleId].enabled = Boolean(enabled);
    all[moduleId].status = all[moduleId].enabled ? 'active' : 'disabled';
    fs.writeFileSync(MODULES_FILE, JSON.stringify(all, null, 2), 'utf8');
    return all[moduleId];
  }

  updateConfig(moduleId, newConfig) {
    const all = this.getAll();
    if (!all[moduleId]) throw new Error(`Módulo "${moduleId}" no encontrado`);

    all[moduleId].config = { ...(all[moduleId].config || {}), ...newConfig };
    all[moduleId].status = 'configured';
    fs.writeFileSync(MODULES_FILE, JSON.stringify(all, null, 2), 'utf8');
    return all[moduleId];
  }
}

module.exports = new ModuleManager();
