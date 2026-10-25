/**
 * WhatsApp Queue Facade (Backward Compatibility)
 * Delegates to src/whatsappEngine.js
 */
const engine = require('./whatsappEngine');

module.exports = {
  enqueueWhatsApp: engine.enqueueWhatsApp,
  enqueueWhatsAppAdmin: engine.enqueueWhatsAppAdmin,
  getEngineTimestamp: engine.getEngineTimestamp,
  ENGINE_CONFIG: engine.ENGINE_CONFIG,
  randomThrottleDelay: engine.randomThrottleDelay,
  randomBroadcastDelay: engine.randomBroadcastDelay,
  callBotApi: engine.callBotApi
};

