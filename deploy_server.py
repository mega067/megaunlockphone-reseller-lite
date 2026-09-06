import pexpect
import os

with open('server.js', 'r') as f:
    content = f.read()

cmd = "ssh -o StrictHostKeyChecking=no megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net 'cat > ~/www/server.js'"
child = pexpect.spawn(cmd, encoding='utf-8')

i = child.expect(['(?i)assword', '(?i)contrase.a', '(?i)passe', pexpect.EOF], timeout=10)
if i in (0, 1, 2):
    child.sendline('angel067L')

child.sendline(content)
child.sendeof()
child.expect(pexpect.EOF, timeout=30)
print("Done deploy")
