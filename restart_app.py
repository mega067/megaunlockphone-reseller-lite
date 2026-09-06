import pexpect
cmd = "ssh -o StrictHostKeyChecking=no megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net 'mkdir -p www/tmp && touch www/tmp/restart.txt && killall node'"
child = pexpect.spawn(cmd, encoding='utf-8')
child.expect('assword:')
child.sendline('angel067L')
child.expect(pexpect.EOF, timeout=30)
print(child.before)
print("Restart done.")
