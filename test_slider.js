const fs = require('fs');
const js = fs.readFileSync('public/index.js', 'utf8');
const html = fs.readFileSync('public/index.html', 'utf8');
console.log(js.includes('function updateSliderUI()'));
console.log(html.includes('id="btnServer1"'));
