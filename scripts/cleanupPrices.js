const fs = require('fs');
const path = require('path');

const customPricesPath = path.join(__dirname, '..', 'data', 'custom_prices.json');

try {
  if (fs.existsSync(customPricesPath)) {
    const customPrices = JSON.parse(fs.readFileSync(customPricesPath, 'utf8'));
    let modified = false;
    let count = 0;

    for (const serverKey in customPrices) {
      const serverPrices = customPrices[serverKey];
      for (const serviceId in serverPrices) {
        const item = serverPrices[serviceId];
        // Check if value is null, NaN, or literally an empty string!
        if (
          item.resellerPrice === null || 
          item.clientPrice === null || 
          item.resellerPrice === "" || 
          item.clientPrice === "" || 
          (typeof item.resellerPrice === 'string' && item.resellerPrice.trim() === '') ||
          (typeof item.clientPrice === 'string' && item.clientPrice.trim() === '') ||
          Number.isNaN(Number(item.resellerPrice)) || 
          Number.isNaN(Number(item.clientPrice))
        ) {
          delete serverPrices[serviceId];
          modified = true;
          count++;
        }
      }
    }

    if (modified) {
      fs.writeFileSync(customPricesPath, JSON.stringify(customPrices, null, 2));
      console.log(`Se han limpiado ${count} precios inválidos (vacíos o NaN) de custom_prices.json`);
    } else {
      console.log('No se encontraron precios inválidos en custom_prices.json');
    }
  } else {
    console.log('custom_prices.json no existe, nada que limpiar.');
  }
} catch (e) {
  console.error('Error al limpiar:', e.message);
}
