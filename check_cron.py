import pexpect

cmd = "ssh -o StrictHostKeyChecking=no megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net 'crontab -l'"
child = pexpect.spawn(cmd, encoding='utf-8')
i = child.expect(['(?i)assword', '(?i)contrase.a', '(?i)passe', pexpect.EOF], timeout=10)
if i in (0, 1, 2):
    child.sendline('angel067L')
    child.expect(pexpect.EOF, timeout=10)
print("CRONTAB:", child.before)
