import re

with open('public/index.js', 'r') as f:
    code = f.read()

old_check = "    if (authRole === 'admin') {"
new_check = "    if (authRole === 'admin' || authRole === 'colaborador') {"

# Let's find occurrences of "if (authRole === 'admin') {" after renderProducts (line 1582)
# We will use regex to find the one right before "document.querySelectorAll('.custom-price-form')"
code = re.sub(r"if \(authRole === 'admin'\) {\s*document\.querySelectorAll\('\.custom-price-form'\)",
              r"if (authRole === 'admin' || authRole === 'colaborador') {\n      document.querySelectorAll('.custom-price-form')", code)

with open('public/index.js', 'w') as f:
    f.write(code)

print("Patch js4 successful!")
