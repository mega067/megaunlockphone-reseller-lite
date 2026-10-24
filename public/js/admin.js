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
        
        const inputServerName = document.getElementById('inputServerName');
        if (inputServerName) inputServerName.value = currentSet.name || '';
        const inputServerEndpoint = document.getElementById('inputServerEndpoint');
        if (inputServerEndpoint) inputServerEndpoint.value = currentSet.endpoint || '';
        const inputServerUsername = document.getElementById('inputServerUsername');
        if (inputServerUsername) inputServerUsername.value = currentSet.username || '';
        const inputServerApiKey = document.getElementById('inputServerApiKey');
        if (inputServerApiKey) {
          inputServerApiKey.value = '';
          inputServerApiKey.placeholder = currentSet.apiaccesskeyMasked ? `Actual: ${currentSet.apiaccesskeyMasked} (dejar vacío para mantener)` : 'API Access Key';
        }
        const inputServerEnabled = document.getElementById('inputServerEnabled');
        if (inputServerEnabled) inputServerEnabled.checked = currentSet.enabled !== false;
      }
      const inputExchangeRate = document.getElementById('inputExchangeRate');
      if (inputExchangeRate) {
        inputExchangeRate.value = parseFloat(set.exchangeRate || 17.60).toFixed(2);
      }
      const inputCreditCushion = document.getElementById('inputCreditCushion');
      if (inputCreditCushion) {
        inputCreditCushion.value = parseFloat(set.creditCushion || 0).toFixed(0);
      }
      const inputMarqueeImages = document.getElementById('inputMarqueeImages');
      if (inputMarqueeImages) {
        inputMarqueeImages.value = set.global?.marqueeImages || 'https://i.postimg.cc/pLMkLymR/fullbrand.png, https://i.postimg.cc/Hnnx2JKY/brand2.png';
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
                  
                  <div style="display: flex; gap: 8px; align-items: center; margin-top: 5px;">
                    <label style="width: 70px; font-size: 0.8rem; color: #9ca3af;">Logo URL:</label>
                    <input type="text" id="gm_logo_${safeId}" value="${gm.logo || ''}" placeholder="Ej: https://.../logo.png" class="form-control" style="flex: 1; padding: 4px; font-size: 0.8rem;">
                  </div>
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <label style="font-size: 0.8rem; color: #9ca3af; display: flex; align-items: center; gap: 5px; cursor: pointer;">
                      <input type="checkbox" id="gm_hot_${safeId}" ${gm.isHot ? 'checked' : ''}> Destacar Grupo al inicio (HOT)
                    </label>
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
              let label = 'Respaldo Automático';
              let badgeColor = '#60a5fa';
              let badgeBg = 'rgba(59, 130, 246, 0.15)';
              let badgeText = 'Evento Financiero';

              if (b.type === 'daily' || b.filename.startsWith('daily_backup_')) {
                label = 'Respaldo 24h Programado';
                badgeColor = '#34d399';
                badgeBg = 'rgba(16, 185, 129, 0.2)';
                badgeText = 'Diario (24h)';
              } else if (b.filename.startsWith('autobackup_')) {
                const parts = b.filename.replace('autobackup_', '').replace('.json', '').split('_');
                label = parts.slice(1).join(' ').replace(/_/g, ' ') || 'Movimiento de Saldo / Cuenta';
              }

              const kb = (b.size / 1024).toFixed(1);
              const localDate = new Date(b.date).toLocaleString('es-MX');

              const div = document.createElement('div');
              div.style.display = 'flex';
              div.style.justifyContent = 'space-between';
              div.style.alignItems = 'center';
              div.style.padding = '10px 14px';
              div.style.background = 'rgba(30, 41, 59, 0.6)';
              div.style.borderRadius = '8px';
              div.style.border = '1px solid rgba(255, 255, 255, 0.08)';

              div.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <strong style="color: #f1f5f9; font-size: 0.9rem;">${label}</strong>
                    <span style="background: ${badgeBg}; color: ${badgeColor}; font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 9999px;">${badgeText}</span>
                  </div>
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

    const btnTriggerDailyBackup = document.getElementById('btnTriggerDailyBackup');
    if (btnTriggerDailyBackup && !btnTriggerDailyBackup._hasListener) {
      btnTriggerDailyBackup._hasListener = true;
      btnTriggerDailyBackup.addEventListener('click', async () => {
        btnTriggerDailyBackup.disabled = true;
        btnTriggerDailyBackup.innerHTML = '<i data-lucide="refresh-cw" class="icon-spin" style="width: 14px; height: 14px;"></i> Generando...';
        lucide.createIcons();
        try {
          const res = await fetch('/api/cron/backup-24h');
          const data = await res.json();
          if (data.status === 'ok') {
            alert('✅ Respaldo de 24h generado y firmado criptográficamente con éxito.');
            if (btnAdminManage) btnAdminManage.click();
          } else {
            alert('❌ Error al generar respaldo: ' + (data.message || 'Error desconocido'));
          }
        } catch (err) {
          alert('❌ Error de conexión al generar respaldo: ' + err.message);
        } finally {
          btnTriggerDailyBackup.disabled = false;
          btnTriggerDailyBackup.innerHTML = '<i data-lucide="clock" style="width: 14px; height: 14px;"></i> Ejecutar Respaldo 24h Ahora';
          lucide.createIcons();
        }
      });
    }

    // Google Drive Sync Controls
    const gdriveEnabled = document.getElementById('gdriveEnabled');
    const gdriveSyncOnEvent = document.getElementById('gdriveSyncOnEvent');
    const gdriveKeepCopies = document.getElementById('gdriveKeepCopies');
    const gdriveKeepLocalCopies = document.getElementById('gdriveKeepLocalCopies');
    const gdriveAppScriptUrl = document.getElementById('gdriveAppScriptUrl');
    const gdriveFolderId = document.getElementById('gdriveFolderId');
    const gdriveClientEmail = document.getElementById('gdriveClientEmail');
    const btnSaveGDriveConfig = document.getElementById('btnSaveGDriveConfig');
    const btnTestGDriveSync = document.getElementById('btnTestGDriveSync');
    const btnShowAppsScriptModal = document.getElementById('btnShowAppsScriptModal');

    // Cargar configuración de Google Drive
    try {
      const gdRes = await fetch('/api/admin/gdrive-config', { headers: { 'Authorization': `Bearer ${authToken}` } });
      if (gdRes.ok) {
        const gdData = await gdRes.json();
        if (gdData.success && gdData.config) {
          if (gdriveEnabled) gdriveEnabled.checked = Boolean(gdData.config.enabled);
          if (gdriveSyncOnEvent) gdriveSyncOnEvent.checked = Boolean(gdData.config.syncOnEvent);
          if (gdriveKeepCopies) gdriveKeepCopies.value = gdData.config.keepCopies || 7;
          if (gdriveKeepLocalCopies) gdriveKeepLocalCopies.value = gdData.config.keepLocalCopies || 3;
          if (gdriveAppScriptUrl) gdriveAppScriptUrl.value = gdData.config.appScriptUrl || '';
          if (gdriveFolderId) gdriveFolderId.value = gdData.config.folderId || '';
          if (gdriveClientEmail) gdriveClientEmail.value = gdData.config.clientEmail || '';
          window._gdriveAppsScriptTemplate = gdData.template;
        }
      }
    } catch (e) {
      console.error('Error cargando config GDrive:', e);
    }

    if (btnSaveGDriveConfig && !btnSaveGDriveConfig._hasListener) {
      btnSaveGDriveConfig._hasListener = true;
      btnSaveGDriveConfig.addEventListener('click', async () => {
        btnSaveGDriveConfig.disabled = true;
        try {
          const payload = {
            enabled: gdriveEnabled ? gdriveEnabled.checked : false,
            syncOnEvent: gdriveSyncOnEvent ? gdriveSyncOnEvent.checked : false,
            keepCopies: gdriveKeepCopies ? parseInt(gdriveKeepCopies.value, 10) : 7,
            keepLocalCopies: gdriveKeepLocalCopies ? parseInt(gdriveKeepLocalCopies.value, 10) : 3,
            appScriptUrl: gdriveAppScriptUrl ? gdriveAppScriptUrl.value.trim() : '',
            folderId: gdriveFolderId ? gdriveFolderId.value.trim() : '',
            clientEmail: gdriveClientEmail ? gdriveClientEmail.value.trim() : ''
          };
          const res = await fetch('/api/admin/gdrive-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (data.success) {
            alert('✅ ' + data.message);
          } else {
            alert('❌ Error: ' + (data.error || 'No se pudo guardar'));
          }
        } catch (err) {
          alert('❌ Error de red: ' + err.message);
        } finally {
          btnSaveGDriveConfig.disabled = false;
        }
      });
    }

    if (btnTestGDriveSync && !btnTestGDriveSync._hasListener) {
      btnTestGDriveSync._hasListener = true;
      btnTestGDriveSync.addEventListener('click', async () => {
        // Auto-guardar primero lo que el usuario tiene en pantalla si escribió la URL
        if (gdriveAppScriptUrl && gdriveAppScriptUrl.value.trim()) {
          try {
            await fetch('/api/admin/gdrive-config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
              body: JSON.stringify({
                enabled: gdriveEnabled ? gdriveEnabled.checked : true,
                syncOnEvent: gdriveSyncOnEvent ? gdriveSyncOnEvent.checked : false,
                keepCopies: gdriveKeepCopies ? parseInt(gdriveKeepCopies.value, 10) : 7,
                keepLocalCopies: gdriveKeepLocalCopies ? parseInt(gdriveKeepLocalCopies.value, 10) : 3,
                appScriptUrl: gdriveAppScriptUrl.value.trim(),
                folderId: gdriveFolderId ? gdriveFolderId.value.trim() : '',
                clientEmail: gdriveClientEmail ? gdriveClientEmail.value.trim() : ''
              })
            });
          } catch(e) {}
        }

        btnTestGDriveSync.disabled = true;
        btnTestGDriveSync.innerHTML = '<i data-lucide="refresh-cw" class="icon-spin" style="width: 14px; height: 14px;"></i> Subiendo...';
        lucide.createIcons();
        try {
          const res = await fetch('/api/admin/gdrive-sync-test', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          const data = await res.json();
          if (data.success) {
            alert('🎉 ¡ÉXITO!\n\n' + data.message + '\n\nRevisa tu carpeta en Google Drive para verificar el archivo.');
          } else {
            alert('⚠️ ' + (data.error || 'Fallo en la prueba de sincronización'));
          }
        } catch (err) {
          alert('❌ Error de red al probar: ' + err.message);
        } finally {
          btnTestGDriveSync.disabled = false;
          btnTestGDriveSync.innerHTML = '<i data-lucide="send" style="width: 14px; height: 14px;"></i> Probar Subida Ahora';
          lucide.createIcons();
        }
      });
    }

    if (btnShowAppsScriptModal && !btnShowAppsScriptModal._hasListener) {
      btnShowAppsScriptModal._hasListener = true;
      btnShowAppsScriptModal.addEventListener('click', () => {
        const modal = document.getElementById('modalAppsScriptHelp');
        const codeDisplay = document.getElementById('appsScriptCodeDisplay');
        const code = window._gdriveAppsScriptTemplate || '// Cargando plantilla...';
        if (codeDisplay) codeDisplay.textContent = code;
        if (modal) modal.classList.remove('hidden');
      });
    }

    const btnCloseAppsScriptModal = document.getElementById('btnCloseAppsScriptModal');
    if (btnCloseAppsScriptModal && !btnCloseAppsScriptModal._hasListener) {
      btnCloseAppsScriptModal._hasListener = true;
      btnCloseAppsScriptModal.addEventListener('click', () => {
        const modal = document.getElementById('modalAppsScriptHelp');
        if (modal) modal.classList.add('hidden');
      });
    }

    const btnAppsScriptModalCloseBottom = document.getElementById('btnAppsScriptModalCloseBottom');
    if (btnAppsScriptModalCloseBottom && !btnAppsScriptModalCloseBottom._hasListener) {
      btnAppsScriptModalCloseBottom._hasListener = true;
      btnAppsScriptModalCloseBottom.addEventListener('click', () => {
        const modal = document.getElementById('modalAppsScriptHelp');
        if (modal) modal.classList.add('hidden');
      });
    }

    const btnCopyAppsScriptCodeModal = document.getElementById('btnCopyAppsScriptCodeModal');
    if (btnCopyAppsScriptCodeModal && !btnCopyAppsScriptCodeModal._hasListener) {
      btnCopyAppsScriptCodeModal._hasListener = true;
      btnCopyAppsScriptCodeModal.addEventListener('click', async () => {
        const code = window._gdriveAppsScriptTemplate || '';
        if (!code) return alert('No hay código disponible aún.');
        try {
          await navigator.clipboard.writeText(code);
          btnCopyAppsScriptCodeModal.innerHTML = '<i data-lucide="check" style="width: 12px; height: 12px;"></i> ¡Copiado!';
          lucide.createIcons();
          setTimeout(() => {
            btnCopyAppsScriptCodeModal.innerHTML = '<i data-lucide="copy" style="width: 12px; height: 12px;"></i> Copiar Código al Portapapeles';
            lucide.createIcons();
          }, 2000);
        } catch (e) {
          prompt('Copia manualmente:', code);
        }
      });
    }

    // Cargar Usuarios
    try {
      const usersRes = await fetch('/api/users', { headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` }});
      if (usersRes.ok) {
        const users = await usersRes.json();
        window.cachedAdminUsers = users;
      
      // Populate Master History User Filter while we have the users
      const masterUserFilter = document.getElementById('masterHistoryUserFilter');
      if (masterUserFilter) {
         masterUserFilter.innerHTML = '<option value="all">Todos los Usuarios</option>';
         users.forEach(u => {
           masterUserFilter.innerHTML += `<option value="${u.id}">${escapeHtml(u.username)}</option>`;
         });
      }

      function renderFilteredAdminUsers() {
        if (!usersTableBody) return;
        const searchInput = document.getElementById('adminUsersSearchInput');
        const statusFilter = document.getElementById('adminUsersStatusFilter');
        const roleFilter = document.getElementById('adminUsersRoleFilter');
        const countBadge = document.getElementById('adminUsersCountBadge');

        const term = (searchInput ? searchInput.value : '').toLowerCase().trim();
        const statusVal = statusFilter ? statusFilter.value : 'all';
        const roleVal = roleFilter ? roleFilter.value : 'all';

        const filtered = (window.cachedAdminUsers || []).filter(u => {
          if (roleVal !== 'all' && (u.role || 'reseller') !== roleVal) return false;
          const isActive = u.isActive !== false;
          if (statusVal === 'active' && !isActive) return false;
          if (statusVal === 'inactive' && isActive) return false;

          if (term) {
            const idStr = String(u.id || '');
            const uname = String(u.username || '').toLowerCase();
            const phone = String(u.phone || '').toLowerCase();
            const email = String(u.email || '').toLowerCase();
            if (!idStr.includes(term) && !uname.includes(term) && !phone.includes(term) && !email.includes(term)) {
              return false;
            }
          }
          return true;
        });

        if (countBadge) {
          countBadge.textContent = `${filtered.length} de ${users.length} usuarios`;
        }

        // Preserve which user rows were expanded before re-render
        const expandedUserIds = new Set();
        document.querySelectorAll('.admin-user-detail-row:not(.hidden)').forEach(row => {
          const match = row.id.match(/^user-detail-(.+)$/);
          if (match) expandedUserIds.add(match[1]);
        });

        usersTableBody.innerHTML = '';
        if (filtered.length === 0) {
          usersTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 25px;">No se encontraron usuarios que coincidan con la búsqueda.</td></tr>`;
          return;
        }

        filtered.forEach(u => {
          const isActive = u.isActive !== false;
          const isApiActive = u.isApiEnabled === true;
          const totalOrders = u.totalOrders || 0;
          const initialLetter = (u.username || 'U').charAt(0).toUpperCase();

          // 1. Primary Summary Row
          const trHeader = document.createElement('tr');
          trHeader.className = 'admin-user-row-header';
          trHeader.dataset.targetDetail = `user-detail-${u.id}`;
          if (!isActive) {
            trHeader.style.opacity = '0.7';
            trHeader.style.background = 'rgba(239, 68, 68, 0.04)';
          }

          const avatarContent = u.logoUrl 
            ? `<img src="${escapeHtml(u.logoUrl)}" alt="${escapeHtml(u.username)}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 2px solid #38bdf8; box-shadow: 0 0 10px rgba(56, 189, 248, 0.3);">`
            : `<div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #0ea5e9, #6366f1); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1rem; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 2px 6px rgba(0,0,0,0.3);">${initialLetter}</div>`;

          trHeader.innerHTML = `
            <td>
              <div style="display: flex; align-items: center; gap: 10px;">
                ${avatarContent}
                <div>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <strong style="color: ${isActive ? '#f8fafc' : '#f87171'}; font-size: 0.95rem;">${escapeHtml(u.username)}</strong>
                    <span style="font-family: monospace; font-size: 0.7rem; color: #94a3b8; background: rgba(255,255,255,0.06); padding: 1px 5px; border-radius: 4px;">#${u.id}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                    <span class="status-badge" style="font-size: 0.65rem; padding: 1px 6px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-weight: 700; text-transform: uppercase;">${u.role || 'RESELLER'}</span>
                    ${u.phone ? `<span style="font-size: 0.72rem; color: #94a3b8; font-family: monospace;">📞 +${escapeHtml(u.phone)}</span>` : ''}
                  </div>
                </div>
              </div>
            </td>
            <td style="text-align: center; vertical-align: middle;">
              ${u.role !== 'admin' ? `
                <button type="button" class="btn-toggle-active-status" data-id="${u.id}" data-active="${isActive ? 'true' : 'false'}" title="${isActive ? 'Desactivar acceso' : 'Activar acceso'}" style="background: ${isActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; border: 1px solid ${isActive ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'}; color: ${isActive ? '#4ade80' : '#f87171'}; padding: 3px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                  <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${isActive ? '#22c55e' : '#ef4444'};"></span>
                  ${isActive ? 'Activo' : 'Pausado'}
                </button>
              ` : '<span style="color: #22c55e; font-size: 0.72rem; font-weight: 700;">🟢 Siempre Activo</span>'}
            </td>
            <td>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                <div style="background: rgba(14, 165, 233, 0.08); border: 1px solid rgba(14, 165, 233, 0.2); padding: 3px 8px; border-radius: 6px; font-size: 0.76rem; display: flex; align-items: center; gap: 5px;">
                  <span style="color: #60a5fa; font-weight: 700;">⚡ S1:</span>
                  <strong style="color: #38bdf8;">$${parseFloat(u.credits1 || 0).toFixed(2)}</strong>
                </div>
                <div style="background: rgba(168, 85, 247, 0.08); border: 1px solid rgba(168, 85, 247, 0.2); padding: 3px 8px; border-radius: 6px; font-size: 0.76rem; display: flex; align-items: center; gap: 5px;">
                  <span style="color: #c084fc; font-weight: 700;">🔱 S3:</span>
                  <strong style="color: #c084fc;">$${parseFloat(u.credits3 || 0).toFixed(2)}</strong>
                </div>
              </div>
            </td>
            <td style="text-align: center; vertical-align: middle;">
              <span style="display: inline-flex; align-items: center; gap: 4px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); padding: 3px 10px; border-radius: 999px; font-size: 0.8rem; font-weight: 700; color: #f1f5f9;">
                <i data-lucide="package" style="width: 13px; height: 13px; color: #facc15;"></i>
                ${totalOrders}
              </span>
            </td>
            <td style="text-align: right; vertical-align: middle;">
              <button type="button" class="admin-user-accordion-btn btn-toggle-user-accordion" data-target="user-detail-${u.id}" title="Ver acciones completas">
                <span>Gestionar</span>
                <i data-lucide="chevron-down" style="width: 14px; height: 14px; transition: transform 0.2s; transform: ${expandedUserIds.has(String(u.id)) ? 'rotate(180deg)' : 'rotate(0deg)'};"></i>
              </button>
            </td>
          `;
          if (expandedUserIds.has(String(u.id))) {
            trHeader.classList.add('is-expanded');
          }
          usersTableBody.appendChild(trHeader);

          // 2. Expandable Accordion Sub-row
          const trDetail = document.createElement('tr');
          trDetail.id = `user-detail-${u.id}`;
          trDetail.className = `admin-user-detail-row ${expandedUserIds.has(String(u.id)) ? '' : 'hidden'}`;
          trDetail.innerHTML = `
            <td colspan="5" style="padding: 0;">
              <div class="admin-user-detail-container">
                <!-- Bloque 1: Ajuste de Saldos / Billeteras -->
                <div class="admin-detail-block">
                  <div class="admin-detail-block-title">
                    <i data-lucide="wallet" style="width: 14px; height: 14px; color: #38bdf8;"></i>
                    Modificar Saldo (Servidor Activo: ${currentServerId === '1' ? 'MEGA' : 'OMEGA'})
                  </div>
                  <div style="display: flex; gap: 8px; align-items: center; margin-top: 8px;">
                    <button type="button" class="btn btn-secondary btn-small btn-recharge-user" data-id="${u.id}" style="flex: 1; justify-content: center; background: rgba(34, 211, 238, 0.12); color: #22d3ee; border-color: rgba(34, 211, 238, 0.35); font-weight: 700; font-size: 0.78rem;">
                      <i data-lucide="plus" style="width: 14px; height: 14px;"></i> Añadir Saldo
                    </button>
                    <button type="button" class="btn btn-secondary btn-small btn-deduct-user" data-id="${u.id}" style="flex: 1; justify-content: center; background: rgba(244, 63, 94, 0.12); color: #f43f5e; border-color: rgba(244, 63, 94, 0.35); font-weight: 700; font-size: 0.78rem;">
                      <i data-lucide="minus" style="width: 14px; height: 14px;"></i> Quitar Saldo
                    </button>
                  </div>
                  <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 8px;">
                    Cambia el selector superior MEGA / OMEGA para abonar a uno u otro servidor.
                  </div>
                </div>

                <!-- Bloque 2: Credenciales y Seguridad -->
                <div class="admin-detail-block">
                  <div class="admin-detail-block-title">
                    <i data-lucide="key" style="width: 14px; height: 14px; color: #facc15;"></i>
                    Contraseña & Rol
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                    <input type="password" class="user-password-field" value="${escapeHtml(u.password || '')}" readonly style="flex: 1; padding: 6px 10px; font-size: 0.8rem; border-radius: 6px; background: rgba(0,0,0,0.4); border: 1px solid var(--border-color); color: white; font-family: monospace;">
                    <button type="button" class="btn-icon btn-toggle-pwd" title="Mostrar/Ocultar" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; cursor: pointer; color: white;"><i data-lucide="eye" style="width: 14px; height: 14px;"></i></button>
                    <button type="button" class="btn-icon btn-edit-pwd" data-id="${u.id}" title="Cambiar Contraseña" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: rgba(250, 204, 21, 0.15); border: 1px solid rgba(250, 204, 21, 0.3); border-radius: 6px; cursor: pointer; color: #facc15;"><i data-lucide="edit-3" style="width: 14px; height: 14px;"></i></button>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.75rem; color: #94a3b8;">Rol de usuario:</span>
                    ${u.role === 'admin' ? `<span class="status-badge" style="font-size:0.7rem; padding: 2px 8px; background: rgba(139, 92, 246, 0.2); color: #c4b5fd;">ADMINISTRADOR</span>` : 
                      `<select class="role-select" data-id="${u.id}" style="padding: 4px 8px; font-size: 0.75rem; background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.35); color: #c4b5fd; border-radius: 6px; outline: none; cursor: pointer;">
                        <option value="reseller" ${u.role === 'reseller' || !u.role ? 'selected' : ''}>RESELLER</option>
                        <option value="colaborador" ${u.role === 'colaborador' ? 'selected' : ''}>COLABORADOR</option>
                      </select>`
                    }
                  </div>
                </div>

                <!-- Bloque 3: Ganancia Markup & Conexión API -->
                <div class="admin-detail-block">
                  <div class="admin-detail-block-title">
                    <i data-lucide="cpu" style="width: 14px; height: 14px; color: #38bdf8;"></i>
                    Comisión Markup & API Fork
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 0.75rem; color: #94a3b8;">Aumento adicional:</span>
                    <div style="display: flex; align-items: center; gap: 4px;">
                      <span style="color:var(--text-secondary); font-size: 0.8rem;">$</span>
                      <input type="number" step="0.1" class="user-markup-input" data-id="${u.id}" value="${u.markup !== null && u.markup !== undefined ? u.markup : ''}" placeholder="Global" style="width: 80px; padding: 4px 8px; border-radius: 6px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); color: white; font-size: 0.8rem;">
                    </div>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.06);">
                    <span style="font-size: 0.75rem; color: #94a3b8;">Acceso API Bridge:</span>
                    <button type="button" class="btn-toggle-api-status" data-id="${u.id}" data-api="${isApiActive ? 'true' : 'false'}" style="background: ${isApiActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; border: 1px solid ${isApiActive ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'}; color: ${isApiActive ? '#4ade80' : '#f87171'}; padding: 3px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                      <i data-lucide="${isApiActive ? 'check' : 'x'}" style="width: 12px; height: 12px;"></i>
                      ${isApiActive ? 'API Activada' : 'API Inactiva'}
                    </button>
                  </div>
                </div>

                <!-- Bloque 4: Acciones Avanzadas & Bot WhatsApp -->
                <div class="admin-detail-block">
                  <div class="admin-detail-block-title">
                    <i data-lucide="settings" style="width: 14px; height: 14px; color: #a78bfa;"></i>
                    Acciones de Cuenta
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 6px;">
                    <button type="button" class="btn btn-secondary btn-small btn-impersonate-user" data-id="${u.id}" data-name="${escapeHtml(u.username)}" style="justify-content: center; background: rgba(139, 92, 246, 0.15); color: #c4b5fd; border-color: rgba(139, 92, 246, 0.35); padding: 6px 12px; font-size: 0.78rem;">
                      <i data-lucide="user-check" style="width: 14px; height: 14px;"></i> Iniciar Sesión como este usuario
                    </button>

                    ${!u.linkedBot && u.phone && u.phone !== '-' ? `
                      <button type="button" class="btn btn-secondary btn-small btn-notify-user-bot" data-id="${u.id}" data-name="${escapeHtml(u.username)}" style="justify-content: center; background: rgba(37, 211, 102, 0.15); color: #25D366; border-color: rgba(37, 211, 102, 0.35); padding: 6px 12px; font-size: 0.78rem;">
                        <i data-lucide="message-circle" style="width: 14px; height: 14px;"></i> Enviar invitación Bot WhatsApp
                      </button>
                    ` : ''}

                    ${u.role !== 'admin' ? `
                      <button type="button" class="btn btn-secondary btn-small btn-delete-user" data-id="${u.id}" style="justify-content: center; background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: rgba(239, 68, 68, 0.3); padding: 6px 12px; font-size: 0.78rem;">
                        <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Eliminar Usuario Permanentemente
                      </button>
                    ` : ''}
                  </div>
                </div>
              </div>
            </td>
          `;
          usersTableBody.appendChild(trDetail);
        });

        lucide.createIcons();
        bindAdminUserRowEvents();
      }

      function bindAdminUserRowEvents() {
        // Toggle Accordion Rows
        document.querySelectorAll('.btn-toggle-user-accordion').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetId = btn.dataset.target;
            const detailRow = document.getElementById(targetId);
            const parentRow = btn.closest('.admin-user-row-header');
            const icon = btn.querySelector('svg') || btn.querySelector('i');

            if (detailRow) {
              const isHidden = detailRow.classList.contains('hidden');
              if (isHidden) {
                detailRow.classList.remove('hidden');
                if (parentRow) parentRow.classList.add('is-expanded');
                if (icon) icon.style.transform = 'rotate(180deg)';
              } else {
                detailRow.classList.add('hidden');
                if (parentRow) parentRow.classList.remove('is-expanded');
                if (icon) icon.style.transform = 'rotate(0deg)';
              }
            }
          });
        });

        // Also allow clicking header row directly to toggle accordion
        document.querySelectorAll('.admin-user-row-header').forEach(row => {
          row.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;
            const btn = row.querySelector('.btn-toggle-user-accordion');
            if (btn) btn.click();
          });
        });

        // Toggle API Key Enablement
        document.querySelectorAll('.btn-toggle-api-status').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const currentApi = e.currentTarget.dataset.api === 'true';
            const newApi = !currentApi;

            try {
              const res = await fetch(`/api/users/${id}`, {
                method: 'PUT',
                headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ isApiEnabled: newApi })
              });
              if (res.ok) {
                const targetUser = (window.cachedAdminUsers || []).find(u => String(u.id) === String(id));
                if (targetUser) targetUser.isApiEnabled = newApi;
                renderFilteredAdminUsers();
                if (window.showToast) window.showToast(`Acceso API ${newApi ? 'activado' : 'desactivado'}.`, 'success');
              } else {
                alert('Error al modificar estado de la API.');
              }
            } catch (err) {
              console.error(err);
              alert('Error de conexión.');
            }
          });
        });
        // Toggle Active / Deactive user account
        document.querySelectorAll('.btn-toggle-active-status').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const currentActive = e.currentTarget.dataset.active === 'true';
            const newActive = !currentActive;
            const actionText = newActive ? 'ACTIVAR' : 'DESACTIVAR';
            
            if (!confirm(`¿Estás seguro de que deseas ${actionText} la cuenta de este usuario? ${newActive ? 'Podrá volver a ingresar al panel.' : 'No podrá iniciar sesión hasta que lo reactives.'}`)) {
              return;
            }

            try {
              const res = await fetch(`/api/users/${id}`, {
                method: 'PUT',
                headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ isActive: newActive })
              });
              if (res.ok) {
                const targetUser = (window.cachedAdminUsers || []).find(u => String(u.id) === String(id));
                if (targetUser) targetUser.isActive = newActive;
                renderFilteredAdminUsers();
                if (window.showToast) window.showToast(`Cuenta ${newActive ? 'activada' : 'desactivada'} correctamente.`, 'success');
              } else {
                alert('Error al cambiar estado de la cuenta.');
              }
            } catch (err) {
              console.error(err);
              alert('Error de conexión.');
            }
          });
        });

        // Bind Notify Unlinked User (Individual)
        document.querySelectorAll('.btn-notify-user-bot').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const userId = e.currentTarget.dataset.id;
            const username = e.currentTarget.dataset.name;
            if (!confirm(`¿Deseas enviar un recordatorio por WhatsApp a "${username}" para que vincule su cuenta con el Bot?`)) return;

            try {
              const res = await fetch('/api/admin/notify-unlinked-bot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ userId })
              });
              const data = await res.json();
              if (res.ok && data.success) {
                if (window.showToast) window.showToast(`Mensaje enviado a ${username}.`, 'success');
                else alert(data.message);
              } else {
                if (window.showToast) window.showToast(data.error || 'Error al enviar invitación', 'error');
                else alert(data.error || 'Error');
              }
            } catch (err) {
              alert('Error de conexión');
            }
          });
        });

        // Bind Roles
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

        // Bind Markups
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

        // Delete User
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

        // Recharge User
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

        // Deduct User
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

      // Initial render of users
      renderFilteredAdminUsers();

      // Search and Filter Listeners
      const adminUsersSearchInput = document.getElementById('adminUsersSearchInput');
      if (adminUsersSearchInput && !adminUsersSearchInput.dataset.bound) {
        adminUsersSearchInput.dataset.bound = 'true';
        adminUsersSearchInput.addEventListener('input', () => renderFilteredAdminUsers());
      }
      const adminUsersStatusFilter = document.getElementById('adminUsersStatusFilter');
      if (adminUsersStatusFilter && !adminUsersStatusFilter.dataset.bound) {
        adminUsersStatusFilter.dataset.bound = 'true';
        adminUsersStatusFilter.addEventListener('change', () => renderFilteredAdminUsers());
      }
      const adminUsersRoleFilter = document.getElementById('adminUsersRoleFilter');
      if (adminUsersRoleFilter && !adminUsersRoleFilter.dataset.bound) {
        adminUsersRoleFilter.dataset.bound = 'true';
        adminUsersRoleFilter.addEventListener('change', () => renderFilteredAdminUsers());
      }

      // Impersonate User (Entrar a cuenta de usuario sin cerrar sesión)
      document.querySelectorAll('.btn-impersonate-user').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.dataset.id;
          const uname = e.currentTarget.dataset.name;
          if (!confirm(`¿Deseas entrar a la cuenta de "${uname}" para revisar su saldo, pedidos e historial?\n\nPodrás regresar a tu cuenta Admin en cualquier momento con un solo clic.`)) {
            return;
          }

          try {
            const res = await fetch(`/api/users/${id}/impersonate`, {
              method: 'POST',
              headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              }
            });
            const data = await res.json();
            if (!res.ok || !data.token) {
              alert(data.error || 'Error al entrar a la cuenta del usuario.');
              return;
            }

            // Guardar credenciales de retorno del Admin
            const adminBackup = {
              token: authToken,
              role: authRole,
              username: authUsername,
              uid: authUserId
            };
            localStorage.setItem('admin_impersonator_backup', JSON.stringify(adminBackup));

            // Establecer nueva sesión del usuario objetivo
            localStorage.setItem('dhru_token', data.token);
            localStorage.setItem('dhru_role', data.user.role || 'reseller');
            localStorage.setItem('dhru_username', data.user.username);
            localStorage.setItem('dhru_uid', data.user.id);

            // Redirigir al inicio del dashboard con recarga limpia
            window.location.reload();
          } catch (err) {
            console.error('Error al impersonar usuario:', err);
            alert('Error al conectar con el servidor.');
          }
        });
      });

      // Bulk Notify Unlinked Users
      const btnNotifyUnlinkedAll = document.getElementById('btnNotifyUnlinkedAll');
      if (btnNotifyUnlinkedAll) {
        btnNotifyUnlinkedAll.onclick = async () => {
          if (!confirm('¿Deseas enviar una invitación por WhatsApp a TODOS los usuarios registrados que aún no tienen el Bot vinculado?')) return;
          
          btnNotifyUnlinkedAll.setAttribute('disabled', 'true');
          const originalText = btnNotifyUnlinkedAll.innerHTML;
          btnNotifyUnlinkedAll.innerHTML = '<i data-lucide="loader-2" class="icon-spin"></i> Enviando...';
          lucide.createIcons();

          try {
            const res = await fetch('/api/admin/notify-unlinked-bot', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
              body: JSON.stringify({})
            });
            const data = await res.json();
            if (res.ok && data.success) {
              if (window.showToast) window.showToast(data.message || `Invitaciones enviadas.`, 'success', 'Bot Notificaciones');
              else alert(data.message);
            } else {
              if (window.showToast) window.showToast(data.error || 'Error al enviar notificaciones.', 'error');
              else alert(data.error || 'Error');
            }
          } catch (err) {
            alert('Error de conexión con el servidor.');
          } finally {
            btnNotifyUnlinkedAll.removeAttribute('disabled');
            btnNotifyUnlinkedAll.innerHTML = originalText;
            lucide.createIcons();
          }
        };
      }
    }
    } catch (usersErr) {
      console.error('Error cargando lista de usuarios:', usersErr);
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
const btnAdminTabFinance = document.getElementById('btnAdminTabFinance');

const adminTabUsers = document.getElementById('adminTabUsersContent');
const adminTabHistory = document.getElementById('adminTabHistoryContent');
const adminTabSettings = document.getElementById('adminTabSettingsContent');
const adminTabGroups = document.getElementById('adminTabGroupsContent');
const adminTabFinance = document.getElementById('adminTabFinanceContent');

if (btnAdminTabUsers) {
  btnAdminTabUsers.addEventListener('click', () => {
    document.querySelectorAll('.admin-sub-tab').forEach(t => t.classList.remove('active'));
    btnAdminTabUsers.classList.add('active');
    adminTabUsers.classList.remove('hidden');
    adminTabHistory.classList.add('hidden');
    adminTabSettings.classList.add('hidden');
    if (adminTabGroups) { adminTabGroups.classList.add('hidden'); adminTabGroups.style.display = 'none'; }
    if (adminTabFinance) adminTabFinance.classList.add('hidden');
  });
}

if (btnAdminTabHistory) {
  btnAdminTabHistory.addEventListener('click', () => {
    document.querySelectorAll('.admin-sub-tab').forEach(t => t.classList.remove('active'));
    btnAdminTabHistory.classList.add('active');
    adminTabHistory.classList.remove('hidden');
    adminTabUsers.classList.add('hidden');
    adminTabSettings.classList.add('hidden');
    if (adminTabGroups) { adminTabGroups.classList.add('hidden'); adminTabGroups.style.display = 'none'; }
    if (adminTabFinance) adminTabFinance.classList.add('hidden');
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
    if (adminTabGroups) { adminTabGroups.classList.add('hidden'); adminTabGroups.style.display = 'none'; }
    if (adminTabFinance) adminTabFinance.classList.add('hidden');
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
    if (adminTabFinance) adminTabFinance.classList.add('hidden');
    
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

if (btnAdminTabFinance) {
  btnAdminTabFinance.addEventListener('click', () => {
    const tabFin = document.getElementById('tabFinance');
    if (tabFin) {
      tabFin.click();
      return;
    }
    document.querySelectorAll('.admin-sub-tab').forEach(t => t.classList.remove('active'));
    btnAdminTabFinance.classList.add('active');
    const finSec = document.getElementById('financeSection');
    if (finSec) finSec.classList.remove('hidden');
    loadFinanceDashboard();
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
      
      const logoVal = document.getElementById('gm_logo_' + safeId).value.trim();
      const isHotVal = document.getElementById('gm_hot_' + safeId).checked;
      
      if (valR !== '' || valC !== '' || typeR.startsWith('tier') || typeC.startsWith('tier') || logoVal !== '' || isHotVal) {
        payload[groupName] = {
          type: typeR,
          value: parseFloat(valR) || 0,
          clientType: typeC,
          clientValue: parseFloat(valC) || 0,
          logo: logoVal,
          isHot: isHotVal
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

      const inputServerName = document.getElementById('inputServerName');
      const inputServerEndpoint = document.getElementById('inputServerEndpoint');
      const inputServerUsername = document.getElementById('inputServerUsername');
      const inputServerApiKey = document.getElementById('inputServerApiKey');
      const inputServerEnabled = document.getElementById('inputServerEnabled');

      if (inputServerName && inputServerName.value.trim()) tiersObj.name = inputServerName.value.trim();
      if (inputServerEndpoint && inputServerEndpoint.value.trim()) tiersObj.endpoint = inputServerEndpoint.value.trim();
      if (inputServerUsername && inputServerUsername.value.trim()) tiersObj.username = inputServerUsername.value.trim();
      if (inputServerApiKey && inputServerApiKey.value.trim()) tiersObj.apiaccesskey = inputServerApiKey.value.trim();
      if (inputServerEnabled) tiersObj.enabled = inputServerEnabled.checked;

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

const btnSaveAppearance = document.getElementById('btnSaveAppearance');
if (btnSaveAppearance) {
  btnSaveAppearance.addEventListener('click', async () => {
    try {
      const marqueeImages = document.getElementById('inputMarqueeImages') ? document.getElementById('inputMarqueeImages').value : '';
      
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ global: { marqueeImages } })
      });
      
      if (res.ok) {
        alert('Apariencia guardada con éxito.');
        if (typeof fetchPublicSettings === 'function') fetchPublicSettings();
      } else {
        alert('Error al guardar apariencia.');
      }
    } catch (err) {
      alert('Error de conexión.');
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

// ==========================================
// --- GESTOR FINANCIERO Y CONTROL DE GANANCIAS ---
// ==========================================
let currentFinanceData = null;

async function loadFinanceDashboard() {
  const tableBody = document.getElementById('financeLedgerTableBody');
  const accountsGrid = document.getElementById('financeAccountsGrid');
  if (tableBody) tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 24px; color: #64748b;"><div class="spinner" style="margin: 0 auto 10px;"></div>Cargando registros contables...</td></tr>';
  
  try {
    const res = await fetch('/api/admin/finance', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Server-Id': currentServerId
      }
    });

    if (!res.ok) throw new Error('Error al consultar finanzas: ' + res.statusText);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Fallo al obtener datos contables');

    currentFinanceData = data;
    renderFinanceKPIs(data.summary, data.config);
    renderFinanceAccounts(data.accounts, data.config);
    renderFinanceCategories(data.categories);
    renderFinanceCharts(data);
    renderFinanceLedger(data.recent);
    populateManualAccountsSelect(data.accounts);

    // Actualizar sliders en configuración
    const slider = document.getElementById('inputFinanceReinvestPercent');
    const label = document.getElementById('labelFinanceReinvestPercent');
    const accountsInput = document.getElementById('inputFinanceAccounts');
    if (slider && data.config) {
      slider.value = data.config.reinvestPercent || 50;
      if (label) label.textContent = `${slider.value}%`;
      updateReinvestSplitPreview(slider.value);
    }
    if (accountsInput && data.config) {
      accountsInput.value = (data.config.accounts || []).join(', ');
    }

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('[FINANCE DASHBOARD ERR]', err);
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px; color: #ef4444;"><i data-lucide="alert-triangle"></i> ${escapeHtml(err.message)}</td></tr>`;
    if (window.lucide) window.lucide.createIcons();
  }
}

function updateReinvestSplitPreview(pct) {
  const p = parseFloat(pct) || 0;
  const reinvSpan = document.getElementById('previewReinvestSplit');
  const profSpan = document.getElementById('previewProfitSplit');
  if (reinvSpan) reinvSpan.textContent = `$${p.toFixed(0)} irán a fondo de saldo`;
  if (profSpan) profSpan.textContent = `$${(100 - p).toFixed(0)} a tu bolsillo`;
  const badge = document.getElementById('finKpiReinvestPercentBadge');
  if (badge) badge.textContent = `Cuota fijada: ${p}%`;
}

function renderFinanceKPIs(summary, config) {
  const elCharged = document.getElementById('finKpiTotalCharged');
  const elCost = document.getElementById('finKpiTotalCost');
  const elReinvest = document.getElementById('finKpiTotalReinvest');
  const elNetProfit = document.getElementById('finKpiNetProfit');

  if (elCharged) elCharged.textContent = `$${parseFloat(summary.totalCharged || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
  if (elCost) elCost.textContent = `$${parseFloat(summary.totalCost || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
  if (elReinvest) elReinvest.textContent = `$${parseFloat(summary.totalReinvest || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
  if (elNetProfit) elNetProfit.textContent = `$${parseFloat(summary.totalNetProfit || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
}

function renderFinanceAccounts(accounts, config) {
  const container = document.getElementById('financeAccountsGrid');
  const totalAssetsBadge = document.getElementById('financeTotalAssetsBadge');
  if (!container) return;

  if (!accounts || accounts.length === 0) {
    container.innerHTML = '<div style="color: #64748b; font-size: 0.85rem;">No hay cuentas registradas.</div>';
    if (totalAssetsBadge) totalAssetsBadge.textContent = 'Patrimonio: $0.00 MXN';
    return;
  }

  let totalAssets = 0;

  // Iconos y colores distintivos por banco o tipo de activo
  const bankStyles = {
    'nu': { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.35)', icon: 'credit-card' },
    'revolut': { color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.15)', border: 'rgba(14, 165, 233, 0.35)', icon: 'globe' },
    'mercado pago': { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.35)', icon: 'smartphone' },
    'bbva': { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.18)', border: 'rgba(59, 130, 246, 0.4)', icon: 'landmark' },
    'efectivo': { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)', icon: 'banknote' },
    'emergencia': { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.35)', icon: 'shield-alert' },
    'inversion': { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.35)', icon: 'trending-up' },
    'server': { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.35)', icon: 'server' }
  };

  container.innerHTML = accounts.map(acc => {
    const accName = acc.name || acc.account || 'Cuenta';
    const key = accName.toLowerCase().trim();
    const typeKey = (acc.type || '').toLowerCase();
    
    // Identificar estilo
    let style = bankStyles[key] || bankStyles[typeKey] || { 
      color: acc.color || '#38bdf8', 
      bg: `${acc.color || '#38bdf8'}22`, 
      border: `${acc.color || '#38bdf8'}55`, 
      icon: acc.icon || 'wallet' 
    };

    const net = parseFloat(acc.netProfit || 0);
    const balance = parseFloat(acc.balance || 0);
    totalAssets += balance;

    const typeBadge = acc.type === 'emergency' 
      ? '<span style="background: rgba(239, 68, 68, 0.25); color: #fca5a5; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 800;">EMERGENCIA</span>'
      : (acc.type === 'investment' 
          ? '<span style="background: rgba(245, 158, 11, 0.25); color: #fcd34d; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 800;">INVERSIÓN</span>'
          : (acc.type === 'server'
              ? '<span style="background: rgba(139, 92, 246, 0.25); color: #c4b5fd; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 800;">SERVIDOR</span>'
              : (acc.type === 'card'
                  ? '<span style="background: rgba(56, 189, 248, 0.25); color: #7dd3fc; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 800;">TARJETA</span>'
                  : '')));

    return `
      <div style="background: ${style.bg}; border: 1px solid ${style.border}; border-radius: 12px; padding: 14px 16px; position: relative; overflow: hidden; transition: transform 0.2s ease;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-weight: 800; font-size: 0.95rem; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="${style.icon}" style="width: 17px; height: 17px; color: ${style.color};"></i> ${escapeHtml(accName)}
          </span>
          <div>${typeBadge}</div>
        </div>
        <div style="font-size: 1.35rem; font-weight: 800; color: #ffffff; font-family: 'Fira Code', monospace;">
          $${balance.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 0.72rem; color: #cbd5e1; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px;">
          <span>Ganancia generada:</span>
          <span style="font-weight: 700; color: ${net >= 0 ? '#34d399' : '#f87171'};">${net >= 0 ? '+' : ''}$${net.toFixed(2)}</span>
        </div>
      </div>
    `;
  }).join('');

  if (totalAssetsBadge) {
    totalAssetsBadge.textContent = `Patrimonio Total: $${totalAssets.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
  }
}

function renderFinanceCategories(categories) {
  const container = document.getElementById('financeCategoriesGrid');
  if (!container) return;

  const catMeta = {
    'comida': { label: 'Comida & Súper', icon: 'utensils', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
    'pasaje': { label: 'Pasaje & Transporte', icon: 'bus', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
    'gustos': { label: 'Gustos & Salidas', icon: 'sparkles', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
    'servidores': { label: 'Servidores & DHRU', icon: 'server', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
    'emergencia': { label: 'Emergencias', icon: 'shield-alert', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    'inversion': { label: 'Inversiones', icon: 'trending-up', color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)' },
    'servicios': { label: 'Servicios Básicos', icon: 'zap', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
    'otros': { label: 'Otros Gastos', icon: 'package', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' }
  };

  const list = Object.keys(catMeta).map(key => {
    const meta = catMeta[key];
    const catData = (categories || []).find(c => c.category === key) || { totalCost: 0, count: 0 };
    return {
      key,
      ...meta,
      total: parseFloat(catData.totalCost || 0),
      count: parseInt(catData.count || 0, 10)
    };
  });

  container.innerHTML = list.map(c => `
    <div style="background: ${c.bg}; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 10px 14px; display: flex; align-items: center; gap: 10px;">
      <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: ${c.color};">
        <i data-lucide="${c.icon}" style="width: 16px; height: 16px;"></i>
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 0.72rem; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.label}</div>
        <div style="font-size: 0.95rem; font-weight: 800; color: #f8fafc; font-family: monospace;">$${c.total.toFixed(2)}</div>
      </div>
    </div>
  `).join('');
}

// Instancias globales de Chart.js para evitar fugas de memoria al refrescar
let chartDailyFlowInstance = null;
let chartCategoryDoughnutInstance = null;
let chartWeeklyAuditsInstance = null;

function renderFinanceCharts(data) {
  if (typeof Chart === 'undefined') return;

  // 1. Gráfica 1: Flujo Diario (30 Días) - Ingresos vs Gastos vs Ganancias
  const ctxDaily = document.getElementById('chartFinanceDailyFlow');
  if (ctxDaily) {
    if (chartDailyFlowInstance) chartDailyFlowInstance.destroy();

    const trends = data.dailyTrends && data.dailyTrends.length > 0 ? data.dailyTrends : [
      { date: 'Hoy', income: parseFloat(data.summary?.totalCharged || 0), expense: parseFloat(data.summary?.totalCost || 0), profit: parseFloat(data.summary?.totalNetProfit || 0) }
    ];

    const labels = trends.map(t => t.date.length > 5 ? t.date.substring(5) : t.date);
    const incomes = trends.map(t => parseFloat(t.income || 0));
    const expenses = trends.map(t => parseFloat(t.expense || 0));
    const profits = trends.map(t => parseFloat(t.profit || 0));

    chartDailyFlowInstance = new Chart(ctxDaily, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Ganancia Neta ($)',
            data: profits,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 6
          },
          {
            label: 'Ingresos ($)',
            data: incomes,
            borderColor: '#38bdf8',
            backgroundColor: 'transparent',
            borderDash: [4, 4],
            tension: 0.3,
            borderWidth: 1.8,
            pointRadius: 2
          },
          {
            label: 'Gastos ($)',
            data: expenses,
            borderColor: '#f87171',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            fill: true,
            tension: 0.3,
            borderWidth: 1.8,
            pointRadius: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#cbd5e1', font: { size: 10, family: 'Inter' }, boxWidth: 12 }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: $${parseFloat(ctx.raw || 0).toFixed(2)} MXN`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#94a3b8', font: { size: 10 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.06)' },
            ticks: { color: '#94a3b8', font: { size: 10 }, callback: (val) => `$${val}` }
          }
        }
      }
    });
  }

  // 2. Gráfica 2: Doughnut de Categorías de Gastos
  const ctxCategory = document.getElementById('chartFinanceCategoryDoughnut');
  if (ctxCategory) {
    if (chartCategoryDoughnutInstance) chartCategoryDoughnutInstance.destroy();

    const catMeta = {
      'comida': { label: 'Comida', color: '#f97316' },
      'pasaje': { label: 'Pasaje', color: '#06b6d4' },
      'gustos': { label: 'Gustos', color: '#ec4899' },
      'servidores': { label: 'Servidores', color: '#8b5cf6' },
      'emergencia': { label: 'Emergencias', color: '#ef4444' },
      'inversion': { label: 'Inversiones', color: '#eab308' },
      'servicios': { label: 'Servicios', color: '#3b82f6' },
      'otros': { label: 'Otros', color: '#94a3b8' }
    };

    const categories = (data.categories && data.categories.length > 0) ? data.categories : [];
    const validCats = categories.filter(c => parseFloat(c.totalExpense || c.totalCost || 0) > 0);

    let catLabels = validCats.map(c => catMeta[c.category]?.label || c.category);
    let catValues = validCats.map(c => parseFloat(c.totalExpense || c.totalCost || 0));
    let catColors = validCats.map(c => catMeta[c.category]?.color || '#64748b');

    if (catValues.length === 0) {
      catLabels = ['Sin Gastos Aún'];
      catValues = [1];
      catColors = ['rgba(255,255,255,0.1)'];
    }

    chartCategoryDoughnutInstance = new Chart(ctxCategory, {
      type: 'doughnut',
      data: {
        labels: catLabels,
        datasets: [{
          data: catValues,
          backgroundColor: catColors,
          borderWidth: 1,
          borderColor: 'rgba(15, 23, 42, 0.9)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#cbd5e1', font: { size: 10, family: 'Inter' }, boxWidth: 10 }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: $${parseFloat(ctx.raw || 0).toFixed(2)} MXN`
            }
          }
        },
        cutout: '68%'
      }
    });
  }

  // 3. Gráfica 3: Rendimiento en Cierres Semanales (Auditorías)
  const ctxWeekly = document.getElementById('chartFinanceWeeklyAudits');
  if (ctxWeekly) {
    if (chartWeeklyAuditsInstance) chartWeeklyAuditsInstance.destroy();

    const audits = (data.weeklyAudits && data.weeklyAudits.length > 0) ? [...data.weeklyAudits].reverse() : [];
    const labels = audits.map(a => `${a.weekStart.substring(5)} al ${a.weekEnd.substring(5)}`);
    const incomes = audits.map(a => parseFloat(a.totalIncome || 0));
    const expenses = audits.map(a => parseFloat(a.totalExpenses || 0));
    const savings = audits.map(a => parseFloat(a.netSavings || 0));

    chartWeeklyAuditsInstance = new Chart(ctxWeekly, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['Semana Actual'],
        datasets: [
          {
            label: 'Ingresos Semanales ($)',
            data: incomes.length > 0 ? incomes : [parseFloat(data.summary?.totalCharged || 0)],
            backgroundColor: 'rgba(56, 189, 248, 0.75)',
            borderRadius: 6
          },
          {
            label: 'Gastos Semanales ($)',
            data: expenses.length > 0 ? expenses : [parseFloat(data.summary?.totalCost || 0)],
            backgroundColor: 'rgba(239, 68, 68, 0.75)',
            borderRadius: 6
          },
          {
            label: 'Ahorro / Ganancia Neta ($)',
            data: savings.length > 0 ? savings : [parseFloat(data.summary?.totalNetProfit || 0)],
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#cbd5e1', font: { size: 10, family: 'Inter' }, boxWidth: 12 }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: $${parseFloat(ctx.raw || 0).toFixed(2)} MXN`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#94a3b8', font: { size: 10 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.06)' },
            ticks: { color: '#94a3b8', font: { size: 10 }, callback: (val) => `$${val}` }
          }
        }
      }
    });
  }
}

function renderFinanceLedger(records) {
  const tableBody = document.getElementById('financeLedgerTableBody');
  if (!tableBody) return;

  if (!records || records.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 32px; color: #64748b;">Aún no hay movimientos registrados. Genera un ticket en WhatsApp o pulsa "+ Nuevo Ingreso / Gasto" arriba para empezar.</td></tr>`;
    return;
  }

  tableBody.innerHTML = records.map(r => {
    let dateStr = 'N/A';
    if (r.createdAt) {
      try {
        dateStr = new Date(r.createdAt).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'short' });
      } catch (e) {
        dateStr = String(r.createdAt).substring(0, 16);
      }
    }

    const isExpense = r.type === 'expense_manual';
    const isTicket = r.type === 'income_ticket';
    const typeBadge = isExpense 
      ? '<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700;">GASTO</span>'
      : (isTicket 
          ? '<span style="background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700;">TICKET</span>'
          : '<span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700;">VENTA</span>');

    const orderDisplay = r.orderId ? `<span style="font-family: monospace; font-weight: 700; color: #60a5fa;">#${escapeHtml(r.orderId)}</span>` : '<span style="color: #64748b;">Manual</span>';
    const charged = parseFloat(r.chargedAmount || 0);
    const cost = parseFloat(r.costAmount || 0);
    const reinvest = parseFloat(r.reinvestAmount || 0);
    const net = parseFloat(r.netProfit || 0);

    return `
      <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); transition: background 0.15s ease;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
        <td style="padding: 10px 14px; color: #94a3b8; font-family: monospace; font-size: 0.75rem;">${escapeHtml(dateStr)}</td>
        <td style="padding: 10px 14px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            ${typeBadge} ${orderDisplay}
          </div>
        </td>
        <td style="padding: 10px 14px; font-weight: 600; color: #f1f5f9;">
          ${escapeHtml(r.serviceName || r.notes || 'Operación')}
        </td>
        <td style="padding: 10px 14px;">
          <span style="background: rgba(168, 85, 247, 0.15); color: #c084fc; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">
            ${escapeHtml(r.account || 'General')}
          </span>
        </td>
        <td style="padding: 10px 14px; text-align: right; font-family: monospace; font-weight: 700; color: ${charged > 0 ? '#f8fafc' : '#64748b'};">
          $${charged.toFixed(2)}
        </td>
        <td style="padding: 10px 14px; text-align: right; font-family: monospace; color: ${cost > 0 ? '#fca5a5' : '#64748b'};">
          -$${cost.toFixed(2)}
        </td>
        <td style="padding: 10px 14px; text-align: right; font-family: monospace; font-weight: 700; color: ${reinvest > 0 ? '#93c5fd' : '#64748b'};">
          +$${reinvest.toFixed(2)}
        </td>
        <td style="padding: 10px 14px; text-align: right; font-family: monospace; font-weight: 800; font-size: 0.88rem; color: ${net >= 0 ? '#34d399' : '#ef4444'};">
          ${net >= 0 ? '+' : ''}$${net.toFixed(2)}
        </td>
        <td style="padding: 10px 14px; text-align: center;">
          <button type="button" onclick="deleteFinanceEntry('${r.id}')" title="Eliminar movimiento" style="background: transparent; border: none; color: #ef4444; cursor: pointer; padding: 4px; border-radius: 4px; opacity: 0.7;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function populateManualAccountsSelect(accounts) {
  const selOrigin = document.getElementById('manualEntryAccount');
  const selDest = document.getElementById('manualEntryDestAccount');
  if (!selOrigin) return;

  const list = (accounts && accounts.length > 0)
    ? accounts.map(a => typeof a === 'string' ? a : (a.name || a.account))
    : ['Nu', 'Revolut', 'Mercado Pago', 'BBVA', 'Efectivo', 'Emergencias', 'Inversión', 'Server'];

  const optionsHtml = list.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
  selOrigin.innerHTML = optionsHtml;
  if (selDest) selDest.innerHTML = optionsHtml;
}

async function deleteFinanceEntry(id) {
  if (!confirm('¿Deseas eliminar este registro contable del libro?')) return;
  try {
    const res = await fetch(`/api/admin/finance/transaction/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Server-Id': currentServerId
      }
    });
    if (res.ok) {
      loadFinanceDashboard();
    } else {
      alert('No se pudo eliminar el registro.');
    }
  } catch (err) {
    alert('Error de conexión: ' + err.message);
  }
}

// Event Listeners para Finanzas
document.addEventListener('DOMContentLoaded', () => {
  // Toggle Contenedor Config
  const btnToggleCfg = document.getElementById('btnToggleFinanceConfig');
  const cfgContainer = document.getElementById('financeConfigContainer');
  const btnCancelCfg = document.getElementById('btnCancelFinanceConfig');
  if (btnToggleCfg && cfgContainer) {
    btnToggleCfg.addEventListener('click', () => {
      cfgContainer.classList.toggle('hidden');
    });
  }
  if (btnCancelCfg && cfgContainer) {
    btnCancelCfg.addEventListener('click', () => cfgContainer.classList.add('hidden'));
  }

  // Slider de Reinversión
  const reinvestSlider = document.getElementById('inputFinanceReinvestPercent');
  const reinvestLabel = document.getElementById('labelFinanceReinvestPercent');
  if (reinvestSlider) {
    reinvestSlider.addEventListener('input', (e) => {
      if (reinvestLabel) reinvestLabel.textContent = `${e.target.value}%`;
      updateReinvestSplitPreview(e.target.value);
    });
  }

  // Guardar Configuración
  const formCfg = document.getElementById('formFinanceConfig');
  if (formCfg) {
    formCfg.addEventListener('submit', async (e) => {
      e.preventDefault();
      const p = parseFloat(document.getElementById('inputFinanceReinvestPercent').value) || 50;
      const rawAcc = document.getElementById('inputFinanceAccounts').value;
      const accList = rawAcc.split(',').map(s => s.trim()).filter(Boolean);

      try {
        const res = await fetch('/api/admin/finance/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'X-Server-Id': currentServerId
          },
          body: JSON.stringify({ reinvestPercent: p, accounts: accList })
        });
        if (res.ok) {
          alert('✅ Configuración financiera guardada exitosamente.');
          if (cfgContainer) cfgContainer.classList.add('hidden');
          loadFinanceDashboard();
        } else {
          alert('Error al guardar configuración');
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }

  // Control de campos al cambiar el tipo de operación manual (Transferencia / Ingreso / Gasto)
  const manualTypeSelect = document.getElementById('manualEntryType');
  const destAccountContainer = document.getElementById('containerManualDestAccount');
  const labelOriginAccount = document.getElementById('labelManualEntryAccount');
  const costInputContainer = document.getElementById('containerManualEntryCost');
  const chargedInputContainer = document.getElementById('containerManualEntryCharged');

  if (manualTypeSelect) {
    manualTypeSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'transfer') {
        if (destAccountContainer) destAccountContainer.style.display = 'block';
        if (labelOriginAccount) labelOriginAccount.textContent = 'Cuenta / Tarjeta Origen (De dónde sale)';
        if (costInputContainer) {
          const l = costInputContainer.querySelector('label');
          if (l) l.textContent = 'Monto a Transferir ($ MXN)';
        }
        if (chargedInputContainer) chargedInputContainer.style.display = 'none';
      } else if (val === 'expense_manual') {
        if (destAccountContainer) destAccountContainer.style.display = 'none';
        if (labelOriginAccount) labelOriginAccount.textContent = 'Cuenta / Tarjeta con la que pagaste';
        if (costInputContainer) {
          costInputContainer.style.display = 'block';
          const l = costInputContainer.querySelector('label');
          if (l) l.textContent = 'Monto Gastado / Costo ($ MXN)';
        }
        if (chargedInputContainer) chargedInputContainer.style.display = 'none';
      } else {
        if (destAccountContainer) destAccountContainer.style.display = 'none';
        if (labelOriginAccount) labelOriginAccount.textContent = 'Cuenta / Tarjeta Destino (A dónde entró)';
        if (costInputContainer) {
          costInputContainer.style.display = 'block';
          const l = costInputContainer.querySelector('label');
          if (l) l.textContent = 'Costo Servidor / Inversión ($ MXN)';
        }
        if (chargedInputContainer) chargedInputContainer.style.display = 'block';
      }
    });
  }

  // Toggle Gestor de Cuentas & Tarjetas
  const btnToggleAccs = document.getElementById('btnToggleFinanceAccounts');
  const accsContainer = document.getElementById('financeAccountsManagerContainer');
  const btnCloseAccs = document.getElementById('btnCloseAccountsManager');
  if (btnToggleAccs && accsContainer) {
    btnToggleAccs.addEventListener('click', () => {
      accsContainer.classList.toggle('hidden');
      if (!accsContainer.classList.contains('hidden')) {
        loadAccountsManagerList();
      }
    });
  }
  if (btnCloseAccs && accsContainer) {
    btnCloseAccs.addEventListener('click', () => accsContainer.classList.add('hidden'));
  }

  // Formulario Crear / Editar Cuenta o Tarjeta
  const formAcc = document.getElementById('formAddEditAccount');
  const btnCancelEditAcc = document.getElementById('btnCancelEditAccount');
  if (formAcc) {
    formAcc.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('accountFormId').value;
      const payload = {
        id: id || undefined,
        name: document.getElementById('accountFormName').value.trim(),
        type: document.getElementById('accountFormType').value,
        balance: parseFloat(document.getElementById('accountFormBalance').value) || 0,
        color: document.getElementById('accountFormColor').value
      };

      try {
        const res = await fetch('/api/admin/finance/accounts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'X-Server-Id': currentServerId
          },
          body: JSON.stringify(payload)
        });
        const resData = await res.json();
        if (res.ok && resData.success) {
          alert('✅ Cuenta guardada correctamente.');
          formAcc.reset();
          document.getElementById('accountFormId').value = '';
          if (btnCancelEditAcc) btnCancelEditAcc.style.display = 'none';
          loadAccountsManagerList();
          loadFinanceDashboard();
        } else {
          alert(resData.error || 'Error al guardar la cuenta');
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }
  if (btnCancelEditAcc && formAcc) {
    btnCancelEditAcc.addEventListener('click', () => {
      formAcc.reset();
      document.getElementById('accountFormId').value = '';
      btnCancelEditAcc.style.display = 'none';
    });
  }

  // Toggle Cierre Semanal
  const btnToggleAudit = document.getElementById('btnToggleWeeklyAudit');
  const auditContainer = document.getElementById('financeWeeklyAuditContainer');
  const btnCloseAudit = document.getElementById('btnCloseWeeklyAudit');
  if (btnToggleAudit && auditContainer) {
    btnToggleAudit.addEventListener('click', () => {
      auditContainer.classList.toggle('hidden');
      if (!auditContainer.classList.contains('hidden')) {
        loadWeeklyAuditView();
      }
    });
  }
  if (btnCloseAudit && auditContainer) {
    btnCloseAudit.addEventListener('click', () => auditContainer.classList.add('hidden'));
  }

  // Confirmar Cierre Semanal
  const btnConfirmAudit = document.getElementById('btnExecuteWeeklyAudit');
  if (btnConfirmAudit) {
    btnConfirmAudit.addEventListener('click', async () => {
      const notes = document.getElementById('weeklyAuditNotes').value.trim();
      if (!confirm('¿Deseas registrar y certificar el corte y balance semanal de todas tus cuentas ahora?')) return;

      try {
        const res = await fetch('/api/admin/finance/weekly-audit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'X-Server-Id': currentServerId
          },
          body: JSON.stringify({ notes })
        });
        const d = await res.json();
        if (res.ok && d.success) {
          alert('🏆 Cierre semanal completado y guardado en la bitácora con éxito.');
          document.getElementById('weeklyAuditNotes').value = '';
          loadWeeklyAuditView();
          loadFinanceDashboard();
        } else {
          alert(d.error || 'Error al generar el cierre semanal');
        }
      } catch (err) {
        alert('Error de conexión: ' + err.message);
      }
    });
  }

  // Toggle Form Manual
  const btnToggleManual = document.getElementById('btnToggleAddManualExpense');
  const manualContainer = document.getElementById('financeManualEntryContainer');
  const btnCancelManual = document.getElementById('btnCancelManualEntry');
  if (btnToggleManual && manualContainer) {
    btnToggleManual.addEventListener('click', () => {
      manualContainer.classList.toggle('hidden');
    });
  }
  if (btnCancelManual && manualContainer) {
    btnCancelManual.addEventListener('click', () => manualContainer.classList.add('hidden'));
  }

  // Guardar Transacción Manual
  const formManual = document.getElementById('formManualTransaction');
  if (formManual) {
    formManual.addEventListener('submit', async (e) => {
      e.preventDefault();
      const opType = document.getElementById('manualEntryType').value;
      const payload = {
        type: opType,
        category: document.getElementById('manualEntryCategory').value || 'otros',
        serviceName: document.getElementById('manualEntryService').value,
        chargedAmount: parseFloat(document.getElementById('manualEntryCharged').value) || 0,
        costAmount: parseFloat(document.getElementById('manualEntryCost').value) || 0,
        account: document.getElementById('manualEntryAccount').value,
        destAccount: opType === 'transfer' ? document.getElementById('manualEntryDestAccount').value : undefined,
        orderId: document.getElementById('manualEntryOrderId').value.trim()
      };

      try {
        const res = await fetch('/api/admin/finance/transaction', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'X-Server-Id': currentServerId
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          alert('✅ Movimiento contable registrado.');
          formManual.reset();
          if (destAccountContainer) destAccountContainer.style.display = 'none';
          if (manualContainer) manualContainer.classList.add('hidden');
          loadFinanceDashboard();
        } else {
          alert('Error al registrar movimiento.');
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }

  // Botón Recargar
  const btnReloadFin = document.getElementById('btnReloadFinance');
  if (btnReloadFin) {
    btnReloadFin.addEventListener('click', loadFinanceDashboard);
  }

  // Filtro de búsqueda en la tabla contable
  const searchFin = document.getElementById('financeSearchInput');
  if (searchFin) {
    searchFin.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!currentFinanceData || !currentFinanceData.recent) return;
      if (!q) {
        renderFinanceLedger(currentFinanceData.recent);
      } else {
        const filtered = currentFinanceData.recent.filter(r => {
          return (r.orderId && r.orderId.toLowerCase().includes(q)) ||
                 (r.serviceName && r.serviceName.toLowerCase().includes(q)) ||
                 (r.account && r.account.toLowerCase().includes(q)) ||
                 (r.notes && r.notes.toLowerCase().includes(q));
        });
        renderFinanceLedger(filtered);
      }
      if (window.lucide) window.lucide.createIcons();
    });
  }

  // Búsqueda Rápida de Ganancia por ID de Orden
  const btnLookup = document.getElementById('btnFinanceOrderLookup');
  const inputLookup = document.getElementById('financeOrderLookupInput');
  if (btnLookup && inputLookup) {
    btnLookup.addEventListener('click', () => lookupOrderFinance(inputLookup.value));
    inputLookup.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') lookupOrderFinance(inputLookup.value);
    });
  }
});

/**
 * Consultar ingreso, costo y ganancia real vinculada a una orden por su ID
 */
async function lookupOrderFinance(orderId) {
  const cleanId = String(orderId || '').replace(/[^0-9a-zA-Z_-]/g, '').trim();
  const resultContainer = document.getElementById('financeOrderLookupResult');
  if (!resultContainer) return;

  if (!cleanId) {
    alert('Ingresa el ID del pedido a consultar (ej. 12345)');
    return;
  }

  resultContainer.classList.remove('hidden');
  resultContainer.innerHTML = `
    <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(14, 165, 233, 0.4); border-radius: 12px; padding: 18px; text-align: center; color: #38bdf8;">
      <i data-lucide="loader" class="lucide-spin" style="width: 24px; height: 24px; margin-bottom: 6px; display: inline-block;"></i>
      <p style="margin: 0; font-size: 0.88rem;">Consultando estado contable y ganancias de la orden #${escapeHtml(cleanId)}...</p>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();

  try {
    const res = await fetch(`/api/admin/finance/order/${cleanId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Server-Id': currentServerId
      }
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      resultContainer.innerHTML = `
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 16px; color: #f87171; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <i data-lucide="alert-circle" style="width: 20px; height: 20px;"></i>
            <span>No se encontraron registros de venta o ganancia para la orden <strong>#${escapeHtml(cleanId)}</strong>.</span>
          </div>
          <button type="button" onclick="document.getElementById('financeOrderLookupResult').classList.add('hidden')" style="background: none; border: none; color: #f87171; cursor: pointer;">
            <i data-lucide="x" style="width: 16px; height: 16px;"></i>
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const o = data.order || {};
    const sum = data.financialSummary || {};
    const entries = data.ledgerEntries || [];

    // Priorizar datos del ledger contable si existen; sino calcular con orden del servidor
    const charged = sum.hasLedgerRecord ? sum.totalCharged : (parseFloat(o.costCharged || o.resellerCost || o.price || 0));
    const cost = sum.hasLedgerRecord ? sum.totalCost : (parseFloat(o.realCost || 0));
    const gross = sum.hasLedgerRecord ? sum.totalGrossProfit : (charged - cost);
    const reinvest = sum.hasLedgerRecord ? sum.totalReinvest : (gross > 0 ? (gross * 0.5) : 0);
    const net = sum.hasLedgerRecord ? sum.totalNetProfit : (gross > 0 ? (gross * 0.5) : gross);
    const accountName = entries.length > 0 ? entries[0].account : 'Server';

    let entriesHtml = '';
    if (entries.length > 0) {
      entriesHtml = `
        <div style="margin-top: 14px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 12px;">
          <span style="font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Movimientos Contables Registrados (${entries.length})</span>
          <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 6px;">
            ${entries.map(e => `
              <div style="background: rgba(0, 0, 0, 0.25); border-radius: 6px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem;">
                <div>
                  <span style="font-weight: 700; color: #e2e8f0;">${escapeHtml(e.serviceName || 'Operación')}</span>
                  <span style="color: #64748b; margin-left: 6px;">${escapeHtml(e.notes || '')}</span>
                </div>
                <div style="display: flex; gap: 12px; font-family: monospace;">
                  <span style="color: #cbd5e1;">Cobro: <strong>$${parseFloat(e.chargedAmount).toFixed(2)}</strong></span>
                  <span style="color: #f87171;">Costo: <strong>$${parseFloat(e.costAmount).toFixed(2)}</strong></span>
                  <span style="color: #34d399; font-weight: 800;">Ganancia: <strong>+$${parseFloat(e.netProfit).toFixed(2)}</strong></span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    resultContainer.innerHTML = `
      <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.8)); border: 1px solid rgba(14, 165, 233, 0.4); border-radius: 14px; padding: 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); position: relative;">
        <button type="button" onclick="document.getElementById('financeOrderLookupResult').classList.add('hidden')" style="position: absolute; top: 14px; right: 14px; background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px;" title="Cerrar">
          <i data-lucide="x" style="width: 18px; height: 18px;"></i>
        </button>

        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
          <span style="background: rgba(14, 165, 233, 0.2); color: #38bdf8; font-weight: 800; font-family: monospace; font-size: 0.85rem; padding: 3px 10px; border-radius: 6px;">
            ORDEN #${escapeHtml(cleanId)}
          </span>
          <span style="font-size: 0.88rem; font-weight: 700; color: #f1f5f9;">
            ${escapeHtml(o.serviceName || 'Servicio')}
          </span>
          <span style="font-size: 0.75rem; background: rgba(168, 85, 247, 0.2); color: #c084fc; padding: 2px 8px; border-radius: 6px; font-weight: 700;">
            Cuenta: ${escapeHtml(accountName)}
          </span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px;">
          <div style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 10px;">
            <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase;">Monto Cobrado</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: #f8fafc; font-family: monospace;">$${charged.toFixed(2)}</div>
            <div style="font-size: 0.65rem; color: #64748b;">Ingreso total</div>
          </div>
          <div style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 10px;">
            <div style="font-size: 0.7rem; color: #f87171; text-transform: uppercase;">Costo Servidor</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: #fca5a5; font-family: monospace;">-$${cost.toFixed(2)}</div>
            <div style="font-size: 0.65rem; color: #64748b;">Proveedor API</div>
          </div>
          <div style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 10px;">
            <div style="font-size: 0.7rem; color: #60a5fa; text-transform: uppercase;">Ganancia Bruta</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: #93c5fd; font-family: monospace;">+$${gross.toFixed(2)}</div>
            <div style="font-size: 0.65rem; color: #64748b;">Margen total</div>
          </div>
          <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 8px; padding: 10px;">
            <div style="font-size: 0.7rem; color: #34d399; text-transform: uppercase; font-weight: 700;">Ganancia Neta (Bolsillo)</div>
            <div style="font-size: 1.35rem; font-weight: 900; color: #10b981; font-family: monospace;">+$${net.toFixed(2)}</div>
            <div style="font-size: 0.65rem; color: #a7f3d0;">Reinversión: $${reinvest.toFixed(2)}</div>
          </div>
        </div>

        ${entriesHtml}
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    resultContainer.innerHTML = `
      <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 14px; color: #f87171;">
        Error al consultar la orden: ${escapeHtml(err.message)}
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}

/**
 * Cargar y renderizar la lista completa de tarjetas y cuentas en el gestor
 */
async function loadAccountsManagerList() {
  const container = document.getElementById('accountsManagerCardsGrid');
  if (!container) return;
  container.innerHTML = '<div style="color: #94a3b8; font-size: 0.85rem; padding: 10px;">Cargando cuentas...</div>';

  try {
    const res = await fetch('/api/admin/finance/accounts', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Server-Id': currentServerId
      }
    });
    const d = await res.json();
    if (!res.ok || !d.success) throw new Error(d.error || 'Error al obtener cuentas');

    const accs = d.accounts || [];
    if (accs.length === 0) {
      container.innerHTML = '<div style="color: #64748b; font-size: 0.85rem;">No tienes cuentas agregadas aún. Registra la primera arriba.</div>';
      return;
    }

    container.innerHTML = accs.map(acc => {
      const balance = parseFloat(acc.balance || 0);
      const color = acc.color || '#8b5cf6';
      const icon = acc.icon || 'wallet';
      return `
        <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid ${color}44; border-left: 4px solid ${color}; border-radius: 10px; padding: 14px; position: relative;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <div>
              <span style="font-weight: 800; font-size: 0.95rem; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
                <i data-lucide="${icon}" style="width: 16px; height: 16px; color: ${color};"></i> ${escapeHtml(acc.name)}
              </span>
              <span style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase;">${escapeHtml(acc.type || 'cuenta')}</span>
            </div>
            <div style="display: flex; gap: 4px;">
              <button type="button" onclick="editFinanceAccount('${acc.id}', '${escapeHtml(acc.name)}', '${acc.type}', ${balance}, '${color}')" title="Editar" style="background: none; border: none; color: #38bdf8; cursor: pointer; padding: 3px;">
                <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
              </button>
              <button type="button" onclick="deleteFinanceAccount('${acc.id}', '${escapeHtml(acc.name)}')" title="Eliminar" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 3px;">
                <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
              </button>
            </div>
          </div>
          <div style="font-size: 1.25rem; font-weight: 800; color: #ffffff; font-family: 'Fira Code', monospace; margin-top: 6px;">
            $${balance.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    container.innerHTML = `<div style="color: #ef4444; font-size: 0.85rem;">Error: ${escapeHtml(err.message)}</div>`;
  }
}

function editFinanceAccount(id, name, type, balance, color) {
  document.getElementById('accountFormId').value = id;
  document.getElementById('accountFormName').value = name;
  document.getElementById('accountFormType').value = type;
  document.getElementById('accountFormBalance').value = balance;
  document.getElementById('accountFormColor').value = color;
  const btnCancel = document.getElementById('btnCancelEditAccount');
  if (btnCancel) btnCancel.style.display = 'inline-block';
  document.getElementById('accountFormName').focus();
}

async function deleteFinanceAccount(id, name) {
  if (!confirm(`¿Eliminar la cuenta "${name}"? Los movimientos pasados seguirán en el historial contable.`)) return;
  try {
    const res = await fetch(`/api/admin/finance/accounts/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Server-Id': currentServerId
      }
    });
    if (res.ok) {
      loadAccountsManagerList();
      loadFinanceDashboard();
    } else {
      alert('Error al eliminar cuenta');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

/**
 * Cargar y calcular el resumen de la semana actual y cierres anteriores
 */
async function loadWeeklyAuditView() {
  const statsContainer = document.getElementById('weeklyAuditSummaryStats');
  const historyContainer = document.getElementById('weeklyAuditHistoryList');
  if (statsContainer) statsContainer.innerHTML = '<div style="color: #cbd5e1; font-size: 0.82rem;">Calculando flujo de los últimos 7 días...</div>';

  try {
    const res = await fetch('/api/admin/finance', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Server-Id': currentServerId
      }
    });
    const d = await res.json();
    if (!res.ok || !d.success) throw new Error('Error al consultar datos');

    const summary = d.summary || {};
    const weekAudits = d.weeklyAudits || [];

    // Calcular estadísticas aproximadas de los últimos 7 días
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    const weekEntries = (d.recent || []).filter(r => {
      const t = r.createdAt ? new Date(r.createdAt).getTime() : 0;
      return t >= sevenDaysAgo;
    });

    let weekIncome = 0;
    let weekExpenses = 0;
    weekEntries.forEach(r => {
      weekIncome += parseFloat(r.chargedAmount || 0);
      weekExpenses += parseFloat(r.costAmount || 0);
    });
    const weekNet = weekIncome - weekExpenses;

    if (statsContainer) {
      statsContainer.innerHTML = `
        <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 12px;">
          <div style="font-size: 0.7rem; color: #34d399; text-transform: uppercase; font-weight: 700;">Ingresos Semanales</div>
          <div style="font-size: 1.25rem; font-weight: 800; color: #f8fafc; font-family: monospace;">+$${weekIncome.toFixed(2)}</div>
          <div style="font-size: 0.65rem; color: #94a3b8;">Últimos 7 días</div>
        </div>
        <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 12px;">
          <div style="font-size: 0.7rem; color: #f87171; text-transform: uppercase; font-weight: 700;">Gastos Totales Semanales</div>
          <div style="font-size: 1.25rem; font-weight: 800; color: #fca5a5; font-family: monospace;">-$${weekExpenses.toFixed(2)}</div>
          <div style="font-size: 0.65rem; color: #94a3b8;">Personales + Servidores</div>
        </div>
        <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 12px;">
          <div style="font-size: 0.7rem; color: #fbbf24; text-transform: uppercase; font-weight: 700;">Balance Neto Semanal</div>
          <div style="font-size: 1.25rem; font-weight: 800; color: ${weekNet >= 0 ? '#34d399' : '#ef4444'}; font-family: monospace;">${weekNet >= 0 ? '+' : ''}$${weekNet.toFixed(2)}</div>
          <div style="font-size: 0.65rem; color: #94a3b8;">Ahorro neto generado</div>
        </div>
      `;
    }

    if (historyContainer) {
      if (weekAudits.length === 0) {
        historyContainer.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; text-align: center; padding: 10px;">Aún no hay cortes semanales archivados. Realiza tu primer cierre con el botón superior.</div>';
      } else {
        historyContainer.innerHTML = weekAudits.map(a => {
          let dateStr = a.auditDate || a.createdAt || 'Fecha';
          try {
            dateStr = new Date(dateStr).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
          } catch(e) {}
          return `
            <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 8px 12px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem;">
              <div>
                <span style="font-weight: 700; color: #f1f5f9;"><i data-lucide="check" style="width: 14px; height: 14px; color: #34d399; display: inline-block; vertical-align: middle;"></i> Cierre del ${escapeHtml(dateStr)}</span>
                <span style="color: #94a3b8; margin-left: 8px;">${escapeHtml(a.notes || 'Conciliación correcta')}</span>
              </div>
              <div style="font-family: monospace; font-weight: 800; color: #fbbf24;">
                Patrimonio Total: $${parseFloat(a.totalAssets || 0).toFixed(2)}
              </div>
            </div>
          `;
        }).join('');
      }
    }

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    if (statsContainer) statsContainer.innerHTML = `<div style="color: #ef4444;">Error al cargar datos semanales: ${escapeHtml(err.message)}</div>`;
  }
}

