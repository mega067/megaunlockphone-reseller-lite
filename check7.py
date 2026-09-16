import pexpect
import sys

script = """
const { callGsmThemeApi } = require('./src/helpers');
async function test() {
  try {
    const r = await callGsmThemeApi('https://www.unlockerfast.com.mx/api/index.php', 'imeiservicelist', null, 'MegaUnlockPhone', 'QXU-2HD-MAR-PKM-PAD-RFP-XK5-5ME');
    console.log('SUCCESS:', r.data?.SUCCESS ? 'YES' : 'NO');
    console.log('Data:', typeof r.data, JSON.stringify(r.data));
  } catch (e) {
    console.log('Error:', e.message);
  }
}
test();
"""

child = pexpect.spawn("ssh -o StrictHostKeyChecking=no megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net")
child.expect("assword:")
child.sendline("angel067L")
child.expect(r"\$")
child.sendline("cat << 'INNER_EOF' > ~/www/test_dhru.js\n" + script + "\nINNER_EOF")
child.expect(r"\$")
child.sendline("cd ~/www && node test_dhru.js")
child.expect(r"\$")
print(child.before.decode())
