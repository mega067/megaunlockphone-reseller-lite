const axios = require('axios');
const fs = require('fs');

async function test() {
  try {
    // Override Angel's password temporarily in DB just to login
    let users = JSON.parse(fs.readFileSync('data/users.json'));
    users[0].password = '1234';
    fs.writeFileSync('data/users.json', JSON.stringify(users));

    const resLogin = await axios.post('http://localhost:3000/api/login', { username: 'Angel', password: '1234' });
    const token = resLogin.data.token;
    console.log("Got token:", token.substring(0, 10) + '...');

    // Fetch products as server 2
    const resProd2 = await axios.get('http://localhost:3000/api/products', {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Server-Id': '2' }
    });
    console.log("Server 2 Products (First 100 chars):", JSON.stringify(resProd2.data).substring(0, 100));

    // Fetch account as server 2
    const resAcc2 = await axios.get('http://localhost:3000/api/account', {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Server-Id': '2' }
    });
    console.log("Server 2 Account:", JSON.stringify(resAcc2.data));

  } catch (err) {
    console.error("Error:", err.response ? err.response.data : err.message);
  }
}
test();
