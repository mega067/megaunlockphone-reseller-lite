import pexpect
child = pexpect.spawn('ssh megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net "mkdir -p ~/www/tmp && touch ~/www/tmp/restart.txt && touch ~/admin/tmp/restart.txt"', encoding='utf-8')
child.expect('Password:')
child.sendline('angel067L')
child.expect(pexpect.EOF)
print(child.before)
