const sqlite3 = require("better-sqlite3");
const fs = require('fs');
const db = sqlite3("/home/megaunlockphone-panel/www/data/database.sqlite");

const rows = db.prepare("SELECT orderId, data FROM OrdersHistory WHERE status='unknown'").all();
console.log(`Found ${rows.length} unknown orders`);

for (const row of rows) {
    if (row.data) {
        let orderObj = JSON.parse(row.data);
        orderObj.status = 'failed';
        db.prepare("UPDATE OrdersHistory SET status='failed', data=? WHERE orderId=?").run(JSON.stringify(orderObj), row.orderId);
        console.log(`Fixed order ${row.orderId}`);
    }
}
console.log('Done fixing db');
