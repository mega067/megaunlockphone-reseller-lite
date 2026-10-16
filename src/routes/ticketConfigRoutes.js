const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

module.exports = (context) => {
  const { requireAuth, readDB, writeDB } = context;

  router.get('/ticket_config', requireAuth, (req, res) => {
    const configDb = readDB('ticket_configs.json') || {};
    const userConfig = configDb[req.user.id] || {};
    res.json({
      nombre: userConfig.nombre || '',
      whatsapp: userConfig.whatsapp || '',
      facebook: userConfig.facebook || '',
      logoExt: userConfig.logoExt || ''
    });
  });

  router.post('/ticket_config', requireAuth, (req, res) => {
    const { nombre, whatsapp, facebook, logoBase64 } = req.body;
    const configDb = readDB('ticket_configs.json') || {};
    const userConfig = configDb[req.user.id] || {};
    
    let logoExt = userConfig.logoExt || '';
    if (req.body.clearLogo) {
      if (logoExt) {
        const logoPath = path.join(__dirname, '../../data/logos', `${req.user.id}${logoExt}`);
        if (fs.existsSync(logoPath)) {
          fs.unlinkSync(logoPath);
        }
      }
      logoExt = '';
    } else if (logoBase64 && logoBase64.startsWith('data:image')) {
      try {
        const match = logoBase64.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
        if (match && match.length === 3) {
          const mime = match[1].toLowerCase();
          let ext = mime.includes('png') ? '.png' : (mime.includes('webp') ? '.webp' : (mime.includes('jpeg') || mime.includes('jpg') ? '.jpg' : null));
          if (!ext) {
            return res.status(400).json({ error: 'Formato de imagen no permitido. Solo se acepta PNG, WEBP o JPG.' });
          }
          const buffer = Buffer.from(match[2], 'base64');
          if (buffer.length > 5 * 1024 * 1024) {
            return res.status(400).json({ error: 'El archivo excede el tamaño máximo permitido (5MB).' });
          }
          const safeUserId = String(req.user.id).replace(/[^a-zA-Z0-9_-]/g, '');
          const logoDir = path.resolve(__dirname, '../../data/logos');
          if (!fs.existsSync(logoDir)) fs.mkdirSync(logoDir, { recursive: true });
          const logoPath = path.resolve(logoDir, `${safeUserId}${ext}`);
          if (!logoPath.startsWith(logoDir)) {
            return res.status(403).json({ error: 'Ruta no permitida.' });
          }
          fs.writeFileSync(logoPath, buffer);
          logoExt = ext;
        }
      } catch(e) {
        console.error('Error saving logo:', e);
      }
    }
    
    configDb[req.user.id] = {
      nombre: nombre !== undefined ? nombre : userConfig.nombre,
      whatsapp: whatsapp !== undefined ? whatsapp : userConfig.whatsapp,
      facebook: facebook !== undefined ? facebook : userConfig.facebook,
      logoExt: logoExt
    };
    writeDB('ticket_configs.json', configDb);
    res.json({ success: true });
  });

  return router;
};
