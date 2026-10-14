import pexpect
child = pexpect.spawn('ssh megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net "cat ~/www/server.js | grep -n ticketConfigRoutes"', encoding='utf-8')
child.expect('Password:')
child.sendline('angel067L')
child.expect(pexpect.EOF)
print(child.before)
