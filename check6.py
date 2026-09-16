import pexpect
import sys
child = pexpect.spawn("ssh -o StrictHostKeyChecking=no megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net \"node -e \\\"const { callGsmThemeApi } = require('./src/helpers'); async function test() { try { const r = await callGsmThemeApi('https://www.unlockerfast.com.mx/api/index.php', 'imeiservicelist', null, 'MegaUnlockPhone', 'QXU-2HD-MAR-PKM-PAD-RFP-XK5-5ME'); console.log('SUCCESS:', r.data?.SUCCESS ? 'YES' : 'NO'); console.log('Data:', typeof r.data, r.data); } catch (e) { console.log('Error:', e.message); } } test();\\\"\"")
child.expect("assword:")
child.sendline("angel067L")
child.expect(pexpect.EOF)
print(child.before.decode())
