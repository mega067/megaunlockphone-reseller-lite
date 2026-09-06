const axios = require('axios');

async function fix() {
  try {
    const loginRes = await axios.post('https://megaunlockphone-panel.alwaysdata.net/api/login', {
      username: 'Angel',
      password: 'angel067L'
    });
    const token = loginRes.data.token;
    console.log("Logged in!");

    const usersRes = await axios.get('https://megaunlockphone-panel.alwaysdata.net/api/users', {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Server-Id': '1' }
    });
    const users = usersRes.data;
    console.log("Users:", users.map(u => u.username));
    
    // Find Monse
    const monse = users.find(u => u.username.toLowerCase().includes('monse'));
    if (monse) {
       console.log("Found Monse, fixing...");
       // Set Latam (1) to 0
       await axios.put(`https://megaunlockphone-panel.alwaysdata.net/api/users/${monse.id}`, { credits: 0 }, {
         headers: { 'Authorization': `Bearer ${token}`, 'X-Server-Id': '1' }
       });
       // Set UnlockerFast (3) to 12
       await axios.put(`https://megaunlockphone-panel.alwaysdata.net/api/users/${monse.id}`, { credits: 12 }, {
         headers: { 'Authorization': `Bearer ${token}`, 'X-Server-Id': '3' }
       });
       console.log("Fixed Monse!");
    }
    
    // Find Melo
    const melo = users.find(u => u.username.toLowerCase().includes('melo'));
    if (melo) {
       console.log("Found Melo, fixing...");
       // Set Latam (1) to 1
       await axios.put(`https://megaunlockphone-panel.alwaysdata.net/api/users/${melo.id}`, { credits: 1 }, {
         headers: { 'Authorization': `Bearer ${token}`, 'X-Server-Id': '1' }
       });
       // Set UnlockerFast (3) to 0
       await axios.put(`https://megaunlockphone-panel.alwaysdata.net/api/users/${melo.id}`, { credits: 0 }, {
         headers: { 'Authorization': `Bearer ${token}`, 'X-Server-Id': '3' }
       });
       console.log("Fixed Melo!");
    }
  } catch (e) {
    console.error("Error:", e.response ? e.response.data : e.message);
  }
}
fix();
