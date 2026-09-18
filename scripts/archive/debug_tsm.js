const fs = require('fs');

const s = {
  SERVICEID: 64715,
  SERVICENAME: "TSM TOOL RENT 3 Hour SOURCE 2",
  CREDIT: "11"
};

const settingsDb = JSON.parse(fs.readFileSync('data/settings.json', 'utf8'));
const prices = JSON.parse(fs.readFileSync('data/prices_3.json', 'utf8'));
const users = JSON.parse(fs.readFileSync('data/users.json', 'utf8'));
const req = { user: users.find(u => u.id === 1) }; // Admin #1
const serverId = '3';
const settings = settingsDb.server3;

const serviceid = s.SERVICEID || s.serviceid;

let realCost = prices[serviceid] !== undefined ? prices[serviceid] : null;
console.log("prices[serviceid]:", prices[serviceid]);
if (realCost === null) {
  const exchangeRate = parseFloat(settingsDb.exchangeRate || 17.60);
  const rate = serverId === '3' ? 1 : exchangeRate;
  realCost = parseFloat(s.CREDIT || '0') * rate;
}
console.log("realCost:", realCost);

let activeMarkup = parseFloat(req.user.markup); 
if (isNaN(activeMarkup)) activeMarkup = parseFloat(settings.resellerMarkup); 
if (isNaN(activeMarkup)) activeMarkup = 0;

console.log("activeMarkup:", activeMarkup);

const resellerCost = Math.ceil(realCost + activeMarkup);
console.log("resellerCost:", resellerCost);
console.log("isNaN(resellerCost):", isNaN(resellerCost));

