const fs = require('fs');
let serverContent = fs.readFileSync('server.js', 'utf8');

serverContent = serverContent.replace(
    'results.push({ id: serviceid, name: (s.SERVICENAME || s.SERVICE_NAME || s.name) + (req.user.id === 1 ? ` [DEBUG: real=${realCost}, u.markup=${req.user.markup}, s.markup=${settings.resellerMarkup}, a.markup=${activeMarkup}, res=${resellerCost}]` : ""), price: isNaN(resellerCost) ? 0 : resellerCost });',
    'results.push({ id: serviceid, name: (s.SERVICENAME || s.SERVICE_NAME || s.name) + (req.user.id === 1 ? ` [DEBUG: real=${realCost}, u.markup=${req.user.markup}, s.markup=${settings.resellerMarkup}, res=${resellerCost}]` : ""), price: isNaN(resellerCost) ? 0 : resellerCost });'
);

fs.writeFileSync('server.js', serverContent);
