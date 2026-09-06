import pexpect, time

script = """
const axios = require('axios');
const fs = require('fs');
let settings;
try {
  settings = JSON.parse(fs.readFileSync('/home/megaunlockphone-panel/www/data/settings.json')).server3;
} catch(e) {
  console.log("No settings");
  process.exit();
}
let targetUrl = settings.endpoint.endsWith('/') ? settings.endpoint + 'api/index.php' : settings.endpoint + '/api/index.php';

async function test(action, xml) {
  const params = new URLSearchParams();
  params.append('username', settings.username);
  params.append('apiaccesskey', settings.apiaccesskey);
  params.append('action', action);
  params.append('requestformat', 'JSON');
  if (xml) params.append('parameters', xml);
  
  try {
    const response = await axios.post(targetUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' }
    });
    return response.data;
  } catch (e) {
    return { error: e.message };
  }
}

async function run() {
  const srvList = await test('imeiservicelist', null);
  if (srvList && srvList.SUCCESS) {
      console.log("Services loaded successfully");
      const list = srvList.SUCCESS[0].LIST;
      let targetService = null;
      for (const g in list) {
          const srvs = list[g].SERVICES;
          for (const k in srvs) {
              const str = JSON.stringify(srvs[k]);
              if (str.includes('Custom') || str.includes('custom')) {
                  targetService = srvs[k];
                  break;
              }
          }
          if (targetService) break;
      }
      
      if (!targetService) {
          console.log("No custom fields required anywhere in server 3.");
      } else {
          console.log("Testing service:", targetService.SERVICEID);
          const sid = targetService.SERVICEID;
          const fieldname = targetService.Requires.Custom[0].fieldname || "PlayerID";
          
          // Test 1: XML Sub-tags
          const xml1 = \`<PARAMETERS><ID>\${sid}</ID><IMEI>111111111111111</IMEI><QNT>1</QNT><CUSTOMFIELD><\${fieldname}>test</\${fieldname}></CUSTOMFIELD></PARAMETERS>\`;
          console.log("XML Tags test:", JSON.stringify(await test('placeimeiorder', xml1)));
          
          // Test 2: Base64 JSON
          const b64 = Buffer.from(JSON.stringify({[fieldname]: "test"})).toString('base64');
          const xml2 = \`<PARAMETERS><ID>\${sid}</ID><IMEI>111111111111111</IMEI><QNT>1</QNT><CUSTOMFIELD>\${b64}</CUSTOMFIELD></PARAMETERS>\`;
          console.log("Base64 JSON test:", JSON.stringify(await test('placeimeiorder', xml2)));
      }
  } else {
      console.log("Failed to load services:", srvList);
  }
}
run();
"""

with open('test_s3.js', 'w') as f:
    f.write(script)

cmd = "scp -o StrictHostKeyChecking=no test_s3.js megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net:/home/megaunlockphone-panel/test_s3.js"
child = pexpect.spawn(cmd, encoding='utf-8')
i = child.expect(['(?i)assword', '(?i)contrase.a', '(?i)passe', pexpect.EOF], timeout=10)
if i in (0, 1, 2):
    child.sendline('angel067L')
    child.expect(pexpect.EOF, timeout=10)

cmd2 = "ssh -o StrictHostKeyChecking=no megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net 'node /home/megaunlockphone-panel/test_s3.js'"
child2 = pexpect.spawn(cmd2, encoding='utf-8')
j = child2.expect(['(?i)assword', '(?i)contrase.a', '(?i)passe', pexpect.EOF], timeout=10)
if j in (0, 1, 2):
    child2.sendline('angel067L')
    child2.expect(pexpect.EOF, timeout=20)
print(child2.before)

