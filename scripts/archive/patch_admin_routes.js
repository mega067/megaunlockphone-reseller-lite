const fs = require('fs');
let code = fs.readFileSync('src/routes/adminRoutes.js', 'utf8');

code = code.replace(
    "module.exports = router;",
    "router.post('/admin/disable-imei', requireAuth, requireAdmin, adminController.toggleDisableImei);\n\nmodule.exports = router;"
);

fs.writeFileSync('src/routes/adminRoutes.js', code);
