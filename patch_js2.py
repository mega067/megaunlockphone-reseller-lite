import re

with open('public/index.js', 'r') as f:
    code = f.read()

# Fix user creation submission
old_submit = """        body: JSON.stringify({ username, password, credits: creditsVal, role: 'reseller' })"""
new_submit = """        body: JSON.stringify({ username, password, credits: creditsVal, role: document.getElementById('newRole') ? document.getElementById('newRole').value : 'reseller' })"""
code = code.replace(old_submit, new_submit)

# Fix user edit rendering (which is inside function renderUsers())
old_edit = """          <div class="user-actions">
            <button type="button" class="btn btn-primary btn-small btn-edit-user" data-id="${u.id}">"""
new_edit = """          <div class="user-actions">
            <select class="role-select" data-id="${u.id}" style="padding: 4px; background: rgba(0,0,0,0.5); border: 1px solid #333; color: white; border-radius: 4px;">
              <option value="reseller" ${u.role === 'reseller' || !u.role ? 'selected' : ''}>Reseller</option>
              <option value="colaborador" ${u.role === 'colaborador' ? 'selected' : ''}>Colaborador</option>
            </select>
            <button type="button" class="btn btn-primary btn-small btn-edit-user" data-id="${u.id}">"""
code = code.replace(old_edit, new_edit)

with open('public/index.js', 'w') as f:
    f.write(code)

print("Patch js2 successful!")
