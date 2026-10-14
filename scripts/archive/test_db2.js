const sqlite3 = require("better-sqlite3");
const fs = require('fs');
const db = sqlite3("/home/megaunlockphone-panel/www/data/database.sqlite");

const rows = db.prepare("SELECT orderId, serverId FROM OrdersHistory WHERE orderId='2230943'").all();
console.log(rows);
