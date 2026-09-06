import re

with open('public/index.html', 'r') as f:
    html = f.read()

# Add Role Select to Create User form
old_create_form = """                <div class="input-group">
                  <label>Saldo Inicial ($)</label>
                  <input type="number" id="newCredits" step="0.01" min="0" value="0.00">
                </div>"""
new_create_form = """                <div class="input-group">
                  <label>Saldo Inicial ($)</label>
                  <input type="number" id="newCredits" step="0.01" min="0" value="0.00">
                </div>
                <div class="input-group">
                  <label>Rol</label>
                  <select id="newRole" style="width: 100%; padding: 0.85rem; border-radius: 8px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); color: var(--text-color);">
                    <option value="reseller">Reseller</option>
                    <option value="colaborador">Colaborador</option>
                  </select>
                </div>"""

html = html.replace(old_create_form, new_create_form)
with open('public/index.html', 'w') as f:
    f.write(html)

print("Patch index.html successful!")
