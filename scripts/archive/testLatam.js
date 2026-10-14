const axios = require('axios');
async function test() {
  try {
    const { data } = await axios.get('https://latamgsm.com/autopay.php');
    const fs = require('fs');
    fs.writeFileSync('latam_autopay.html', data);
    console.log("Saved latam_autopay.html");
  } catch (e) {
    console.log("Error:", e.message);
  }
}
test();
