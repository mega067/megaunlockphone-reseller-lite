import re

with open('public/index.js', 'r') as f:
    code = f.read()

# We will revert ALL occurrences back to "if (authRole === 'admin') {"
# and then manually add it to the correct places.
code = code.replace("if (authRole === 'admin' || authRole === 'colaborador') {", "if (authRole === 'admin') {")

# 1. Price form listeners
code = re.sub(r"if \(authRole === 'admin'\) {\s*document\.querySelectorAll\('\.custom-price-form'\)",
              r"if (authRole === 'admin' || authRole === 'colaborador') {\n      document.querySelectorAll('.custom-price-form')", code)

# 2. adminPricesHtml in renderProducts
# Let's find "let adminPricesHtml = '';"
# "if (authRole === 'admin') {" right after it.
code = re.sub(r"let adminCustomPriceHtml = '';\s*if \(authRole === 'admin'\) {",
              r"let adminCustomPriceHtml = '';\n      if (authRole === 'admin' || authRole === 'colaborador') {", code)

# 3. For the UI display strings (which use ternary operators)
# They are fine as they are because I did:
# code = code.replace("margin-bottom: ${authRole === 'admin' ? '5px' : '0'};", "margin-bottom: ${authRole === 'admin' || authRole === 'colaborador' ? '5px' : '0'};")
# I only did that exact string replacement.

with open('public/index.js', 'w') as f:
    f.write(code)

print("Patch js7 successful!")
