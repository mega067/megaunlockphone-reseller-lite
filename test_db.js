const sqlite3 = require("better-sqlite3");
const db = sqlite3("/home/megaunlockphone-panel/www/data/database.sqlite");
console.log(db.prepare("SELECT data FROM OrdersHistory WHERE orderId='2230943'").get());
