import pexpect
child = pexpect.spawn('ssh megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net "grep -A 2 -B 2 index.js ~/www/public/index.html"', encoding='utf-8')
child.expect('Password:')
child.sendline('angel067L')
child.expect(pexpect.EOF, timeout=10)
print(child.before)
