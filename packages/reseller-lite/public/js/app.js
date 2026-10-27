let currentServer = '1';
let catalogData = [];
let modulesState = {};

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initServerTabs();
  loadBalances();
  loadCatalog(currentServer);
  loadModules();
  initModals();
  initForms();
});

// Navegación Sidebar
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      const tab = item.dataset.tab;
      document.getElementById(`tab-${tab}`).classList.add('active');

      if (tab === 'orders') loadOrders();
      if (tab === 'modules') loadModules();
    });
  });
}

// Selector de Servidor (S1 / S3)
function initServerTabs() {
  const btns = document.querySelectorAll('.server-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentServer = btn.dataset.server;
      loadCatalog(currentServer);
    });
  });

  const searchInput = document.getElementById('serviceSearch');
  searchInput.addEventListener('input', (e) => {
    renderCatalog(e.target.value);
  });
}

// Cargar Saldo
async function loadBalances() {
  try {
    const res = await fetch('/api/bridge/balance');
    const data = await res.json();
    if (data.success) {
      if (data.server1) document.getElementById('s1Balance').textContent = `$${data.server1.CREDIT} MXN`;
      if (data.server3) document.getElementById('s3Balance').textContent = `$${data.server3.CREDIT} MXN`;
    }
  } catch (e) {
    console.error('Error cargando balance:', e);
  }
}

// Cargar Catálogo
async function loadCatalog(server) {
  const container = document.getElementById('catalogList');
  container.innerHTML = '<div class="loading-state">Cargando catálogo en tiempo real...</div>';

  try {
    const res = await fetch(`/api/bridge/catalog?serverId=${server}`);
    const data = await res.json();

    if (Array.isArray(data)) {
      catalogData = data;
      renderCatalog();
    } else {
      container.innerHTML = `<div class="loading-state">Configura tu API Key en la pestaña de ajustes para ver los servicios.</div>`;
    }
  } catch (e) {
    container.innerHTML = `<div class="loading-state">Error al conectar con la API de MegaUnlockPhone.</div>`;
  }
}

function renderCatalog(filter = '') {
  const container = document.getElementById('catalogList');
  container.innerHTML = '';

  let totalServices = 0;
  const cleanFilter = filter.toLowerCase().trim();

  catalogData.forEach(group => {
    const services = (group.SERVICES || []).filter(s => 
      s.SERVICE_NAME?.toLowerCase().includes(cleanFilter) || group.GROUP_NAME?.toLowerCase().includes(cleanFilter)
    );

    services.forEach(srv => {
      totalServices++;
      const card = document.createElement('div');
      card.className = 'service-card';
      card.innerHTML = `
        <div>
          <span style="font-size:0.75rem; color:var(--text-muted);">${group.GROUP_NAME || 'General'}</span>
          <h4 class="service-title">${srv.SERVICE_NAME}</h4>
        </div>
        <div class="service-meta">
          <span class="service-price">$${srv.PRICE} MXN</span>
          <button class="btn-primary" onclick="openOrderModal('${srv.SERVICE_ID}', '${encodeURIComponent(srv.SERVICE_NAME)}', '${srv.PRICE}')">Ordenar</button>
        </div>
      `;
      container.appendChild(card);
    });
  });

  if (totalServices === 0) {
    container.innerHTML = '<div class="loading-state">No se encontraron servicios disponibles.</div>';
  }
}

// Cargar y Gestionar Módulos Gráficos
async function loadModules() {
  try {
    const res = await fetch('/api/modules');
    const data = await res.json();
    if (data.success) {
      modulesState = data.modules;
      renderModules();
    }
  } catch (e) {
    console.error('Error al cargar módulos:', e);
  }
}

function renderModules() {
  const container = document.getElementById('modulesContainer');
  container.innerHTML = '';

  Object.values(modulesState).forEach(mod => {
    const card = document.createElement('div');
    card.className = `module-card ${mod.enabled ? 'active' : ''}`;
    card.innerHTML = `
      <div class="module-header">
        <div>
          <h3>${mod.title}</h3>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-top:4px;">${mod.description}</p>
        </div>
        ${!mod.locked ? `
          <label class="switch">
            <input type="checkbox" ${mod.enabled ? 'checked' : ''} onchange="toggleModuleState('${mod.id}', this.checked)">
            <span class="slider"></span>
          </label>
        ` : `<span style="font-size:0.75rem; color:var(--accent-emerald); font-weight:700;">NÚCLEO API</span>`}
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-color); padding-top:14px;">
        <span style="font-size:0.8rem; color:${mod.enabled ? 'var(--accent-emerald)' : 'var(--text-muted)'}; font-weight:600;">
          ${mod.enabled ? '● Módulo Activo' : '○ Apagado'}
        </span>
        <button class="btn-outline" onclick="openModuleConfigModal('${mod.id}')">⚙️ Asistente de Ajustes</button>
      </div>
    `;
    container.appendChild(card);
  });
}

async function toggleModuleState(moduleId, isChecked) {
  try {
    const res = await fetch(`/api/modules/${moduleId}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: isChecked })
    });
    const data = await res.json();
    if (data.success) {
      loadModules();
    }
  } catch (e) {
    alert('Error al cambiar estado del módulo');
  }
}

function openModuleConfigModal(moduleId) {
  const mod = modulesState[moduleId];
  if (!mod) return;

  const modal = document.getElementById('moduleModal');
  document.getElementById('modModalTitle').textContent = `Configuración: ${mod.title}`;
  const body = document.getElementById('modModalBody');

  if (moduleId === 'whatsappBot') {
    body.innerHTML = `
      <form id="botConfigForm">
        <div class="form-group">
          <label>Nombre del Bot</label>
          <input type="text" id="cfgBotName" value="${mod.config?.botName || ''}" required>
        </div>
        <div class="form-group">
          <label>Teléfono Administrador WhatsApp (con código de país ej. 52221xxxxxxx)</label>
          <input type="text" id="cfgAdminPhone" value="${mod.config?.adminPhone || ''}" required>
        </div>
        <div class="form-group">
          <label>Mensaje de Bienvenida Automático</label>
          <textarea id="cfgWelcomeMsg" rows="3">${mod.config?.welcomeMessage || ''}</textarea>
        </div>
        <button type="submit" class="btn-primary w-full">Guardar Ajustes del Bot</button>
      </form>
    `;
    document.getElementById('botConfigForm').onsubmit = (e) => {
      e.preventDefault();
      saveModuleConfig(moduleId, {
        botName: document.getElementById('cfgBotName').value,
        adminPhone: document.getElementById('cfgAdminPhone').value,
        welcomeMessage: document.getElementById('cfgWelcomeMsg').value
      });
    };
  } else if (moduleId === 'finanzas') {
    body.innerHTML = `
      <form id="finConfigForm">
        <div class="form-group">
          <label>Moneda de Operación</label>
          <input type="text" id="cfgCurrency" value="${mod.config?.currency || 'MXN'}" required>
        </div>
        <div class="form-group">
          <label>Método de Pago por Defecto</label>
          <input type="text" id="cfgPayMethod" value="${mod.config?.defaultPaymentMethod || 'Transferencia'}" required>
        </div>
        <button type="submit" class="btn-primary w-full">Guardar Ajustes de Finanzas</button>
      </form>
    `;
    document.getElementById('finConfigForm').onsubmit = (e) => {
      e.preventDefault();
      saveModuleConfig(moduleId, {
        currency: document.getElementById('cfgCurrency').value,
        defaultPaymentMethod: document.getElementById('cfgPayMethod').value
      });
    };
  } else {
    body.innerHTML = `<p style="color:var(--text-muted);">Este módulo se autogestiona con los parámetros del servidor maestro.</p>`;
  }

  modal.classList.add('active');
}

async function saveModuleConfig(moduleId, config) {
  try {
    const res = await fetch(`/api/modules/${moduleId}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('moduleModal').classList.remove('active');
      loadModules();
      alert('Configuración guardada exitosamente.');
    }
  } catch (e) {
    alert('Error al guardar configuración');
  }
}

// Modal de Orden
function openOrderModal(serviceId, name, price) {
  document.getElementById('orderServiceId').value = serviceId;
  document.getElementById('orderServerId').value = currentServer;
  document.getElementById('modalServiceTitle').textContent = decodeURIComponent(name);
  document.getElementById('modalServicePrice').textContent = `$${price} MXN`;
  document.getElementById('orderModal').classList.add('active');
}

function initModals() {
  document.getElementById('modalClose').onclick = () => {
    document.getElementById('orderModal').classList.remove('active');
  };
  document.getElementById('modModalClose').onclick = () => {
    document.getElementById('moduleModal').classList.remove('active');
  };
}

function initForms() {
  // Envío de Orden
  document.getElementById('orderForm').onsubmit = async (e) => {
    e.preventDefault();
    const serviceId = document.getElementById('orderServiceId').value;
    const serverId = document.getElementById('orderServerId').value;
    const inputParam = document.getElementById('orderInputParam').value;

    try {
      const res = await fetch('/api/bridge/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceid: serviceId,
          serverId: serverId,
          imei: inputParam
        })
      });
      const data = await res.json();
      if (data.SUCCESS || data.success) {
        alert('¡Orden enviada exitosamente a la API de MegaUnlockPhone!');
        document.getElementById('orderModal').classList.remove('active');
        document.getElementById('orderInputParam').value = '';
        loadBalances();
      } else {
        alert('Error: ' + (data.ERROR?.[0]?.MESSAGE || 'No se pudo procesar'));
      }
    } catch (err) {
      alert('Error de conexión');
    }
  };

  // Guardar API Key
  document.getElementById('apiSetupForm').onsubmit = async (e) => {
    e.preventDefault();
    const apiKey = document.getElementById('inputApiKey').value;
    const username = document.getElementById('inputUsername').value;
    const margin = document.getElementById('inputMargin').value;

    try {
      const res = await fetch('/api/modules/apiConnection/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          username,
          profitMargin: margin
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('¡Conexión guardada exitosamente! Conectado a MegaUnlockPhone.');
        loadBalances();
        loadCatalog(currentServer);
      }
    } catch (e) {
      alert('Error al guardar datos de API');
    }
  };
}

// Cargar Pedidos
async function loadOrders() {
  const tbody = document.getElementById('ordersTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando órdenes...</td></tr>';

  try {
    const res = await fetch(`/api/bridge/history?serverId=${currentServer}`);
    const data = await res.json();
    if (data.SUCCESS && Array.isArray(data.ORDERS) && data.ORDERS.length > 0) {
      tbody.innerHTML = '';
      data.ORDERS.forEach(ord => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>#${ord.orderId}</td>
          <td>${ord.serviceName}</td>
          <td><code>${ord.imei || '-'}</code></td>
          <td>$${ord.cost} MXN</td>
          <td><span class="badge-${ord.status?.toLowerCase()}">${ord.status}</span></td>
          <td>${new Date(ord.date || ord.updateTimestamp).toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
      });
    } else {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay órdenes registradas aún.</td></tr>';
    }
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Error al cargar historial.</td></tr>';
  }
}
