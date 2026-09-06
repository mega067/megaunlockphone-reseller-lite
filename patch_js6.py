import re

with open('public/index.js', 'r') as f:
    code = f.read()

# I will find "document.querySelectorAll('.user-markup-input').forEach(input => {"
# and prepend the listener for .role-select
old_listener = """        document.querySelectorAll('.user-markup-input').forEach(input => {"""
new_listener = """        document.querySelectorAll('.role-select').forEach(select => {
          select.addEventListener('change', async (e) => {
            const id = e.target.dataset.id;
            const val = e.target.value;
            try {
              const res = await fetch(`/api/users/${id}`, {
                method: 'PUT',
                headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ role: val })
              });
              if(res.ok) {
                e.target.style.borderColor = '#10b981';
                setTimeout(() => e.target.style.borderColor = 'rgba(139, 92, 246, 0.3)', 1500);
              } else {
                e.target.style.borderColor = '#ef4444';
              }
            } catch (err) {
              console.error(err);
            }
          });
        });

        document.querySelectorAll('.user-markup-input').forEach(input => {"""
code = code.replace(old_listener, new_listener)

with open('public/index.js', 'w') as f:
    f.write(code)

print("Patch js6 successful!")
