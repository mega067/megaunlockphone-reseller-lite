import re

# Fix index.html
with open('public/index.html', 'r') as f:
    html = f.read()
html = html.replace('Ω OMEGA', '🔱 OMEGA')
html = html.replace('Ω', '🔱')  # catch any remaining
with open('public/index.html', 'w') as f:
    f.write(html)

# Fix index.js
with open('public/index.js', 'r') as f:
    js = f.read()
js = js.replace("'Ω", "'🔱")
js = js.replace("emoji: 'Ω'", "emoji: '🔱'")  # already caught by above
with open('public/index.js', 'w') as f:
    f.write(js)

# Fix server.js
with open('server.js', 'r') as f:
    srv = f.read()
srv = srv.replace("'3': 'Ω OMEGA-SERVER'", "'3': '🔱 OMEGA-SERVER'")
with open('server.js', 'w') as f:
    f.write(srv)

print("Done! All Ω replaced with 🔱")
