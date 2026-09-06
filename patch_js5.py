import re

with open('public/index.js', 'r') as f:
    code = f.read()

# Replace the status-badge with a select dropdown for non-admins
old_badge = """                 <span class="status-badge ${u.role === 'admin' ? 'badge-category-server' : 'badge-category-imei'}" style="width:fit-content; font-size:0.7rem; padding: 2px 6px;">${u.role.toUpperCase()}</span>"""
new_badge = """                 ${u.role === 'admin' ? `<span class="status-badge badge-category-server" style="width:fit-content; font-size:0.7rem; padding: 2px 6px;">ADMIN</span>` : 
                   `<select class="role-select" data-id="${u.id}" style="width: fit-content; padding: 2px 6px; font-size: 0.7rem; background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); color: #c4b5fd; border-radius: 4px; outline: none; cursor: pointer;">
                      <option value="reseller" ${u.role === 'reseller' || !u.role ? 'selected' : ''}>RESELLER</option>
                      <option value="colaborador" ${u.role === 'colaborador' ? 'selected' : ''}>COLABORADOR</option>
                    </select>`
                 }"""
code = code.replace(old_badge, new_badge)

with open('public/index.js', 'w') as f:
    f.write(code)

print("Patch js5 successful!")
