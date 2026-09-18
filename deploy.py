import pexpect
import sys

child = pexpect.spawn('./deploy.sh', encoding='utf-8')
child.expect('Password:')
child.sendline('angel067L')
child.expect(pexpect.EOF)
print(child.before)
