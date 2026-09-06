import re

with open('public/index.js', 'r') as f:
    code = f.read()

# 1. Update authRole check for adminPricesHtml
code = code.replace("if (authRole === 'admin') {", "if (authRole === 'admin' || authRole === 'colaborador') {")

# 2. Update authRole check for "Precio Reseller" rendering
code = code.replace("margin-bottom: ${authRole === 'admin' ? '5px' : '0'};", "margin-bottom: ${authRole === 'admin' || authRole === 'colaborador' ? '5px' : '0'};")
code = code.replace("${authRole === 'admin' ? 'Precio Reseller: ' : ''}", "${authRole === 'admin' || authRole === 'colaborador' ? 'Precio Reseller: ' : ''}")

# 3. Add 'colaborador' to User roles in index.js (render logic)
# Let's find where user roles are defined. Maybe they are in index.html!
# We will do this manually after inspecting index.html or index.js.
with open('public/index.js', 'w') as f:
    f.write(code)

print("Patch index.js successful!")
