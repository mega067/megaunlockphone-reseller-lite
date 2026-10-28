const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const megaApiClient = require('./src/core/megaApiClient');
const moduleManager = require('./src/core/moduleManager');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// APIS INTERNAS DE GESTIÓN Y MÓDULOS
// ==========================================

// 1. Obtener estado de todos los módulos
app.get('/api/modules', (req, res) => {
  res.json({ success: true, modules: moduleManager.getAll() });
});

// 2. Activar o desactivar un módulo
app.post('/api/modules/:id/toggle', (req, res) => {
  try {
    const updated = moduleManager.toggleModule(req.params.id, req.body.enabled);
    res.json({ success: true, module: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 3. Guardar configuración de un módulo (Pasos guiados)
app.post('/api/modules/:id/config', (req, res) => {
  try {
    const updated = moduleManager.updateConfig(req.params.id, req.body.config || req.body);
    // Si es la API, sincronizar con el cliente
    if (req.params.id === 'apiConnection' && req.body.apiKey) {
      megaApiClient.saveConfig({
        apiKey: req.body.apiKey,
        username: req.body.username,
        profitMarginPercent: req.body.profitMargin || 15
      });
    }
    res.json({ success: true, module: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// APIS DEL PUENTE SEGURO (MEGAUNLOCKPHONE)
// ==========================================

// Saldo de cuenta oficial
app.get('/api/bridge/balance', async (req, res) => {
  try {
    const s1 = await megaApiClient.getBalance('1').catch(() => null);
    const s3 = await megaApiClient.getBalance('3').catch(() => null);
    res.json({
      success: true,
      server1: s1?.SUCCESS?.[0] || null,
      server3: s3?.SUCCESS?.[0] || null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Catálogo con margen de ganancia aplicado
app.get('/api/bridge/catalog', async (req, res) => {
  try {
    const serverId = req.query.serverId || '1';
    const catalog = await megaApiClient.getCatalog(serverId);
    res.json(catalog);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Enviar orden
app.post('/api/bridge/order', async (req, res) => {
  try {
    const serverId = req.body.serverId || '1';
    const result = await megaApiClient.placeOrder(serverId, req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Aliases para máxima compatibilidad con la UI completa
app.get('/api/products', async (req, res) => {
  try {
    const serverId = req.headers['x-server-id'] || req.query.serverId || '1';
    const catalog = await megaApiClient.getCatalog(serverId);
    res.json(catalog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/accountinfo', async (req, res) => {
  try {
    const serverId = req.headers['x-server-id'] || '1';
    const acc = await megaApiClient.getBalance(serverId);
    res.json(acc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const serverId = req.headers['x-server-id'] || req.body.serverId || '1';
    const result = await megaApiClient.placeOrder(serverId, req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const serverId = req.headers['x-server-id'] || '1';
    const history = await megaApiClient.getHistory(serverId);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback a interfaz web
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, () => {
  console.log(`[Reseller-Lite] Motor activo en http://localhost:${PORT}`);
  console.log(`[Seguridad] Enlace criptográfico fijado a: https://megaunlockphone-panel.alwaysdata.net`);
});
