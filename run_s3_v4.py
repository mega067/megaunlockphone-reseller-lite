import pexpect

cmd = "scp -o StrictHostKeyChecking=no test_s3_v4.js megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net:/home/megaunlockphone-panel/www/test_s3_v4.js"
child = pexpect.spawn(cmd, encoding='utf-8')
i = child.expect(['(?i)assword', '(?i)contrase.a', '(?i)passe', pexpect.EOF], timeout=10)
if i in (0, 1, 2):
    child.sendline('angel067L')
    child.expect(pexpect.EOF, timeout=10)

cmd2 = "ssh -o StrictHostKeyChecking=no megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net 'cd /home/megaunlockphone-panel/www && node test_s3_v4.js'"
child2 = pexpect.spawn(cmd2, encoding='utf-8')
j = child2.expect(['(?i)assword', '(?i)contrase.a', '(?i)passe', pexpect.EOF], timeout=10)
if j in (0, 1, 2):
    child2.sendline('angel067L')
    child2.expect(pexpect.EOF, timeout=20)
print(child2.before)

