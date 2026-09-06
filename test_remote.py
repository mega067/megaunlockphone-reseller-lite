import pexpect
cmd = "ssh -o StrictHostKeyChecking=no megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net 'ls -l www/server.js && tail -n 20 www/server_logs.txt'"
child = pexpect.spawn(cmd, encoding='utf-8')
child.expect('assword:')
child.sendline('angel067L')
child.expect(pexpect.EOF, timeout=30)
print(child.before)
