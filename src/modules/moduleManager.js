/**
 * MegaUnlockPhone - Modular Addon Registry & Lifecycle Manager
 * 
 * Permite que cada módulo (Catálogo, DigitalPass, Finanzas, Bot, Pasarela)
 * funcione de manera desacoplada e intercambiable como un Add-On.
 * Si un módulo se deshabilita en modules.config.json, las demás partes
 * del sistema no se rompen ni generan errores de dependencia.
 */

const fs = require('fs');
const path = require('path');

class ModuleManager {
  constructor() {
    this.configPath = path.join(__dirname, '../../modules.config.json');
    this.modulesConfig = this.loadConfig();
    this.registeredAddons = new Map();
    this.hookListeners = new Map();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      }
    } catch (e) {
      console.warn('⚠️ No se pudo leer modules.config.json, usando valores por defecto:', e.message);
    }
    return { name: 'MegaUnlockPhone Default', modules: {} };
  }

  /**
   * Verifica si un módulo específico o addon está activo en el fork actual
   */
  isEnabled(moduleKey) {
    if (!this.modulesConfig || !this.modulesConfig.modules) return true;
    const mod = this.modulesConfig.modules[moduleKey];
    if (mod === undefined) return true; // Habilitado por defecto si no se declara
    if (typeof mod === 'boolean') return mod;
    return Boolean(mod.enabled);
  }

  /**
   * Obtiene la configuración de un módulo
   */
  getModuleConfig(moduleKey) {
    if (!this.modulesConfig || !this.modulesConfig.modules) return {};
    return this.modulesConfig.modules[moduleKey] || {};
  }

  /**
   * Registra un Addon en tiempo de ejecución
   */
  register(name, addonInstance) {
    this.registeredAddons.set(name, {
      instance: addonInstance,
      enabled: this.isEnabled(name),
      registeredAt: new Date().toISOString()
    });
    console.log(`🔌 [Addon Registry] ${name}: ${this.isEnabled(name) ? '✅ Habilitado' : '⏸️ Inactivo (Disabled)'}`);
  }

  /**
   * Middleware para Express: Si una ruta requiere un módulo deshabilitado,
   * responde de manera elegante con 404/503 sin crashear el servidor.
   */
  requireModule(moduleKey) {
    return (req, res, next) => {
      if (this.isEnabled(moduleKey)) {
        return next();
      }
      return res.status(404).json({
        success: false,
        error: `El módulo "${moduleKey}" está inactivo en la configuración de este fork.`,
        code: 'MODULE_DISABLED'
      });
    };
  }

  /**
   * Hook event bus para desacoplar llamadas entre módulos
   */
  on(event, handler) {
    if (!this.hookListeners.has(event)) {
      this.hookListeners.set(event, []);
    }
    this.hookListeners.get(event).push(handler);
  }

  async emit(event, data) {
    const handlers = this.hookListeners.get(event) || [];
    const results = [];
    for (const fn of handlers) {
      try {
        results.push(await fn(data));
      } catch (err) {
        console.error(`❌ Error en handler de evento "${event}":`, err.message);
      }
    }
    return results;
  }
}

// Instancia única (Singleton)
const instance = new ModuleManager();
module.exports = instance;
