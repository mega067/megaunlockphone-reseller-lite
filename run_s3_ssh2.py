import pexpect

cmd2 = "ssh -o StrictHostKeyChecking=no megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net 'mv /home/megaunlockphone-panel/test_s3.js /home/megaunlockphone-panel/www/test_s3.js && cd /home/megaunlockphone-panel/www && node test_s3.js'"
child2 = pexpect.spawn(cmd2, encoding='utf-8')
j = child2.expect(['(?i)assword', '(?i)contrase.a', '(?i)passe', pexpect.EOF], timeout=10)
if j in (0, 1, 2):
    child2.sendline('angel067L')
    child2.expect(pexpect.EOF, timeout=20)
print(child2.before)

