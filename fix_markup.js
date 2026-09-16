const fs = require('fs');

let serverContent = fs.readFileSync('server.js', 'utf8');

// Replace in search API
serverContent = serverContent.replace(
    'const activeMarkup = (req.user.markup !== null && req.user.markup !== undefined && !isNaN(req.user.markup)) ? parseFloat(req.user.markup) : parseFloat(settings.resellerMarkup || 0);',
    'let activeMarkup = parseFloat(req.user.markup); if (isNaN(activeMarkup)) activeMarkup = parseFloat(settings.resellerMarkup); if (isNaN(activeMarkup)) activeMarkup = 0;'
);

// Replace in order API (processOrder)
serverContent = serverContent.replace(
    'const activeMarkup = (user.markup !== null && user.markup !== undefined && !isNaN(user.markup)) ? parseFloat(user.markup) : parseFloat(settings.resellerMarkup);',
    'let activeMarkup = parseFloat(user.markup); if (isNaN(activeMarkup)) activeMarkup = parseFloat(settings.resellerMarkup); if (isNaN(activeMarkup)) activeMarkup = 0;'
);

fs.writeFileSync('server.js', serverContent);
