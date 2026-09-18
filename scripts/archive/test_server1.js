const axios = require('axios');

async function testServer1() {
  try {
    const res = await axios.post("https://latamgsm.com/api/index.php", "username=angeljuares067@gmail.com&apiaccesskey=pk60-qXSs-xXsF-qZPa&action=imeiservicelist&requestformat=JSON", {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });
    console.log("SUCCESS:", JSON.stringify(res.data).substring(0, 100));
  } catch (e) {
    console.error("ERROR:", e.message);
  }
}

testServer1();
