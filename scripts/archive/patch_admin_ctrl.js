const fs = require('fs');
let code = fs.readFileSync('src/controllers/adminController.js', 'utf8');

const newMethod = `
exports.toggleDisableImei = (req, res) => {
  const { serviceId, disabled } = req.body;
  const serverId = require('../helpers').getServerId(req);
  if (!serviceId) return res.status(400).json({ error: 'Falta serviceId' });
  
  const disabledDb = readDB('disabled_imei.json') || {};
  const serverKey = 'server' + serverId;
  disabledDb[serverKey] = disabledDb[serverKey] || [];
  
  if (disabled) {
    if (!disabledDb[serverKey].includes(serviceId)) {
      disabledDb[serverKey].push(serviceId);
    }
  } else {
    disabledDb[serverKey] = disabledDb[serverKey].filter(id => id !== serviceId);
  }
  
  writeDB('disabled_imei.json', disabledDb);
  require('../cacheManager').incrementCatalogVersion();
  res.json({ success: true, disabledImei: disabled });
};
`;

code += newMethod;
fs.writeFileSync('src/controllers/adminController.js', code);
