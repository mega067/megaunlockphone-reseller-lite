const { getDepositAccount } = require('./paymentRouter');
const fs = require('fs');

async function test() {
  const settingsDb = JSON.parse(fs.readFileSync('data/settings.json', 'utf8'));
  const creditCushion = parseFloat(settingsDb.creditCushion || 0);
  
  const creditMXN = 500;
  const cedido = 100;
  const userRequested = 50;
  
  let serverLiquidity = creditMXN - cedido - creditCushion;
  if (serverLiquidity < 0) serverLiquidity = 0;
  
  console.log(`Credit MXN: ${creditMXN}`);
  console.log(`Cedido: ${cedido}`);
  console.log(`Credit Cushion: ${creditCushion}`);
  console.log(`Server Liquidity: ${serverLiquidity}`);
  console.log(`User Requested: ${userRequested}`);
  
  const result = await getDepositAccount(userRequested, '40012', serverLiquidity, 'INTELLIGENT', 'latamgsm');
  console.log('Result Account:', result.account.bankName);
}

test();
