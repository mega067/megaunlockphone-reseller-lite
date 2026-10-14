const fs = require('fs');
const data = fs.readFileSync('autopay.html', 'utf8');
const bankMatch = data.match(/<select[^>]*name=["']?emisor["']?[^>]*>([\s\S]*?)<\/select>/i);
if (bankMatch) {
  const options = [...bankMatch[1].matchAll(/<option[^>]*value=["']([^"']+)["'][^>]*>([^<]+)<\/option>/ig)];
  const banks = options.map(o => ({ code: o[1], name: o[2].trim() }));
  console.log(banks.length, "banks found");
  console.log(banks[0]);
} else {
  console.log("Regex failed to match");
}
