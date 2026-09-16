const fs = require('fs');
let serverContent = fs.readFileSync('server.js', 'utf8');
serverContent = serverContent.replace(
    "if (botSecret !== 'MEGA_BOT_SECRET_2026') return res.status(403).json({ error: 'Unauthorized bot' });",
    "if (botSecret !== 'MEGA_BOT_SECRET_2026') return res.status(403).json({ error: 'Unauthorized bot' }); req.user = { id: 1 };"
);
fs.writeFileSync('server.js', serverContent);
