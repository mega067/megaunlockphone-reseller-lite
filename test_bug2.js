const fs = require('fs');

function getServerSettings(settings, serverId) {
  if (!settings) return null;
  
  let s = {};
  if (serverId === '3') {
    s = settings.server3 || {};
    s.endpoint = s.endpoint || "https://territorioremoto.com/";
    s.username = s.username || "angeljuares067";
    s.apiaccesskey = s.apiaccesskey || "0QT-IVG-18E-FVU-KKB-IGA-QOT-Q95";
  }
  return s;
}

console.log(getServerSettings({ server3: { username: "" } }, '3'));
