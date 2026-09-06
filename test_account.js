const axios = require('axios');
async function test() {
  const params = new URLSearchParams();
  params.append('username', 'angeljuares067@gmail.com');
  params.append('apiaccesskey', 'RFT-P6B-I3D-V78-V7S-B31-N4V-14J');
  params.append('action', 'accountinfo');
  params.append('requestformat', 'JSON');
  
  try {
    const response = await axios.post('https://latamgsm.com/dhru/api/index.php', params.toString());
    console.log(JSON.stringify(response.data, null, 2));
  } catch (e) {
    console.log("Error:", e.message);
  }
}
test();
