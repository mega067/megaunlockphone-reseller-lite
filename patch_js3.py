import re

with open('public/index.js', 'r') as f:
    code = f.read()

# Add listener for .role-select changes in renderUsers()
old_listeners = """      document.querySelectorAll('.btn-edit-user').forEach(btn => {"""
new_listeners = """      document.querySelectorAll('.role-select').forEach(select => {
        select.addEventListener('change', async (e) => {
          const userId = e.target.getAttribute('data-id');
          const newRole = e.target.value;
          try {
            const res = await fetch(`/api/users/${userId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}`, 'X-Server-Id': currentServerId },
              body: JSON.stringify({ role: newRole })
            });
            const data = await res.json();
            if (res.ok) {
              alert('Rol actualizado correctamente');
              fetchUsers();
            } else {
              alert('Error: ' + (data.error || 'Desconocido'));
            }
          } catch (err) {
            alert('Error actualizando rol: ' + err.message);
          }
        });
      });
      document.querySelectorAll('.btn-edit-user').forEach(btn => {"""
code = code.replace(old_listeners, new_listeners)

with open('public/index.js', 'w') as f:
    f.write(code)

print("Patch js3 successful!")
