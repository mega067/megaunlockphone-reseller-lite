// --- WARNING MODAL LOGIC ---
async function loadWarningTemplates() {
  try {
    const res = await fetch('/api/admin/warning-templates', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const templates = await res.json();
    warningTemplateSelect.innerHTML = '<option value="">-- Seleccionar Plantilla --</option>';
    templates.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.title;
      opt.dataset.content = t.content;
      warningTemplateSelect.appendChild(opt);
    });
  } catch (e) {
    console.error('Error loading warning templates', e);
  }
}

async function openWarningModal(serviceId, warningContentText) {
  currentWarningServiceId = serviceId;
  warningContent.value = warningContentText || '';
  await loadWarningTemplates();
  warningModal.classList.remove('hidden');
}

if (btnWarningClose) btnWarningClose.addEventListener('click', () => warningModal.classList.add('hidden'));

if (warningTemplateSelect) {
  warningTemplateSelect.addEventListener('change', () => {
    const selected = warningTemplateSelect.options[warningTemplateSelect.selectedIndex];
    if (selected && selected.value) {
      warningContent.value = selected.dataset.content;
    }
  });
}

if (btnDeleteWarningTemplate) {
  btnDeleteWarningTemplate.addEventListener('click', async () => {
    const templateId = warningTemplateSelect.value;
    if (!templateId) return alert('Selecciona una plantilla primero');
    if (!confirm('¿Seguro que deseas eliminar esta plantilla?')) return;

    try {
      const res = await fetch(`/api/admin/warning-templates/${templateId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        alert('Plantilla eliminada');
        warningContent.value = '';
        await loadWarningTemplates();
      } else {
        alert('Error al eliminar');
      }
    } catch (err) {
      alert('Error de red');
    }
  });
}

if (btnSaveAsWarningTemplate) {
  btnSaveAsWarningTemplate.addEventListener('click', async () => {
    const content = warningContent.value.trim();
    if (!content) return alert('El contenido no puede estar vacío');
    
    const title = prompt('Ingresa un título para identificar esta plantilla:');
    if (!title) return;

    try {
      const res = await fetch('/api/admin/warning-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ title, content })
      });
      if (res.ok) {
        alert('Plantilla guardada');
        await loadWarningTemplates();
      } else {
        alert('Error al guardar plantilla');
      }
    } catch (err) {
      alert('Error de red');
    }
  });
}

if (btnWarningClear) {
  btnWarningClear.addEventListener('click', async () => {
    if (!currentWarningServiceId) return;
    await saveServiceWarning(currentWarningServiceId, '');
  });
}

if (btnWarningSave) {
  btnWarningSave.addEventListener('click', async () => {
    if (!currentWarningServiceId) return;
    const content = warningContent.value.trim();
    await saveServiceWarning(currentWarningServiceId, content);
  });
}

async function saveServiceWarning(serviceId, content) {
  try {
    const res = await fetch('/api/admin/service-warnings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ serviceId, warningHtml: content })
    });
    if (res.ok) {
      alert('Advertencia actualizada en el servicio');
      warningModal.classList.add('hidden');
      syncProducts(true);
    } else {
      alert('Error al actualizar');
    }
  } catch (err) {
    alert('Error de conexión');
  }
}

