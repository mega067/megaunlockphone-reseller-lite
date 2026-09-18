import pexpect
import sys
child = pexpect.spawn("ssh -o StrictHostKeyChecking=no megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net 'cat ~/www/server.js | grep api/bot/catalog'")
child.expect("assword:")
child.sendline("angel067L")
child.expect(pexpect.EOF)
print(child.before.decode())
