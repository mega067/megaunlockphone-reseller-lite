import pexpect

cmd = "ssh -o StrictHostKeyChecking=no megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net 'cd /home/megaunlockphone-panel/www && npm install'"
child = pexpect.spawn(cmd, encoding='utf-8')
i = child.expect(['(?i)assword', '(?i)contrase.a', '(?i)passe', pexpect.EOF], timeout=10)
if i in (0, 1, 2):
    child.sendline('angel067L')

child.expect(pexpect.EOF, timeout=120)
print(child.before)
