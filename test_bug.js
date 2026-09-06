const fs = require('fs');

function getServerSettings(settings, serverId) {
  if (!settings) return null;
  
  let s = {};
  if (serverId === '3') {
    s = settings.server3 || {};
    s.endpoint = s.endpoint || "https://territorioremoto.com/";
    s.username = s.username || "angeljuares067";
    s.apiaccesskey = s.apiaccesskey || "0QT-IVG-18E-FVU-KKB-IGA-QOT-Q95";
  } else if (serverId === '2') {
    s = settings.server2 || {};
    s.endpoint = s.endpoint || "https://popi-gsm.com/public/";
    s.username = s.username || "angeljuares067@gmail.com";
    s.apiaccesskey = s.apiaccesskey || "B29Q-G7EJ-A3OU-629Z-VQYO-5ZX9-F8SE-QCRU";
  } else {
    // Server 1 (LatamGSM) with legacy fallback support
    s = settings.server1 || {};
    s.endpoint = s.endpoint || settings.endpoint || "https://latamgsm.com/dhru/";
    s.username = s.username || settings.username || settings.masterUsername || "angeljuares067@gmail.com";
    s.apiaccesskey = s.apiaccesskey || settings.apiaccesskey || "pk60-qXSs-xXsF-qZPa";
  }

  s.resellerMarkup = s.resellerMarkup || settings.resellerMarkup || 0;
  s.clientMarkup = s.clientMarkup || settings.clientMarkup || 0;
  
  return s;
}

let mockSettings = {
  endpoint: "https://latamgsm.com/dhru/",
  masterUsername: "angeljuares067@gmail.com",
  apiaccesskey: "pk60-qXSs-xXsF-qZPa",
  server3: { resellerMarkup: 0, clientMarkup: 0 }
};

let settings = getServerSettings(mockSettings, '3');
console.log('Settings for 3:', settings);
if (!settings || !settings.username || !settings.apiaccesskey) {
  console.log('Error: Settings misconfigured for Server 3');
} else {
  console.log('Success for 3');
}
