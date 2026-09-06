import pexpect

cmd = "ssh -o StrictHostKeyChecking=no megaunlockphone-panel@ssh-megaunlockphone-panel.alwaysdata.net 'cat << \\\"INNER_EOF\\\" > test_dhru2.js\\nconst axios = require(\\\"axios\\\");\\nconst fs = require(\\\"fs\\\");\\nconst settings = JSON.parse(fs.readFileSync(\\\"./data/settings.json\\\", \\\"utf8\\\"));\\nconst targetUrl = settings.server1.endpoint.endsWith(\\\"/\\\") ? settings.server1.endpoint + \\\"api/index.php\\\" : settings.server1.endpoint + \\\"/api/index.php\\\";\\nconst username = settings.server1.username;\\nconst apiaccesskey = settings.server1.apiaccesskey;\\nasync function fetch(action) {\\nconst params = new URLSearchParams();\\nparams.append(\\\"username\\\", username);\\nparams.append(\\\"apiaccesskey\\\", apiaccesskey);\\nparams.append(\\\"action\\\", action);\\nparams.append(\\\"requestformat\\\", \\\"JSON\\\");\\ntry {\\nconst r = await axios.post(targetUrl, params.toString());\\nif (r.data && r.data.SUCCESS && r.data.SUCCESS[0] && r.data.SUCCESS[0].LIST) {\\nconst list = r.data.SUCCESS[0].LIST;\\nfor(const g in list) {\\nconst srvs = list[g].SERVICES;\\nfor(const k in srvs) {\\nif(srvs[k].SERVICEID == 154) { console.log(\\\"FOUND IN\\\", action, JSON.stringify(srvs[k])); return; }\\n}\\n}\\n}\\n} catch(e) { console.error(e.message); }\\n}\\nfetch(\\\"imeiorderservices\\\").then(()=>fetch(\\\"serverorderservices\\\"));\\nINNER_EOF\\ncd ~/www && node test_dhru2.js'"
child = pexpect.spawn(cmd, encoding='utf-8')

i = child.expect(['(?i)assword', '(?i)contrase.a', '(?i)passe', pexpect.EOF], timeout=10)
if i in (0, 1, 2):
    child.sendline('angel067L')
    child.expect(pexpect.EOF, timeout=30)

print(child.before)
