import pexpect
import sys
child = pexpect.spawn('ssh megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net "cat << \\"INNER\\" > test_db.js\nconst sqlite3 = require(\\"better-sqlite3\\");\nconst db = sqlite3(\\"/home/megaunlockphone-panel/www/data/database.sqlite\\");\nconsole.log(db.prepare(\\"SELECT status, statusText FROM OrdersHistory WHERE orderId=\'2230943\'\\").get());\nINNER\nnode test_db.js"', encoding='utf-8')
child.expect('Password:')
child.sendline('angel067L')
child.expect(pexpect.EOF, timeout=10)
print(child.before)
