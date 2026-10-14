const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

// Find the script block at the end
const scriptTags = [
  '<script src="/js/api.js?v=1"></script>',
  '<script src="/js/utils.js?v=1"></script>',
  '<script src="/js/notifications.js?v=2"></script>',
  '<script src="/js/state.js"></script>',
  '<script src="/js/ticket.js"></script>',
  '<script src="/js/searchEngine.js?v=1"></script>',
  '<script src="js/recharges.js"></script>',
  '<script src="js/recharge.js?v=15"></script>',
  '<script src="index.js?v=29"></script>'
];

const deferTags = [
  '<script src="/js/api.js?v=1" defer></script>',
  '<script src="/js/utils.js?v=1" defer></script>',
  '<script src="/js/notifications.js?v=2" defer></script>',
  '<script src="/js/state.js" defer></script>',
  '<script src="/js/ticket.js" defer></script>',
  '<script src="/js/searchEngine.js?v=1" defer></script>',
  '<script src="js/recharges.js" defer></script>',
  '<script src="js/recharge.js?v=15" defer></script>',
  '<script src="index.js?v=29" defer></script>'
];

for (let i = 0; i < scriptTags.length; i++) {
  html = html.replace(scriptTags[i], deferTags[i]);
}

fs.writeFileSync('public/index.html', html);
console.log('Added defer to scripts in index.html!');
