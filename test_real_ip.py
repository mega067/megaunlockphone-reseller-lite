import pexpect
child = pexpect.spawn('ssh megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net "cat << \'INNER\' > ~/www/getip.js\nconst axios = require(\'axios\'); axios.get(\'https://api.ipify.org?format=json\').then(res => console.log(res.data.ip));\nINNER\nnode ~/www/getip.js"', encoding='utf-8')
child.expect('Password:')
child.sendline('angel067L')
child.expect(pexpect.EOF, timeout=10)
print(child.before)
