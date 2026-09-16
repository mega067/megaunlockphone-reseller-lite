const fs = require('fs');
let serverContent = fs.readFileSync('server.js', 'utf8');

serverContent = serverContent.replace(
    'const activeMarkup = (dbUser.markup !== null && dbUser.markup !== undefined && !isNaN(dbUser.markup)) ? parseFloat(dbUser.markup) : parseFloat(resellerMarkup);',
    'let activeMarkup = parseFloat(dbUser.markup); if (isNaN(activeMarkup)) activeMarkup = parseFloat(resellerMarkup); if (isNaN(activeMarkup)) activeMarkup = 0;'
);

serverContent = serverContent.replace(
    'const activeMarkup = (req.user.markup !== null && req.user.markup !== undefined && !isNaN(req.user.markup)) ? parseFloat(req.user.markup) : parseFloat(settings.resellerMarkup);',
    'let activeMarkup = parseFloat(req.user.markup); if (isNaN(activeMarkup)) activeMarkup = parseFloat(settings.resellerMarkup); if (isNaN(activeMarkup)) activeMarkup = 0;'
);

fs.writeFileSync('server.js', serverContent);
