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

function formatType(type) {
  if (type === 'SPEI' || type === 'SPEI / Banxico') return '<span style="color:#10b981;">SPEI / Banco</span>';
  if (type === 'MANUAL_ADMIN') return '<span style="color:#8b5cf6;">Manual (Admin)</span>';
  if (type === 'MANUAL_BOT') return '<span style="color:#3b82f6;">Bot WhatsApp</span>';
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

  // 1. Total Ingresado (Suma de recargas exitosas de este usuario/servidor)
  let totalDeposited = 0;
  if (Array.isArray(rechargesHistory)) {
    totalDeposited = rechargesHistory.reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0);
  }

  // 2. Total Gastado (Suma de costo de órdenes en historial no rechazadas y que no sean garantías $0)
  let totalSpent = 0;
  if (typeof orderHistory !== 'undefined' && Array.isArray(orderHistory)) {
    totalSpent = orderHistory.reduce((acc, o) => {
      // Excluir órdenes rechazadas y órdenes marcadas como reembolso o garantía
      if (o.status === 'failed' || o.isRefunded || o.isImported) return acc;
      const c = parseFloat(o.costCharged !== undefined ? o.costCharged : (o.costInCredits || o.price || 0)) || 0;
      return acc + c;
    }, 0);
  }

  // 3. Saldo Disponible (Crédito actual en billetera)
  let currentAvailable = 0;
  if (typeof globalApiCreditRaw !== 'undefined' && !isNaN(globalApiCreditRaw)) {
    currentAvailable = globalApiCreditRaw;
  } else {
    // Si no está cargado globalApiCreditRaw, calcular por diferencia lógica o leer del badge
    const badgeText = document.getElementById('creditsBalanceText')?.textContent || '';
    const match = badgeText.match(/\$?([0-9]+(?:\.[0-9]+)?)/);
    if (match) {
      currentAvailable = parseFloat(match[1]) || 0;
    } else {
      currentAvailable = Math.max(0, totalDeposited - totalSpent);
    }
  }

  statDeposited.textContent = `$${totalDeposited.toFixed(2)} MXN`;
  statSpent.textContent = `$${totalSpent.toFixed(2)} MXN`;
  statAvailable.textContent = `$${currentAvailable.toFixed(2)} MXN`;

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
    
    tr.innerHTML = `
      <td>${new Date(item.date).toLocaleString()}</td>
      ${authRole === 'admin' ? `<td style="color:#a78bfa; font-weight:bold;">${escapeHtml(item.username)}</td>` : ''}
      <td style="color:#10b981; font-weight:bold;">$${parseFloat(item.amount).toFixed(2)} MXN</td>
      <td>${formatType(item.type || item.method)}${item.trackingNumber ? `<br><small style="color:var(--text-muted);font-size:0.75rem;">Rastreo: ${escapeHtml(item.trackingNumber)}</small>` : ''}${item.senderBankName && item.receiverBankName ? `<br><small style="color:var(--text-muted);font-size:0.70rem; white-space:nowrap;">${escapeHtml(item.senderBankName)} ➔ ${escapeHtml(item.receiverBankName)}</small>` : ''}</td>
      <td>${escapeHtml(item.adminUsername || 'Sistema')}</td>
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
