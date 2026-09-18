const { readDB, writeDB } = require('./db');

function initializeApp() {
  // Auto-repair script: Wipe any legacy negative debt from Admin accounts
  try {
    const users = readDB('users.json') || [];
    let fixed = false;
    users.forEach(u => {
      if (u.role === 'admin') {
        if (u.credits_1 !== 0) { u.credits_1 = 0; fixed = true; }
        if (u.credits_2 !== 0) { u.credits_2 = 0; fixed = true; }
        if (u.credits_3 !== 0) { u.credits_3 = 0; fixed = true; }
        if (u.credits !== 0) { u.credits = 0; fixed = true; }
      }
    });
    if (fixed) writeDB('users.json', users);
  } catch (e) {
    console.log('Auto-repair skipped', e);
  }

  // Force seed the primary admin user if missing
  let initUsers = readDB('users.json');
  if (!initUsers || !Array.isArray(initUsers)) initUsers = [];

  const angelExists = initUsers.find(u => u.username.toLowerCase() === 'angel');
  if (!angelExists) {
    initUsers = initUsers.filter(u => u.username !== 'admin');
    initUsers.push({
      id: Date.now(),
      username: 'Angel',
      password: 'angel067L',
      role: 'admin',
      credits: 0,
      credits_1: 0,
      credits_2: 0,
      credits_3: 0
    });
    writeDB('users.json', initUsers);
  }

  const initSettings = readDB('settings.json');
  if (!initSettings || !initSettings.server1 || !initSettings.server1.apiaccesskey) {
    writeDB('settings.json', {
      server1: {
        name: 'API Server 1',
        endpoint: 'https://latamgsm.com/dhru/',
        username: 'angeljuares067@gmail.com',
        apiaccesskey: 'pk60-qXSs-xXsF-qZPa',
        resellerMarkup: 0,
        clientMarkup: 0
      },
      server2: {
        name: 'POPI-GSM',
        endpoint: 'https://popi-gsm.com/public/',
        username: 'angeljuares067@gmail.com',
        apiaccesskey: 'B29Q-G7EJ-A3OU-629Z-VQYO-5ZX9-F8SE-QCRU',
        resellerMarkup: 0,
        clientMarkup: 0
      }
    });
  }

  // Permanent Wallet Migration on Startup
  const startupUsers = readDB('users.json') || [];
  let usersMigrated = false;
  startupUsers.forEach(user => {
    if (user.credits_1 === undefined) {
      user.credits_1 = parseFloat(user.credits || 0);
      user.credits_2 = 0;
      user.credits_3 = 0;
      delete user.credits;
      usersMigrated = true;
    }
  });
  if (usersMigrated) {
    writeDB('users.json', startupUsers);
    console.log('Migrated legacy users to separated wallets.');
  }
}

module.exports = {
  initializeApp
};
