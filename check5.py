import pexpect
import sys
child = pexpect.spawn("ssh -o StrictHostKeyChecking=no megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net \"node -e \\\"const axios=require('axios'); axios.post('https://megaunlockphone-panel.alwaysdata.net/api/bot/catalog', {botSecret:'MEGA_BOT_SECRET_2026',serverId:'3'}).then(r=>console.log(r.status, typeof r.data, r.data)).catch(e=>console.log(e.response.status, e.response.data))\\\"\"")
child.expect("assword:")
child.sendline("angel067L")
child.expect(pexpect.EOF)
print(child.before.decode())
