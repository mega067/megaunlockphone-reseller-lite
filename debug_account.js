const axios = require('axios');
axios.post('http://localhost:3000/api/account', {
  username: 'angeljuares067@gmail.com',
  apiaccesskey: 'angel067L', // I will use the actual key the user put in the UI... wait, I don't know it. The user said "ya puse la api key", meaning they typed it into the browser!
}).then(res => console.log(JSON.stringify(res.data, null, 2)))
  .catch(err => console.error(err.message));
