const axios = require('axios');
async function test() {
  const { data } = await axios.get('https://www.unlockerfast.com.mx/autopayv2.php');
  const fs = require('fs');
  fs.writeFileSync('autopay.html', data);
  console.log("Saved HTML");
}
test();
