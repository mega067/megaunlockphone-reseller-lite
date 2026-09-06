import pexpect, json

cmd = "ssh -o StrictHostKeyChecking=no megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net 'ls -la /home/megaunlockphone-panel/www/data/ && cat /home/megaunlockphone-panel/www/data/orders.json 2>/dev/null | head -c 2000'"
child = pexpect.spawn(cmd, encoding='utf-8')
i = child.expect(['(?i)assword', '(?i)contrase.a', '(?i)passe', pexpect.EOF], timeout=10)
if i in (0, 1, 2):
    child.sendline('angel067L')
    child.expect(pexpect.EOF, timeout=15)
print(child.before[-3000:])
