import pexpect
import sys
child = pexpect.spawn('ssh megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net "curl -sS http://localhost:8100/api/trigger-s3-bind"', encoding='utf-8')
child.expect('Password:')
child.sendline('angel067L')
child.expect(pexpect.EOF, timeout=15)
print(child.before)
