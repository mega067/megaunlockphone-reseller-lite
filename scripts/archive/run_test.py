import pexpect
child = pexpect.spawn('scp test_db.js megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net:~/www/test_db.js', encoding='utf-8')
child.expect('Password:')
child.sendline('angel067L')
child.expect(pexpect.EOF, timeout=10)

child2 = pexpect.spawn('ssh megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net "cd ~/www && node test_db.js"', encoding='utf-8')
child2.expect('Password:')
child2.sendline('angel067L')
child2.expect(pexpect.EOF, timeout=10)
print(child2.before)
