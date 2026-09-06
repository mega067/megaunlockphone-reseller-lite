import pexpect

cmd = "rsync -avzc --exclude 'node_modules' --exclude '.git' --exclude 'data' --exclude 'baileys_auth' --exclude '.wwebjs_auth' --exclude 'package-lock.json' ./ megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net:~/www/"
child = pexpect.spawn(cmd, encoding='utf-8')

while True:
    i = child.expect(['(?i)assword', '(?i)contrase.a', '(?i)passe', pexpect.EOF], timeout=60)
    if i in (0, 1, 2):
        child.sendline('angel067L')
    else:
        break
print(child.before)
