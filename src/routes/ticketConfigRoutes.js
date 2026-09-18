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
    if (logoBase64 && logoBase64.startsWith('data:image')) {
      try {
        const match = logoBase64.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
        if (match && match.length === 3) {
          let ext = match[1].toLowerCase() === 'png' ? '.png' : (match[1].toLowerCase() === 'webp' ? '.webp' : '.jpg');
          const buffer = Buffer.from(match[2], 'base64');
          const logoDir = path.join(__dirname, '../../data/logos');
          if (!fs.existsSync(logoDir)) fs.mkdirSync(logoDir, { recursive: true });
          const logoPath = path.join(logoDir, `${req.user.id}${ext}`);
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
