import pexpect
cmd = "ssh -v -o StrictHostKeyChecking=no megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net"
child = pexpect.spawn(cmd, encoding='utf-8')
child.expect(pexpect.EOF, timeout=10)
print(child.before)
