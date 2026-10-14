import pexpect
child = pexpect.spawn('ssh megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net "crontab -l"', encoding='utf-8')
child.expect('Password:')
child.sendline('angel067L')
child.expect(pexpect.EOF, timeout=10)
print(child.before)
