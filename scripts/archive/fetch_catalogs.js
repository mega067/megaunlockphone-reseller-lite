const axios = require('axios');
const fs = require('fs');

async function run() {
  try {
    const loginRes = await axios.post('https://megaunlockphone-panel.alwaysdata.net/api/login', {
      username: 'Angel',
      password: 'angel067L'
    });
    const token = loginRes.data.token;
    console.log('Login OK');

    for (let i = 1; i <= 3; i++) {
      console.log(`Fetching Server ${i}...`);
      const prodRes = await axios.get('https://megaunlockphone-panel.alwaysdata.net/api/products', {
        headers: { 
          Authorization: 'Bearer ' + token,
          'x-server-id': i.toString()
        }
      });
      fs.writeFileSync(`catalog_server_${i}.json`, JSON.stringify(prodRes.data, null, 2));
      console.log(`Saved catalog_server_${i}.json`);
    }
  } catch(e) {
    console.log('Error:', e.message);
  }
}
run();
