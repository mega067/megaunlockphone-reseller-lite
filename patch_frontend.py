import re

with open('public/index.js', 'r') as f:
    js_code = f.read()

# Replace the login handler content
login_regex = r"(credentialsForm\.addEventListener\('submit', async \(e\) => \{.*?)(if \(res\.ok\) \{)"
replacement = r"""\1
      if (res.status === 403 && data.requireEmail) {
         showEmailLinkModal(data.tempId);
         return;
      }
      if (res.status === 403 && data.require2FA) {
         showTotpModal(username, password);
         return;
      }
      if (!res.ok) {
         alert(data.error || 'Error de inicio de sesión');
         return;
      }
      \2"""

js_code = re.sub(login_regex, replacement, js_code, flags=re.DOTALL)

with open('public/index.js', 'w') as f:
    f.write(js_code)

print("index.js patched")
