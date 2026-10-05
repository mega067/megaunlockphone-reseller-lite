const axios = require('axios');
axios.get('http://localhost:29289/api/products?serverId=1', {
  headers: { 'Authorization': 'Bearer null' }
}).then(res => {
  if (res.data.SUCCESS && res.data.SUCCESS[0].LIST) {
    console.log("Success! Groups:", Object.keys(res.data.SUCCESS[0].LIST).length);
  } else {
    console.log("No list:", res.data);
  }
}).catch(err => console.log("Error:", err.message));
