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
  if (type === 'SPEI') return '<span style="color:#10b981;">SPEI / Banco</span>';
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

function renderRecharges() {
  if (!rechargesBody) return;
  const authRole = localStorage.getItem('dhru_role');
  rechargesBody.innerHTML = '';
  rechargesCount.textContent = rechargesHistory.length;
  
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
      <td>${formatType(item.type)}${item.trackingNumber ? `<br><small style="color:var(--text-muted);font-size:0.75rem;">Rastreo: ${escapeHtml(item.trackingNumber)}</small>` : ''}</td>
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
