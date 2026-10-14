import pexpect
child = pexpect.spawn('scp test_api_2230943.js megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net:~/www/test_api_2230943.js', encoding='utf-8')
child.expect('Password:')
child.sendline('angel067L')
child.expect(pexpect.EOF, timeout=30)

child2 = pexpect.spawn('ssh megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net "cd ~/www && node test_api_2230943.js"', encoding='utf-8')
child2.expect('Password:')
child2.sendline('angel067L')
child2.expect(pexpect.EOF, timeout=30)
print(child2.before)
