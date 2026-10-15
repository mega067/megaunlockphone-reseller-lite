// Recharges Logic
const btnRechargesHistory = document.getElementById('btnRechargesHistory');
const rechargesSection = document.getElementById('rechargesSection');
const rechargesBody = document.getElementById('rechargesBody');
const rechargesCount = document.getElementById('rechargesCount');
const btnSyncRecharges = document.getElementById('btnSyncRecharges');

let rechargesHistory = [];

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatType(type, isDeduction) {
  if (type === 'SPEI' || type === 'SPEI / Banxico') return '<span style="color:#10b981; font-weight:600;">⚡ SPEI / Banco</span>';
  if (type === 'MANUAL_ADMIN') {
    return isDeduction 
      ? '<span style="color:#f87171; font-weight:600;">📉 Ajuste Admin (Deducción)</span>'
      : '<span style="color:#8b5cf6; font-weight:600;">👑 Asignado por Admin</span>';
  }
  if (type === 'MANUAL_BOT') {
    return isDeduction
      ? '<span style="color:#f87171; font-weight:600;">🤖 Deducción Bot</span>'
      : '<span style="color:#38bdf8; font-weight:600;">🤖 Asignado por Bot</span>';
  }
  return escapeHtml(type);
}

async function fetchRecharges() {
  try {
    const authRole = localStorage.getItem('dhru_role');
    const authToken = localStorage.getItem('dhru_token');
    const url = authRole === 'admin' ? '/api/admin/recharges' : '/api/recharges';
    const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + authToken }});
    const data = await res.json();
    if (res.ok) {
      rechargesHistory = data;
      renderRecharges();
    }
  } catch (e) {
    console.error('Error fetching recharges', e);
  }
}

function updateRechargesSummary() {
  const statDeposited = document.getElementById('rechargeStatDeposited');
  const statSpent = document.getElementById('rechargeStatSpent');
  const statAvailable = document.getElementById('rechargeStatAvailable');
  if (!statDeposited || !statSpent || !statAvailable) return;

  const statGlobal = document.getElementById('rechargeStatGlobal');
  const statGlobalLabel = document.getElementById('rechargeStatGlobalLabel');
  const cardGlobal = document.getElementById('rechargeCardGlobal');
  const authRole = localStorage.getItem('dhru_role');

  // Si rechargesHistory aún está vacío y hay sesión, disparar fetchRecharges()
  if ((!rechargesHistory || rechargesHistory.length === 0) && localStorage.getItem('dhru_token') && !window._fetchingRechargesAuto) {
    window._fetchingRechargesAuto = true;
    if (typeof fetchRecharges === 'function') {
      fetchRecharges().finally(() => { window._fetchingRechargesAuto = false; });
    }
  }

  // Si orderHistory aún está vacío y hay sesión, disparar fetchOrderHistory()
  if ((typeof orderHistory === 'undefined' || !orderHistory || orderHistory.length === 0) && localStorage.getItem('dhru_token') && !window._fetchingOrdersAuto) {
    window._fetchingOrdersAuto = true;
    if (typeof fetchOrderHistory === 'function') {
      fetchOrderHistory().finally(() => { window._fetchingOrdersAuto = false; });
    }
  }

  // Cálculos de montos globales (recargas netas y todos los pedidos no rechazados)
  let totalDeposited = 0;
  if (Array.isArray(rechargesHistory)) {
    totalDeposited = rechargesHistory.reduce((acc, r) => {
      const val = parseFloat(r.amount) || 0;
      return (r.isDeduction || val < 0) ? acc - Math.abs(val) : acc + Math.abs(val);
    }, 0);
  }

  let totalSpentGlobal = 0;
  if (typeof orderHistory !== 'undefined' && Array.isArray(orderHistory)) {
    totalSpentGlobal = orderHistory.reduce((acc, o) => {
      if (o.status === 'failed' || o.isRefunded || o.isImported) return acc;
      const c = parseFloat(o.costCharged !== undefined ? o.costCharged : (o.costInCredits || o.price || 0)) || 0;
      return acc + c;
    }, 0);
  }

  if (authRole === 'admin') {
    // Para la cuenta del Administrador:
    // 1. Dinero real disponible en la API remota (DHRU)
    const directApiLiquidity = window.adminAccountMetrics?.credit !== undefined 
      ? window.adminAccountMetrics.credit 
      : (typeof globalApiCreditRaw !== 'undefined' ? globalApiCreditRaw : 0);
    const assignedToUsers = window.adminAccountMetrics?.assigned !== undefined ? window.adminAccountMetrics.assigned : 0;
    const availableApiLiquidity = window.adminAccountMetrics?.available !== undefined ? window.adminAccountMetrics.available : directApiLiquidity;

    // Etiquetas específicas de control del Admin:
    // Card 1: Total de dinero agregado / recargado a la plataforma (Ingresado)
    // Card 2: Saldo Real en la API Servidor (Liquidez DHRU)
    // Card 3: Saldo Disponible Libre (API - Asignado a revendedores)
    // Card 4: Dinero Gastado Global en pedidos despachados
    const lblDeposited = statDeposited.previousElementSibling;
    const lblSpent = statSpent.previousElementSibling;
    const lblAvailable = statAvailable.previousElementSibling;

    if (lblDeposited) lblDeposited.textContent = 'Total Ingresado';
    if (lblSpent) lblSpent.textContent = 'API Servidor (Real)';
    if (lblAvailable) lblAvailable.textContent = 'Liquidez Libre';

    statDeposited.textContent = `$${totalDeposited.toFixed(2)} MXN`;
    statSpent.textContent = `$${directApiLiquidity.toFixed(2)} MXN`;
    statAvailable.textContent = `$${availableApiLiquidity.toFixed(2)} MXN`;

    if (cardGlobal && statGlobal) {
      cardGlobal.classList.remove('hidden');
      if (statGlobalLabel) statGlobalLabel.textContent = 'Gastado Global';
      statGlobal.textContent = `$${totalSpentGlobal.toFixed(2)} MXN`;
    }
  } else {
    // Para usuarios Resellers / Clientes:
    const lblDeposited = statDeposited.previousElementSibling;
    const lblSpent = statSpent.previousElementSibling;
    const lblAvailable = statAvailable.previousElementSibling;
    if (lblDeposited) lblDeposited.textContent = 'Total Ingresado';
    if (lblSpent) lblSpent.textContent = 'Total Gastado';
    if (lblAvailable) lblAvailable.textContent = 'Disponible';

    // 3. Saldo Disponible en billetera
    let currentAvailable = 0;
    if (typeof globalApiCreditRaw !== 'undefined' && !isNaN(globalApiCreditRaw)) {
      currentAvailable = globalApiCreditRaw;
    } else {
      const badgeText = document.getElementById('creditsBalanceText')?.textContent || '';
      const match = badgeText.match(/\$?([0-9]+(?:\.[0-9]+)?)/);
      if (match) {
        currentAvailable = parseFloat(match[1]) || 0;
      } else {
        currentAvailable = Math.max(0, totalDeposited - totalSpentGlobal);
      }
    }

    statDeposited.textContent = `$${totalDeposited.toFixed(2)} MXN`;
    statSpent.textContent = `$${totalSpentGlobal.toFixed(2)} MXN`;
    statAvailable.textContent = `$${currentAvailable.toFixed(2)} MXN`;

    if (cardGlobal) {
      cardGlobal.classList.add('hidden');
    }
  }

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

function renderRecharges() {
  if (!rechargesBody) return;
  const authRole = localStorage.getItem('dhru_role');
  rechargesBody.innerHTML = '';
  if (rechargesCount) rechargesCount.textContent = rechargesHistory.length;
  
  // Actualizar tarjetas de métricas (Ingresado, Gastado, Disponible)
  updateRechargesSummary();

  if (authRole === 'admin') {
    document.querySelectorAll('.admin-col-recharge').forEach(e => e.classList.remove('hidden'));
  }

  if (rechargesHistory.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No hay recargas registradas.</td>`;
    rechargesBody.appendChild(tr);
    return;
  }

  rechargesHistory.forEach(item => {
    const tr = document.createElement('tr');
    const displayServer = item.serverId === '3' ? 'OMEGA' : (item.serverId === '2' ? 'ALPHA' : 'MEGA');
    const colorServer = item.serverId === '3' ? '#f59e0b' : (item.serverId === '2' ? '#3b82f6' : '#ec4899');
    const isDed = item.isDeduction || parseFloat(item.amount) < 0;
    const amountVal = Math.abs(parseFloat(item.amount) || 0);
    const amountColor = isDed ? '#f87171' : '#10b981';
    const amountPrefix = isDed ? '-$' : '+$';
    
    tr.innerHTML = `
      <td>${new Date(item.date).toLocaleString()}</td>
      ${authRole === 'admin' ? `<td style="color:#a78bfa; font-weight:bold;">${escapeHtml(item.username)}</td>` : ''}
      <td style="color:${amountColor}; font-weight:bold; white-space:nowrap;">${amountPrefix}${amountVal.toFixed(2)} MXN</td>
      <td>${formatType(item.type || item.method, isDed)}${item.trackingNumber ? `<br><small style="color:var(--text-muted);font-size:0.75rem;">${escapeHtml(item.trackingNumber)}</small>` : ''}${item.senderBankName && item.receiverBankName ? `<br><small style="color:var(--text-muted);font-size:0.70rem; white-space:nowrap;">${escapeHtml(item.senderBankName)} ➔ ${escapeHtml(item.receiverBankName)}</small>` : ''}</td>
      <td>${escapeHtml(item.adminUsername || item.processedBy || 'Sistema')}</td>
      <td><span style="color:${colorServer}; font-weight:bold;">${displayServer}</span></td>
    `;
    rechargesBody.appendChild(tr);
  });
}

if (btnRechargesHistory) {
  btnRechargesHistory.addEventListener('click', () => {
    productsSection.classList.add('hidden');
    historySection.classList.add('hidden');
    if (typeof adminSection !== 'undefined' && adminSection) adminSection.classList.add('hidden');
    rechargesSection.classList.remove('hidden');
    fetchRecharges();
  });
}
if (btnSyncRecharges) {
  btnSyncRecharges.addEventListener('click', () => {
    fetchRecharges();
  });
}
