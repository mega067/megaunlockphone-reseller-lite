const axios = require('axios');
async function test() {
  try {
    const payload = {
      tarjeta: '19', 
      tipoCriterio: 'T', 
      criterio: 'NU3AJ7A3SGB78GL9NU10S6BRQG0I', // from screenshot
      emisor: '40638',
      monto: '150',
      correo: 'angeljuares067@gmail.com',
      banco: 1, 
      _token: 'b5I0vEe9NEEkBTGA6TzoIJb2wA7ilWuNb6e837Cf' 
    };
    const response = await axios.post('https://autopay.automatizaciondepagos.com/api/comprobarpago/transferencia/qHZr-9roe-mESb-76rs', new URLSearchParams(payload).toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    console.log("RESPONSE:", response.data);
  } catch(e) {
    console.log("ERROR:", e.response ? e.response.status : e.message);
    if(e.response) console.log(e.response.data);
  }
}
test();
