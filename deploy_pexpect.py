import pexpect
import sys

cmd = "rsync -avzc -e 'ssh -o StrictHostKeyChecking=no' --exclude 'node_modules' --exclude '.git' --exclude 'data' --exclude 'baileys_auth' --exclude '.wwebjs_auth' --exclude 'package-lock.json' ./ megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net:~/www/"
print("Starting rsync...")
child = pexpect.spawn(cmd, encoding='utf-8')

i = child.expect(['(?i)assword', '(?i)contrase.a', '(?i)passe', pexpect.EOF], timeout=120)
if i in (0, 1, 2):
    child.sendline('angel067L')
    child.expect(pexpect.EOF, timeout=300)

print(child.before)
print("Done.")
