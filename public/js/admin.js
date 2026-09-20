async function loadAdminData() {
  try {
    const statsRes = await fetch('/api/admin/stats', { headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` }});
    if (statsRes.ok) {
      const stats = await statsRes.json();
      adminProfitDisplay.textContent = `$${parseFloat(stats.profitBalance || 0).toFixed(2)} MXN`;
    }

    const settingsRes = await fetch('/api/admin/settings', { headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` }});
    if (settingsRes.ok) {
      const set = await settingsRes.json();
      const currentSet = currentServerId === '3' ? set.server3 : (currentServerId === '2' ? set.server2 : set.server1);
      if (currentSet) {
        if (inputResellerTier1) inputResellerTier1.value = parseFloat(currentSet.resellerTier1 || currentSet.resellerMarkup || 0).toFixed(2);
        if (inputResellerTier2) inputResellerTier2.value = parseFloat(currentSet.resellerTier2 || currentSet.resellerMarkup || 0).toFixed(2);
        if (inputResellerTier3) inputResellerTier3.value = parseFloat(currentSet.resellerTier3 || 0).toFixed(2);
        if (inputClientTier1) inputClientTier1.value = parseFloat(currentSet.clientTier1 || currentSet.clientMarkup || 0).toFixed(2);
        if (inputClientTier2) inputClientTier2.value = parseFloat(currentSet.clientTier2 || currentSet.clientMarkup || 0).toFixed(2);
        if (inputClientTier3) inputClientTier3.value = parseFloat(currentSet.clientTier3 || 0).toFixed(2);
      }
      const inputExchangeRate = document.getElementById('inputExchangeRate');
      if (inputExchangeRate) {
        inputExchangeRate.value = parseFloat(set.exchangeRate || 17.60).toFixed(2);
      }
    }
    
    const lbl = document.getElementById('settingsCurrentServerLabel');
    if (lbl) {
      const sNames = {'1': '⚡ MEGA-SERVER', '2': '🛡 ALPHA-SERVER', '3': '🔱 OMEGA-SERVER'};
      lbl.textContent = sNames[currentServerId] || 'MEGA-SERVER';
    }

    // Load Group Markups
    const groupMarkupsContainer = document.getElementById('groupMarkupsContainer');
    if (groupMarkupsContainer) {
      // Show spinner immediately
      groupMarkupsContainer.innerHTML = '<div class="spinner-container" style="padding: 40px 0; grid-column: 1 / -1;"><div class="spinner"></div><p style="text-align:center; margin-top:10px;">Cargando grupos...</p></div>';
      
      try {
        const gmRes = await fetch('/api/admin/group-markups', { headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` }});
        if (gmRes.ok) {
          const gmData = await gmRes.json();
          const serverGmData = gmData['server' + currentServerId] || {};
          
          // Extract unique groups from productsList
          const uniqueGroups = [...new Set(productsList.map(p => p.group || 'Otros Servicios'))].sort();
          
          if (uniqueGroups.length === 0) {
            groupMarkupsContainer.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 20px; grid-column: 1 / -1;">No hay grupos cargados. Asegúrate de sincronizar los productos primero.</div>';
          } else {
            // Yield to event loop to ensure spinner is painted
            await new Promise(r => setTimeout(r, 10));
            
            groupMarkupsContainer.innerHTML = '';
            uniqueGroups.forEach(groupName => {
              const gm = serverGmData[groupName] || { type: 'tier1', value: '', clientType: 'tier1', clientValue: '' };
              const safeId = groupName.replace(/[^a-zA-Z0-9]/g, '_');
              
              const card = document.createElement('div');
              card.className = 'group-markup-card';
              card.dataset.groupname = groupName.toLowerCase();
              card.style.cssText = 'background: rgba(0,0,0,0.2); padding: 12px; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.1);';
              card.innerHTML = `
                <h4 style="margin: 0 0 10px 0; font-size: 0.95rem; color: #fff;">${escapeHtml(groupName)}</h4>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <label style="width: 70px; font-size: 0.8rem; color: #9ca3af;">Reseller:</label>
                    <select id="gm_type_r_${safeId}" class="form-control" style="width: auto; padding: 4px; font-size: 0.8rem;" onchange="document.getElementById('gm_val_r_${safeId}').style.display = (this.value.startsWith('tier') ? 'none' : 'block')">
                      <option value="fixed" ${gm.type === 'fixed' ? 'selected' : ''}>$ MXN</option>
                      <option value="percent" ${gm.type === 'percent' ? 'selected' : ''}>% Porc.</option>
                      <option value="tier1" ${gm.type === 'tier1' ? 'selected' : ''}>Económicos (Tier 1)</option>
                      <option value="tier2" ${gm.type === 'tier2' ? 'selected' : ''}>Medios (Tier 2)</option>
                      <option value="tier3" ${gm.type === 'tier3' ? 'selected' : ''}>Premium (Tier 3)</option>
                    </select>
                    <input type="number" id="gm_val_r_${safeId}" step="0.01" min="0" value="${gm.value || ''}" placeholder="Ej: 20" class="form-control" style="flex: 1; padding: 4px; font-size: 0.8rem; display: ${gm.type && gm.type.startsWith('tier') ? 'none' : 'block'};" data-group="${escapeHtml(groupName)}">
                  </div>
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <label style="width: 70px; font-size: 0.8rem; color: #9ca3af;">Cliente:</label>
                    <select id="gm_type_c_${safeId}" class="form-control" style="width: auto; padding: 4px; font-size: 0.8rem;" onchange="document.getElementById('gm_val_c_${safeId}').style.display = (this.value.startsWith('tier') ? 'none' : 'block')">
                      <option value="fixed" ${gm.clientType === 'fixed' ? 'selected' : ''}>$ MXN</option>
                      <option value="percent" ${gm.clientType === 'percent' ? 'selected' : ''}>% Porc.</option>
                      <option value="tier1" ${gm.clientType === 'tier1' ? 'selected' : ''}>Económicos (Tier 1)</option>
                      <option value="tier2" ${gm.clientType === 'tier2' ? 'selected' : ''}>Medios (Tier 2)</option>
                      <option value="tier3" ${gm.clientType === 'tier3' ? 'selected' : ''}>Premium (Tier 3)</option>
                    </select>
                    <input type="number" id="gm_val_c_${safeId}" step="0.01" min="0" value="${gm.clientValue || ''}" placeholder="Ej: 50" class="form-control" style="flex: 1; padding: 4px; font-size: 0.8rem; display: ${gm.clientType && gm.clientType.startsWith('tier') ? 'none' : 'block'};" data-group="${escapeHtml(groupName)}">
                  </div>
                </div>
              `;
              groupMarkupsContainer.appendChild(card);
            });
          }
        }
      } catch (e) {
        console.error('Error loading group markups', e);
      }
    }

    // Load Auto-Backups
    const autobackupList = document.getElementById('autobackupList');
    if (autobackupList) {
      try {
        const autoRes = await fetch('/api/admin/autobackups', { headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` }});
        if (autoRes.ok) {
          const backups = await autoRes.json();
          autobackupList.innerHTML = '';
          if (backups.length === 0) {
            autobackupList.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-secondary);">No hay respaldos automáticos aún. Haz un movimiento de dinero para generar uno.</p>';
          } else {
            backups.forEach(b => {
              const parts = b.filename.replace('autobackup_', '').replace('.json', '').split('_');
              const timestamp = parts[0]; 
              const reason = parts.slice(1).join(' ').replace(/_/g, ' ');
              const kb = (b.size / 1024).toFixed(1);
              const localDate = new Date(b.date).toLocaleString('es-MX');

              const div = document.createElement('div');
              div.style.display = 'flex';
              div.style.justifyContent = 'space-between';
              div.style.alignItems = 'center';
              div.style.padding = '8px 12px';
              div.style.background = 'rgba(59, 130, 246, 0.1)';
              div.style.borderRadius = '6px';
              div.style.border = '1px solid rgba(59, 130, 246, 0.2)';

              div.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <strong style="color: #bfdbfe; font-size: 0.9rem;">${reason || 'Respaldo Automático'}</strong>
                  <span style="color: var(--text-secondary); font-size: 0.75rem;">${localDate} &bull; ${kb} KB</span>
                </div>
                <button type="button" class="btn btn-sm btn-download-autobackup" data-file="${b.filename}" style="background: rgba(59, 130, 246, 0.2); border-color: rgba(59, 130, 246, 0.4); color: #60a5fa; white-space: nowrap;">
                  <i data-lucide="download" style="width: 14px; height: 14px;"></i> Descargar
                </button>
              `;
              autobackupList.appendChild(div);
            });

            // Add event listeners
            document.querySelectorAll('.btn-download-autobackup').forEach(btn => {
              btn.addEventListener('click', async (e) => {
                const filename = e.currentTarget.getAttribute('data-file');
                try {
                  const dlRes = await fetch(`/api/admin/autobackups/${filename}`, { headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` }});
                  if (!dlRes.ok) throw new Error('Failed');
                  const blob = await dlRes.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = filename;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  a.remove();
                } catch(err) {
                  alert('Error al descargar el respaldo.');
                }
              });
            });
          }
          lucide.createIcons();
        }
      } catch(e) {
        console.error(e);
        autobackupList.innerHTML = '<p style="color: #f87171; font-size: 0.85rem;">Error al cargar respaldos.</p>';
      }
    }

    const usersRes = await fetch('/api/users', { headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` }});
    if (usersRes.ok) {
      const users = await usersRes.json();
      usersTableBody.innerHTML = '';
      
      // Populate Master History User Filter while we have the users
      const masterUserFilter = document.getElementById('masterHistoryUserFilter');
      if (masterUserFilter) {
         masterUserFilter.innerHTML = '<option value="all">Todos los Usuarios</option>';
         users.forEach(u => {
           masterUserFilter.innerHTML += `<option value="${u.id}">${escapeHtml(u.username)}</option>`;
         });
      }

      users.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${u.id}</td>
          <td>
             <div style="display:flex; flex-direction:column; gap:4px;">
               <strong>${escapeHtml(u.username)}</strong>
               ${u.role === 'admin' ? `<span class="status-badge badge-category-server" style="width:fit-content; font-size:0.7rem; padding: 2px 6px;">ADMIN</span>` : 
                 `<select class="role-select" data-id="${u.id}" style="width: fit-content; padding: 2px 6px; font-size: 0.7rem; background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); color: #c4b5fd; border-radius: 4px; outline: none; cursor: pointer;">
                    <option value="reseller" ${u.role === 'reseller' || !u.role ? 'selected' : ''}>RESELLER</option>
                    <option value="colaborador" ${u.role === 'colaborador' ? 'selected' : ''}>COLABORADOR</option>
                  </select>`
               }
               <div style="display: flex; align-items: center; gap: 4px;">
                 <input type="password" class="user-password-field" value="${escapeHtml(u.password || '')}" readonly style="width: 60px; padding: 2px; font-size:0.75rem; border-radius: 4px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); color: white;">
                 ${u.role !== 'admin' ? `
                   <button type="button" class="btn-icon btn-toggle-pwd" title="Mostrar/Ocultar" style="width: 20px; height: 20px; min-width: 20px; display: flex; align-items: center; justify-content: center;"><i data-lucide="eye" style="width: 12px; height: 12px;"></i></button>
                   <button type="button" class="btn-icon btn-edit-pwd" data-id="${u.id}" title="Cambiar Contraseña" style="width: 20px; height: 20px; min-width: 20px; display: flex; align-items: center; justify-content: center;"><i data-lucide="key" style="width: 12px; height: 12px; color: #facc15;"></i></button>
                 ` : ''}
               </div>
             </div>
          </td>
          <td>
            ${u.role !== 'admin' ? `
              <div style="display: flex; align-items: center; gap: 4px;">
                <span style="color:var(--text-secondary);">$</span>
                <input type="number" step="0.1" class="user-markup-input" data-id="${u.id}" value="${u.markup !== null && u.markup !== undefined ? u.markup : ''}" placeholder="Global" style="width: 70px; padding: 4px; border-radius: 4px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); color: white;">
              </div>
            ` : '-'}
          </td>
          <td>
             <div style="display:flex; flex-direction:column; gap:4px; font-size:0.85rem;">
               <div style="display:flex; justify-content:space-between; width: 170px; background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius:4px;"><span style="color:#60a5fa">⚡ MEGA:</span> <strong style="color: #34d399;">$${parseFloat(u.credits1 || 0).toFixed(2)}</strong></div>
               <div style="display:flex; justify-content:space-between; width: 170px; background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius:4px;"><span style="color:#f472b6">🛡 ALPHA:</span> <strong style="color: #34d399;">$${parseFloat(u.credits2 || 0).toFixed(2)}</strong></div>
               <div style="display:flex; justify-content:space-between; width: 170px; background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius:4px;"><span style="color:#facc15">Ω OMEGA:</span> <strong style="color: #34d399;">$${parseFloat(u.credits3 || 0).toFixed(2)}</strong></div>
             </div>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            ${u.role !== 'admin' ? `
              <div style="display: flex; gap: 5px; justify-content: flex-end;">
                <button type="button" class="btn btn-sm btn-recharge-user" data-id="${u.id}" title="Añadir Saldo" style="background: rgba(34,211,238,0.1); color: #22d3ee; padding: 6px;"><i data-lucide="plus" style="width:16px;height:16px;"></i></button>
                <button type="button" class="btn btn-sm btn-deduct-user" data-id="${u.id}" title="Quitar Saldo" style="background: rgba(244,63,94,0.1); color: #f43f5e; padding: 6px;"><i data-lucide="minus" style="width:16px;height:16px;"></i></button>
                <button type="button" class="btn btn-sm btn-delete-user" data-id="${u.id}" title="Eliminar Usuario" style="background: rgba(239,68,68,0.1); color: #ef4444; padding: 6px;"><i data-lucide="trash-2" style="width:16px;height:16px;"></i></button>
              </div>
            ` : '<span style="color:var(--text-muted); font-size:0.8rem;">Admin</span>'}
          </td>
        `;
        usersTableBody.appendChild(tr);
      });
      
      lucide.createIcons();

      // Bind Actions
      document.querySelectorAll('.role-select').forEach(select => {
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

      document.querySelectorAll('.user-markup-input').forEach(input => {
        input.addEventListener('change', async (e) => {
          const id = e.target.dataset.id;
          const val = e.target.value;
          try {
            const res = await fetch(`/api/users/${id}`, {
              method: 'PUT',
              headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
              body: JSON.stringify({ markup: val })
            });
            if(res.ok) {
              e.target.style.borderColor = '#10b981';
              setTimeout(() => e.target.style.borderColor = 'var(--border-color)', 1500);
            } else {
              e.target.style.borderColor = '#ef4444';
            }
          } catch (err) {
            console.error(err);
          }
        });
      });

      // Password Reveal Logic
      document.querySelectorAll('.btn-toggle-pwd').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const input = e.currentTarget.previousElementSibling;
          if (input.type === 'password') {
            input.type = 'text';
            e.currentTarget.innerHTML = '<i data-lucide="eye-off" style="width: 14px; height: 14px;"></i>';
          } else {
            input.type = 'password';
            e.currentTarget.innerHTML = '<i data-lucide="eye" style="width: 14px; height: 14px;"></i>';
          }
          lucide.createIcons();
        });
      });

      // Edit Password Logic
      document.querySelectorAll('.btn-edit-pwd').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.dataset.id;
          const newPwd = prompt('Ingresa la nueva contraseña para este usuario (mínimo 4 caracteres):');
          if (!newPwd) return;
          if (newPwd.length < 4) return alert('La contraseña es muy corta.');
          
          try {
            const res = await fetch(`/api/users/${id}/password`, {
              method: 'PUT',
              headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
              body: JSON.stringify({ password: newPwd })
            });
            if(res.ok) {
              alert('Contraseña actualizada con éxito.');
              loadAdminData();
            } else {
              alert('Error al actualizar contraseña.');
            }
          } catch (err) {
            console.error(err);
          }
        });
      });

      document.querySelectorAll('.btn-delete-user').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.dataset.id;
          if (confirm('¿Eliminar este usuario?')) {
            await fetch(`/api/users/${id}`, { method: 'DELETE', headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` }});
            loadAdminData();
          }
        });
      });

      const serverNames = {'1': '⚡ MEGA-SERVER', '2': '🛡 ALPHA-SERVER', '3': '🔱 OMEGA-SERVER'};

      document.querySelectorAll('.btn-recharge-user').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.dataset.id;
          const user = users.find(u => u.id == id);
          const sName = serverNames[currentServerId];
          const currentCreds = parseFloat(currentServerId === '1' ? user.credits1 : (currentServerId === '2' ? user.credits2 : user.credits3) || 0);
          const addAmount = prompt(`Servidor Actual: ${sName}\n¿Cuánto saldo añadir a ${user.username}? (Ingresa cantidad a sumar)`);
          if (addAmount && !isNaN(parseFloat(addAmount))) {
            const newCredits = currentCreds + Math.abs(parseFloat(addAmount));
            await fetch(`/api/users/${id}`, {
              method: 'PUT',
              headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
              body: JSON.stringify({ credits: newCredits })
            });
            loadAdminData();
            updateAccountCredits();
          }
        });
      });

      document.querySelectorAll('.btn-deduct-user').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.dataset.id;
          const user = users.find(u => u.id == id);
          const sName = serverNames[currentServerId];
          const currentCreds = parseFloat(currentServerId === '1' ? user.credits1 : (currentServerId === '2' ? user.credits2 : user.credits3) || 0);
          const subAmount = prompt(`Servidor Actual: ${sName}\n¿Cuánto saldo QUITAR a ${user.username}? (Ingresa cantidad a restar)`);
          if (subAmount && !isNaN(parseFloat(subAmount))) {
            let newCredits = currentCreds - Math.abs(parseFloat(subAmount));
            if (newCredits < 0) newCredits = 0;
            await fetch(`/api/users/${id}`, {
              method: 'PUT',
              headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
              body: JSON.stringify({ credits: newCredits })
            });
            loadAdminData();
            updateAccountCredits();
          }
        });
      });
    }
  } catch (e) {
    console.error('Failed to load admin data', e);
  }
}

// --- ADMIN SUB-TABS LOGIC ---
const btnAdminTabUsers = document.getElementById('btnAdminTabUsers');
const btnAdminTabHistory = document.getElementById('btnAdminTabHistory');
const btnAdminTabSettings = document.getElementById('btnAdminTabSettings');
const btnAdminTabGroups = document.getElementById('btnAdminTabGroups');

const adminTabUsers = document.getElementById('adminTabUsersContent');
const adminTabHistory = document.getElementById('adminTabHistoryContent');
const adminTabSettings = document.getElementById('adminTabSettingsContent');
const adminTabGroups = document.getElementById('adminTabGroupsContent');

if (btnAdminTabUsers) {
  btnAdminTabUsers.addEventListener('click', () => {
    document.querySelectorAll('.admin-sub-tab').forEach(t => t.classList.remove('active'));
    btnAdminTabUsers.classList.add('active');
    adminTabUsers.classList.remove('hidden');
    adminTabHistory.classList.add('hidden');
    adminTabSettings.classList.add('hidden');
    if (adminTabGroups) adminTabGroups.classList.add('hidden');
    if (adminTabGroups) adminTabGroups.style.display = 'none';
  });
}

if (btnAdminTabHistory) {
  btnAdminTabHistory.addEventListener('click', () => {
    document.querySelectorAll('.admin-sub-tab').forEach(t => t.classList.remove('active'));
    btnAdminTabHistory.classList.add('active');
    adminTabHistory.classList.remove('hidden');
    adminTabUsers.classList.add('hidden');
    adminTabSettings.classList.add('hidden');
    if (adminTabGroups) adminTabGroups.classList.add('hidden');
    if (adminTabGroups) adminTabGroups.style.display = 'none';
    fetchMasterHistory(); // Fetch data when entering the tab
  });
}

if (btnAdminTabSettings) {
  btnAdminTabSettings.addEventListener('click', () => {
    document.querySelectorAll('.admin-sub-tab').forEach(t => t.classList.remove('active'));
    btnAdminTabSettings.classList.add('active');
    adminTabSettings.classList.remove('hidden');
    adminTabUsers.classList.add('hidden');
    adminTabHistory.classList.add('hidden');
    if (adminTabGroups) adminTabGroups.classList.add('hidden');
    if (adminTabGroups) adminTabGroups.style.display = 'none';
  });
}

if (btnAdminTabGroups) {
  btnAdminTabGroups.addEventListener('click', () => {
    document.querySelectorAll('.admin-sub-tab').forEach(t => t.classList.remove('active'));
    btnAdminTabGroups.classList.add('active');
    if (adminTabGroups) {
      adminTabGroups.classList.remove('hidden');
      adminTabGroups.style.display = 'block';
    }
    adminTabSettings.classList.add('hidden');
    adminTabUsers.classList.add('hidden');
    adminTabHistory.classList.add('hidden');
    
    // Attempt to load products if not loaded, so groups can render
    if (!productsList || productsList.length === 0) {
      if (typeof syncProducts === 'function') {
        syncProducts(true);
      } else if (typeof fetchProducts === 'function') {
        fetchProducts(true);
      }
    }
  });
}

const groupSearchInput = document.getElementById('groupSearchInput');
if (groupSearchInput) {
  groupSearchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const cards = document.querySelectorAll('.group-markup-card');
    cards.forEach(card => {
      const name = card.dataset.groupname || '';
      if (name.includes(term)) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  });
}

const btnForceReloadGroups = document.getElementById('btnForceReloadGroups');
if (btnForceReloadGroups) {
  btnForceReloadGroups.addEventListener('click', () => {
    if (typeof syncProducts === 'function') {
      syncProducts(true);
    } else if (typeof fetchProducts === 'function') {
      fetchProducts(true);
    } else {
      alert('No se pudo recargar. Sincroniza desde el catálogo.');
    }
  });
}

let g_masterHistory = [];

async function fetchMasterHistory() {
  try {
    const res = await fetch('/api/history?allServers=true', {
      headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) {
      g_masterHistory = await res.json();
      renderMasterHistory();
    }
  } catch (e) {
    console.error('Error fetching master history', e);
  }
}

function renderMasterHistory() {
  const tbody = document.getElementById('masterHistoryBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  // Filters
  const elServer = document.getElementById('masterHistoryServerFilter');
  const elUser = document.getElementById('masterHistoryUserFilter');
  const elSearch = document.getElementById('masterHistorySearchInput');
  const elLimit = document.getElementById('masterHistoryLimitFilter');
  
  const serverFilter = elServer ? elServer.value : 'all';
  const userFilter = elUser ? elUser.value : 'all';
  const searchFilter = elSearch ? elSearch.value.toLowerCase() : '';
  const limitFilter = elLimit ? parseInt(elLimit.value, 10) : 50;
  
  const sNames = {'1': '⚡ MEGA-SVR', '2': '🛡 ALPHA-SVR', '3': '🔱 OMEGA-SVR'};
  
  let filtered = g_masterHistory.filter(order => {
    if (serverFilter !== 'all' && String(order.serverId) !== serverFilter) return false;
    if (userFilter !== 'all' && String(order.userId) !== userFilter) return false;
    if (searchFilter) {
      if (!order.serviceName.toLowerCase().includes(searchFilter) &&
          !(order.imei && order.imei.toLowerCase().includes(searchFilter)) &&
          !(String(order.referenceId).includes(searchFilter))) {
        return false;
      }
    }
    return true;
  });
  
  // Sort descending by date (most recent first)
  filtered.sort((a, b) => {
    const dateA = a.date || a.timestamp || 0;
    const dateB = b.date || b.timestamp || 0;
    return new Date(dateB) - new Date(dateA);
  });
  
  // Apply limit
  if (limitFilter > 0) {
    filtered = filtered.slice(0, limitFilter);
  }
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-secondary);">No se encontraron pedidos.</td></tr>';
    return;
  }
  
  filtered.forEach(order => {
    const tr = document.createElement('tr');
    
    let statusText = 'Pendiente';
    let stColor = '#eab308';
    let statLower = String(order.status).toLowerCase();
    
    if (statLower === 'success' || statLower === 'completado' || order.status === 4) {
      statusText = 'Completado';
      stColor = '#22c55e';
    } else if (statLower === 'failed' || statLower === 'rechazado' || statLower === 'reembolsado' || order.status === 3) {
      statusText = 'Rechazado';
      stColor = '#ef4444';
    } else if (statLower === 'en proceso' || statLower === 'procesando' || order.status === 1) {
      statusText = 'En Proceso';
      stColor = '#3b82f6';
    }
    
    const orderId = order.id || order.orderId || order.referenceId || 'N/A';
    const cost = order.costCharged !== undefined ? order.costCharged : (order.cost || 0);
    const apiCost = order.realCost !== undefined ? order.realCost : 0;
    const dateStr = order.date || order.timestamp;
    const formattedDate = dateStr ? new Date(dateStr).toLocaleString('es-MX') : 'Fecha Inválida';
    
    // Fix older history without serverId
    const sId = order.serverId ? String(order.serverId) : '1';

    tr.innerHTML = `
      <td>
         <span style="font-family: monospace; display:block; margin-bottom:4px;">#${orderId}</span>
         <span style="color: var(--text-secondary); font-size: 0.75rem;">${formattedDate}</span>
      </td>
      <td>
         <span style="display:inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; background: rgba(59, 130, 246, 0.2); color: #60a5fa; margin-bottom:4px;">${sNames[sId] || '⚡ MEGA-SVR'}</span><br>
         <strong style="font-size:0.85rem; color: #a78bfa;">${escapeHtml(order.username || 'Desconocido')}</strong>
      </td>
      <td>
         <strong style="color:var(--text-primary); font-size: 0.9rem;">${escapeHtml(order.serviceName)}</strong><br>
         ${order.imei && order.imei !== 'N/A' ? `<span style="font-family:monospace; color:var(--text-secondary); font-size:0.85rem;">IMEI: ${order.imei}</span>` : ''}
      </td>
      <td><span style="color: ${stColor}; font-weight: bold;">${statusText}</span></td>
      <td>
         <div style="display:flex; flex-direction:column; gap:2px; font-size: 0.85rem;">
           <span><span style="color:var(--text-secondary);">Reseller:</span> <strong style="color:#34d399;">$${parseFloat(cost).toFixed(2)}</strong></span>
           <span><span style="color:var(--text-secondary);">API:</span> <strong style="color:#f87171;">$${parseFloat(apiCost).toFixed(2)}</strong></span>
         </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

const masterHistorySearchInput = document.getElementById('masterHistorySearchInput');
if (masterHistorySearchInput) {
  masterHistorySearchInput.addEventListener('input', renderMasterHistory);
}
const masterHistoryServerFilter = document.getElementById('masterHistoryServerFilter');
if (masterHistoryServerFilter) {
  masterHistoryServerFilter.addEventListener('change', renderMasterHistory);
}
const masterHistoryUserFilter = document.getElementById('masterHistoryUserFilter');
if (masterHistoryUserFilter) {
  masterHistoryUserFilter.addEventListener('change', renderMasterHistory);
}
const masterHistoryLimitFilter = document.getElementById('masterHistoryLimitFilter');
if (masterHistoryLimitFilter) {
  masterHistoryLimitFilter.addEventListener('change', renderMasterHistory);
}

createUserForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('newUsername').value;
  const password = document.getElementById('newPassword').value;
  const credits = document.getElementById('newCredits').value;
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ username, password, credits })
    });
    if (res.ok) {
      createUserFormContainer.classList.add('hidden');
      createUserForm.reset();
      loadAdminData();
    } else {
      const err = await res.json();
      alert(err.error || 'Error al crear usuario');
    }
  } catch (e) {
    alert('Error de conexión');
  }
});

const btnAdminStartBot = document.getElementById('btnAdminStartBot');
const btnAdminStopBot = document.getElementById('btnAdminStopBot');
const btnAdminRefreshLogs = document.getElementById('btnAdminRefreshLogs');
const adminBotLogsDisplay = document.getElementById('adminBotLogsDisplay');

async function loadBotLogs() {
  if (!adminBotLogsDisplay) return;
  try {
    const token = localStorage.getItem('dhru_token');
    const res = await fetch('/api/admin/bot/logs', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok) {
      adminBotLogsDisplay.textContent = data.logs || 'Sin logs.';
      adminBotLogsDisplay.scrollTop = adminBotLogsDisplay.scrollHeight;
    }
  } catch (e) {
    adminBotLogsDisplay.textContent = 'Error cargando logs: ' + e.message;
  }
}

if (btnAdminRefreshLogs) {
  btnAdminRefreshLogs.addEventListener('click', loadBotLogs);
}

if (btnAdminStartBot) {
  btnAdminStartBot.addEventListener('click', async () => {
    try {
      const token = localStorage.getItem('dhru_token');
      const res = await fetch('/api/admin/bot/start', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      alert(data.message);
      setTimeout(loadBotLogs, 2000); // refresh logs after start
    } catch (err) {
      alert(err.message);
    }
  });
}

if (btnAdminStopBot) {
  btnAdminStopBot.addEventListener('click', async () => {
    try {
      const token = localStorage.getItem('dhru_token');
      const res = await fetch('/api/admin/bot/stop', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      alert(data.message);
      setTimeout(loadBotLogs, 1000);
    } catch (err) {
      alert(err.message);
    }
  });
}

// Cargar logs al iniciar si el admin tiene abierta esa pestaña
if (adminBotLogsDisplay) {
  loadBotLogs();
}

const btnSaveGroupMarkups = document.getElementById('btnSaveGroupMarkups');
if (btnSaveGroupMarkups) {
  btnSaveGroupMarkups.addEventListener('click', async () => {
    const groupMarkupsContainer = document.getElementById('groupMarkupsContainer');
    if (!groupMarkupsContainer) return;
    
    const inputsR = groupMarkupsContainer.querySelectorAll('input[id^="gm_val_r_"]');
    const payload = {};
    
    inputsR.forEach(inputR => {
      const groupName = inputR.getAttribute('data-group');
      const safeId = groupName.replace(/[^a-zA-Z0-9]/g, '_');
      const typeR = document.getElementById('gm_type_r_' + safeId).value;
      const valR = inputR.value;
      
      const typeC = document.getElementById('gm_type_c_' + safeId).value;
      const valC = document.getElementById('gm_val_c_' + safeId).value;
      
      if (valR !== '' || valC !== '' || typeR.startsWith('tier') || typeC.startsWith('tier')) {
        payload[groupName] = {
          type: typeR,
          value: parseFloat(valR) || 0,
          clientType: typeC,
          clientValue: parseFloat(valC) || 0
        };
      }
    });
    
    try {
      btnSaveGroupMarkups.disabled = true;
      btnSaveGroupMarkups.innerHTML = 'Guardando...';
      const res = await fetch('/api/admin/group-markups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Server-Id': currentServerId,
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        alert('Ganancias por Grupo guardadas exitosamente.');
        if (typeof syncProducts === 'function') {
          syncProducts(true);
        } else if (typeof fetchProducts === 'function') {
          fetchProducts(true);
        }
      } else {
        alert('Error al guardar las ganancias por grupo.');
      }
    } catch (err) {
      alert('Error de red al guardar.');
    } finally {
      btnSaveGroupMarkups.disabled = false;
      btnSaveGroupMarkups.innerHTML = '<i data-lucide="save" style="width: 14px; height: 14px;"></i> Guardar Grupos';
      lucide.createIcons();
    }
  });
}

if (adminSettingsForm) {
  adminSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const resellerTier1 = inputResellerTier1.value;
      const resellerTier2 = inputResellerTier2.value;
      const resellerTier3 = inputResellerTier3.value;
      const clientTier1 = inputClientTier1.value;
      const clientTier2 = inputClientTier2.value;
      const clientTier3 = inputClientTier3.value;
      const exchangeRate = document.getElementById('inputExchangeRate') ? document.getElementById('inputExchangeRate').value : 17.60;
      const creditCushion = document.getElementById('inputCreditCushion') ? document.getElementById('inputCreditCushion').value : 0;
      
      let payload = { exchangeRate: parseFloat(exchangeRate), creditCushion: parseInt(creditCushion) };
      const tiersObj = {
        resellerTier1: parseFloat(resellerTier1),
        resellerTier2: parseFloat(resellerTier2),
        resellerTier3: parseFloat(resellerTier3),
        clientTier1: parseFloat(clientTier1),
        clientTier2: parseFloat(clientTier2),
        clientTier3: parseFloat(clientTier3)
      };

      if (currentServerId === '3') {
        payload.server3 = tiersObj;
      } else if (currentServerId === '2') {
        payload.server2 = tiersObj;
      } else {
        payload.server1 = tiersObj;
      }

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'X-Server-Id': currentServerId, 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert('Configuración guardada correctamente. El catálogo se recargará ahora para reflejar los nuevos precios.');
        await syncProducts(true);
      } else {
        alert('Error al guardar configuración');
      }
    } catch (err) {
      alert('Error de conexión');
    }
  });
}

// --- Backup & Restore ---

if (btnDownloadBackup) {
  btnDownloadBackup.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/admin/backup', { headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` } });
      if (!res.ok) throw new Error('Failed to fetch backup');
      const backupData = await res.json();
      
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `megaunlockphone-backup-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } catch (err) {
      console.error(err);
      alert('Error al descargar el respaldo.');
    }
  });
}

if (btnUploadBackup && fileRestoreBackup) {
  btnUploadBackup.addEventListener('click', () => {
    fileRestoreBackup.click();
  });

  fileRestoreBackup.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm('⚠️ ¡ADVERTENCIA!\n\nRestaurar este archivo sobreescribirá TODA la base de datos actual (usuarios, historial y configuraciones).\n\n¿Estás completamente seguro de continuar?')) {
      fileRestoreBackup.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsedData = JSON.parse(event.target.result);
        
        const res = await fetch('/api/admin/restore', {
          method: 'POST',
          headers: { 'X-Server-Id': currentServerId, 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}` 
          },
          body: JSON.stringify(parsedData)
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to restore backup');
        }
        
        alert('✅ ¡Respaldo restaurado con éxito!\nLa página se recargará ahora.');
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert('❌ Error al restaurar el respaldo:\n' + err.message);
      } finally {
        fileRestoreBackup.value = '';
      }
    };
    
    reader.readAsText(file);
  });
}

if (btnClearCustomPrices) {
  btnClearCustomPrices.addEventListener('click', async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar TODOS los precios manuales por producto para este servidor? Esto no se puede deshacer.')) return;
    try {
      const res = await fetch('/api/admin/custom-prices', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Server-Id': currentServerId
        }
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ ' + data.message);
        syncProducts(true); // Refresca los productos en la UI
      } else {
        alert('❌ Error: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Error de conexión al limpiar precios.');
    }
  });
}

// --- COUPON ADMIN LOGIC ---
const adminCouponsModal = document.getElementById('adminCouponsModal');
const btnCloseAdminCouponsModal = document.getElementById('btnCloseAdminCouponsModal');
const btnOpenCreateCoupon = document.getElementById('btnOpenCreateCoupon');
const createCouponModal = document.getElementById('createCouponModal');
const btnCloseCreateCoupon = document.getElementById('btnCloseCreateCoupon');
const createCouponForm = document.getElementById('createCouponForm');
const couponsTableBody = document.getElementById('couponsTableBody');

const couponNormalPrice = document.getElementById('couponNormalPrice');
const couponPromoPrice = document.getElementById('couponPromoPrice');
const couponDiscountPercentage = document.getElementById('couponDiscountPercentage');

let activeCoupons = [];

if (btnAdminCoupons) {
  btnAdminCoupons.addEventListener('click', () => {
    adminCouponsModal.classList.remove('hidden');
    loadAdminCoupons();
  });
}

if (btnCloseAdminCouponsModal) {
  btnCloseAdminCouponsModal.addEventListener('click', () => {
    adminCouponsModal.classList.add('hidden');
  });
}

if (btnOpenCreateCoupon) {
  btnOpenCreateCoupon.addEventListener('click', () => {
    createCouponModal.classList.remove('hidden');
    createCouponForm.reset();
    couponDiscountPercentage.textContent = '0%';
  });
}

if (btnCloseCreateCoupon) {
  btnCloseCreateCoupon.addEventListener('click', () => {
    createCouponModal.classList.add('hidden');
  });
}

function calculatePercentage() {
  const normal = parseFloat(couponNormalPrice.value) || 0;
  const promo = parseFloat(couponPromoPrice.value) || 0;
  if (normal > 0 && promo >= 0 && normal >= promo) {
    const perc = Math.round(((normal - promo) / normal) * 100);
    couponDiscountPercentage.textContent = `-${perc}%`;
  } else {
    couponDiscountPercentage.textContent = '0%';
  }
}

if (couponNormalPrice) couponNormalPrice.addEventListener('input', calculatePercentage);
if (couponPromoPrice) couponPromoPrice.addEventListener('input', calculatePercentage);

if (createCouponForm) {
  createCouponForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const serviceName = document.getElementById('couponServiceName').value;
    const normalPrice = couponNormalPrice.value;
    const promoPrice = couponPromoPrice.value;
    const maxRedemptions = document.getElementById('couponMaxRedemptions').value;
    const showPercentage = document.getElementById('couponShowPercentage').checked;
    const conditions = document.getElementById('couponConditions').value;
    const imageUrl = document.getElementById('couponImageUrl').value;

    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ serviceName, normalPrice, promoPrice, showPercentage, conditions, maxRedemptions, imageUrl })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      // Generate Image immediately
      await generateCouponImage(data.coupon);
      
      createCouponModal.classList.add('hidden');
      loadAdminCoupons();
    } catch (err) {
      alert(err.message);
    }
  });
}

async function loadAdminCoupons() {
  try {
    if (couponsTableBody) couponsTableBody.innerHTML = '<tr><td colspan="6"><div class="spinner-container" style="padding: 40px 0;"><div class="spinner"></div><p style="text-align:center; margin-top:10px;">Cargando cupones...</p></div></td></tr>';
    const res = await fetch('/api/admin/coupons', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    activeCoupons = data;
    renderCouponsTable();
  } catch (err) {
    console.error(err);
  }
}

function renderCouponsTable() {
  if (!couponsTableBody) return;
  couponsTableBody.innerHTML = '';
  
  activeCoupons.forEach(c => {
    const isRedeemed = c.status === 'redeemed';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family: monospace; font-weight: bold; color: #00f0ff;">${c.code}</td>
      <td>${escapeHtml(c.serviceName)}</td>
      <td>${c.normalPrice ? `<span style="text-decoration: line-through; color: #ef4444; font-size: 0.8rem;">$${c.normalPrice}</span> ` : ''}<strong style="color: #4ade80;">$${c.promoPrice}</strong></td>
      <td><strong style="color: #a855f7;">${c.currentRedemptions || 0} / ${c.maxRedemptions || 1}</strong></td>
      <td>
        <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; background: ${isRedeemed ? 'rgba(239, 68, 68, 0.2)' : 'rgba(74, 222, 128, 0.2)'}; color: ${isRedeemed ? '#ef4444' : '#4ade80'};">
          ${isRedeemed ? 'AGOTADO' : 'ACTIVO'}
        </span>
      </td>
      <td style="text-align: right; display: flex; gap: 8px; justify-content: flex-end;">
        <button class="btn btn-secondary btn-small btn-view-coupon" data-code="${c.code}"><i data-lucide="eye"></i> Ver</button>
        ${!isRedeemed ? 
          `<button class="btn btn-primary btn-small btn-redeem-coupon" data-code="${c.code}"><i data-lucide="check-circle"></i> Marcar</button>` : ''
        }
        <button class="btn btn-secondary btn-small btn-del-coupon" data-code="${c.code}" style="color: #ef4444;"><i data-lucide="trash-2"></i></button>
      </td>
    `;
    couponsTableBody.appendChild(tr);
  });
  lucide.createIcons();
  
  document.querySelectorAll('.btn-redeem-coupon').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const code = e.currentTarget.getAttribute('data-code');
      const username = prompt('¿Quién canjeó este cupón? (Nombre o ID del usuario):');
      if (!username) return;
      
      try {
        const res = await fetch('/api/admin/coupons/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
          body: JSON.stringify({ code, username })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        loadAdminCoupons();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  document.querySelectorAll('.btn-del-coupon').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if(!confirm('¿Eliminar este cupón permanentemente?')) return;
      const code = e.currentTarget.getAttribute('data-code');
      try {
        await fetch(`/api/admin/coupons/${code}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        loadAdminCoupons();
      } catch(err){}
    });
  });

  document.querySelectorAll('.btn-view-coupon').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const code = e.currentTarget.getAttribute('data-code');
      const coupon = activeCoupons.find(c => c.code === code);
      if(coupon) {
        generateCouponImage(coupon);
      }
    });
  });
}

async function generateCouponImage(coupon) {
  const tplContainer = document.getElementById('couponTemplateContainer');
  const tplBox = document.getElementById('couponTemplate');
  const tplStamp = document.getElementById('couponRedeemedStamp');
  const tplLogo = document.getElementById('tplCouponLogo');
  
  if (coupon.imageUrl && coupon.imageUrl.trim() !== '') {
    try {
      // Fetch via proxy and convert to base64 to completely avoid html-to-image CORS/network quirks
      const proxyUrl = '/api/proxy-image?url=' + encodeURIComponent(coupon.imageUrl);
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const blob = await res.blob();
        if (blob.type.startsWith('image/')) {
          const base64Url = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          
          // Wait for image to load to prevent html-to-image from crashing on incomplete images
          await new Promise((resolve) => {
            tplLogo.onload = resolve;
            tplLogo.onerror = () => { 
              tplLogo.style.display = 'none'; 
              tplLogo.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
              resolve(); 
            };
            tplLogo.src = base64Url;
          });
          if (tplLogo.style.display !== 'none') tplLogo.style.display = 'block';
        } else {
          tplLogo.style.display = 'none';
        }
      }
    } catch (err) {
      console.error('Error loading coupon image via proxy:', err);
    }
  } else {
    tplLogo.style.display = 'none';
    tplLogo.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  }

  document.getElementById('tplCouponService').textContent = coupon.serviceName;
  
  const oldPriceBox = document.getElementById('tplCouponOldPriceBox');
  if (coupon.normalPrice != null && coupon.normalPrice > 0) {
    document.getElementById('tplCouponOldPrice').textContent = '$' + coupon.normalPrice.toFixed(2);
    if(oldPriceBox) oldPriceBox.style.display = 'flex';
  } else {
    if(oldPriceBox) oldPriceBox.style.display = 'none';
  }
  
  document.getElementById('tplCouponNewPrice').textContent = '$' + coupon.promoPrice.toFixed(2);
  document.getElementById('tplCouponCode').textContent = coupon.code;
  
  const conditionsBox = document.getElementById('tplCouponConditionsBox');
  const conditionsText = document.getElementById('tplCouponConditionsText');
  if (coupon.conditions && coupon.conditions.trim() !== '') {
    conditionsText.textContent = coupon.conditions;
    conditionsBox.classList.remove('hidden');
  } else {
    conditionsBox.classList.add('hidden');
  }
  
  const discountPill = document.getElementById('tplCouponDiscountPill');
  if (coupon.showPercentage) {
    const normal = coupon.normalPrice;
    const promo = coupon.promoPrice;
    let perc = 0;
    if (normal > 0) perc = Math.round(((normal - promo) / normal) * 100);
    document.getElementById('tplCouponDiscountVal').textContent = perc;
    discountPill.classList.remove('hidden');
  } else {
    discountPill.classList.add('hidden');
  }

  if (coupon.status === 'redeemed') {
    tplStamp.classList.remove('hidden');
  } else {
    tplStamp.classList.add('hidden');
  }

  tplContainer.style.opacity = '1';
  
  try {
    const blob = await htmlToImage.toBlob(tplBox, {
      backgroundColor: '#111116',
      pixelRatio: 2,
      skipFonts: true,
      imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
      style: { transform: 'scale(1)', transformOrigin: 'top left' }
    });
    
    tplContainer.style.opacity = '0';
    
    // Show Preview
    const couponPreviewModal = document.getElementById('couponPreviewModal');
    const couponPreviewImg = document.getElementById('couponPreviewImg');
    const couponPreviewSuccessMsg = document.getElementById('couponPreviewSuccessMsg');
    const btnCloseCouponPreview = document.getElementById('btnCloseCouponPreview');
    const btnCancelCouponPreview = document.getElementById('btnCancelCouponPreview');
    
    if (couponPreviewModal && couponPreviewImg) {
      couponPreviewImg.src = URL.createObjectURL(blob);
      couponPreviewModal.classList.remove('hidden');
      
      if (btnCloseCouponPreview) {
        btnCloseCouponPreview.onclick = () => couponPreviewModal.classList.add('hidden');
      }
      if (btnCancelCouponPreview) {
        btnCancelCouponPreview.onclick = () => couponPreviewModal.classList.add('hidden');
      }
    }
    
    try {
      const clipboardItem = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([clipboardItem]);
      if (couponPreviewSuccessMsg) couponPreviewSuccessMsg.style.display = 'block';
    } catch (clipErr) {
      // Clipboard failed, but they can manually copy from the preview
      console.warn('Clipboard write failed', clipErr);
      if (couponPreviewSuccessMsg) couponPreviewSuccessMsg.style.display = 'none';
    }
    
  } catch (err) {
    console.error(err);
    tplContainer.style.opacity = '0';
    const errMsg = err.message || err.toString() || 'Unknown error';
    alert('Error al generar la imagen: ' + errMsg);
  }
}

// Real-time polling for account balance and background sync
setInterval(() => {
  if (authToken) {
