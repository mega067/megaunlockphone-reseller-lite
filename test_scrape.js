const axios = require('axios');
async function test() {
  try {
    const res = await axios.get('https://latamgsm.com/autopay.php', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    console.log(res.status, res.data.length);
  } catch(e) {
    console.log(e.message);
  }
  try {
    const res2 = await axios.get('https://www.unlockerfast.com.mx/autopayv2.php', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    console.log(res2.status, res2.data.length);
  } catch(e) {
    console.log(e.message);
  }
}
test();
