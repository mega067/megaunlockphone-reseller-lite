const fs = require('fs');
const data = fs.readFileSync('latam_autopay.html', 'utf8');

const match = data.match(/const\s+transfBancosData\s*=\s*\[([\s\S]*?)\];/);
if (match) {
  const options = [...match[1].matchAll(/\{code:\s*["']([^"']+)["'],\s*name:\s*["']([^"']+)["']/ig)];
  const banks = options.map(o => ({ code: o[1], name: o[2].trim() }));
  console.log(banks.length, "banks found");
  console.log(banks[0]);
} else {
  console.log("Regex failed");
}
