// Portal Autónomo de Finanzas y Tesorería
(function() {
  const token = localStorage.getItem('dhru_token') || localStorage.getItem('mega_auth_token');
  const serverId = localStorage.getItem('currentServerId') || '1';

  // Si no está autenticado como administrador, redirigir al login principal
  if (!token) {
    alert('Acceso restringido. Por favor inicia sesión como Administrador en el panel principal.');
    window.location.href = '/#login';
    return;
  }

  function formatMoney(num) {
    const val = parseFloat(num) || 0;
    return '$' + val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function fetchWithAuth(url, options = {}) {
    options.headers = {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`,
      'X-Server-Id': serverId
    };
    const res = await fetch(url, options);
    return res;
  }

  async function loadAllFinanceData() {
    try {
      // 1. Dashboard general de finanzas
      const resDash = await fetchWithAuth('/api/admin/finance/dashboard');
      if (resDash.status === 401 || resDash.status === 403) {
        alert('Sesión no autorizada o expirada.');
        window.location.href = '/#login';
        return;
      }
      const dataDash = await resDash.json();
      if (dataDash.success) {
        renderGlobalMetrics(dataDash);
        renderAccounts(dataDash.accounts || []);
        renderLedger(dataDash.recent || []);
      }

      // 2. Resumen y lista de meses (installments)
      await loadInstallments();

      // 3. Deudas
      await loadDebts();

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error('Error cargando finanzas:', err);
    }
  }

  function renderGlobalMetrics(dash) {
    const statNetWorth = document.getElementById('statFinNetWorth');
    if (statNetWorth) statNetWorth.textContent = formatMoney(dash.totalBalance || 0);

    const statGrossProfit = document.getElementById('statFinGrossProfit');
    if (statGrossProfit) statGrossProfit.textContent = formatMoney(dash.totalGrossProfit || 0);
  }

  function renderAccounts(accounts) {
    const grid = document.getElementById('finAccountsGrid');
    if (!grid) return;

    if (!accounts.length) {
      grid.innerHTML = '<div style="color:var(--text-muted); padding:1rem;">No hay cuentas configuradas.</div>';
      return;
    }

    grid.innerHTML = accounts.map(acc => {
      const balance = parseFloat(acc.balance) || 0;
      const profit = parseFloat(acc.totalProfit !== undefined ? acc.totalProfit : (acc.netProfit || 0));
      return `
        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 1.25rem; box-shadow: 0 2px 10px rgba(0,0,0,0.02); display:flex; flex-direction:column; justify-content:space-between;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem;">
            <div>
              <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">${escapeHtml(acc.type || 'Cuenta')}</span>
              <h3 style="margin:2px 0 0; font-size:1.15rem; font-weight:700; color:var(--text);">${escapeHtml(acc.name)}</h3>
            </div>
            <span style="background:rgba(16, 185, 129, 0.12); color:#10b981; padding:3px 8px; border-radius:8px; font-size:0.75rem; font-weight:700;">Activa</span>
          </div>
          <div style="margin-bottom:0.75rem;">
            <div style="font-size:1.6rem; font-weight:800; color:var(--text); font-family:'Outfit',sans-serif;">${formatMoney(balance)}</div>
            <small style="color:var(--text-muted); font-size:0.75rem;">Saldo disponible</small>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed var(--border); padding-top:0.6rem; font-size:0.8rem;">
            <span style="color:var(--text-muted);">Margen Recaudado:</span>
            <strong style="color:${profit >= 0 ? '#10b981' : '#ef4444'};">${formatMoney(profit)}</strong>
          </div>
        </div>
      `;
    }).join('');
  }

  async function loadInstallments() {
    const listCont = document.getElementById('finInstallmentsContainerList');
    if (!listCont) return;

    try {
      const res = await fetchWithAuth('/api/admin/finance/installments');
      const d = await res.json();
      if (!res.ok || !d.success) return;

      const items = d.installments || [];
      const active = items.filter(i => i.status === 'active');
      
      let totalPending = 0;
      let nextQuotaTotal = 0;

      active.forEach(i => {
        const remainingQuotas = Math.max(0, (i.totalQuotas || 0) - (i.paidQuotas || 0));
        const quota = parseFloat(i.quotaAmount) || ((parseFloat(i.totalAmount) || 0) / (i.totalQuotas || 1));
        totalPending += quota * remainingQuotas;
        nextQuotaTotal += quota;
      });

      const statPending = document.getElementById('statFinInstallmentsPending');
      if (statPending) statPending.textContent = formatMoney(totalPending);

      const statNext = document.getElementById('statFinInstallmentsNextQuota');
      if (statNext) statNext.textContent = `Próxima mensualidad: ${formatMoney(nextQuotaTotal)} / mes`;

      if (!items.length) {
        listCont.innerHTML = `
          <div style="text-align:center; padding: 2rem; color: var(--text-muted);">
            <i data-lucide="credit-card" style="width:32px; height:32px; margin:0 auto 0.5rem; opacity:0.5;"></i>
            <p style="margin:0; font-size:0.9rem;">No hay mensualidades registradas.</p>
          </div>
        `;
        return;
      }

      listCont.innerHTML = items.map(inst => {
        const isCompleted = inst.status === 'completed' || inst.paidQuotas >= inst.totalQuotas;
        const progressPct = Math.min(100, Math.round(((inst.paidQuotas || 0) / (inst.totalQuotas || 1)) * 100));
        const quotaVal = parseFloat(inst.quotaAmount) || ((parseFloat(inst.totalAmount) || 0) / (inst.totalQuotas || 1));
        const remainingQuotas = Math.max(0, (inst.totalQuotas || 0) - (inst.paidQuotas || 0));
        const remainingAmount = quotaVal * remainingQuotas;

        return `
          <div style="background: var(--bg); border: 1px solid ${isCompleted ? 'var(--border)' : 'rgba(130, 24, 252, 0.25)'}; border-radius: 12px; padding: 1rem; margin-bottom: 0.75rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.4rem;">
              <div>
                <span style="font-size:0.7rem; font-weight:700; text-transform:uppercase; padding:2px 6px; border-radius:4px; background: rgba(130, 24, 252, 0.12); color: #8218fc;">
                  ${escapeHtml(inst.accountName || 'Tarjeta')}
                </span>
                <div style="font-size:0.95rem; font-weight:700; color:var(--text); margin-top:2px;">${escapeHtml(inst.title)}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:1.05rem; font-weight:800; color:var(--text);">${formatMoney(inst.totalAmount)}</div>
                <small style="color:${isCompleted ? '#10b981' : '#f59e0b'}; font-weight:700;">${inst.paidQuotas}/${inst.totalQuotas} meses</small>
              </div>
            </div>

            <div style="background: var(--bg-card); border-radius: 999px; height: 6px; overflow: hidden; margin: 0.5rem 0; border: 1px solid var(--border);">
              <div style="width: ${progressPct}%; height: 100%; background: linear-gradient(90deg, #8218fc, #6366f1);"></div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:var(--text-muted); flex-wrap:wrap; gap:0.5rem;">
              <div>
                Cuota: <strong style="color:var(--text);">${formatMoney(quotaVal)}</strong>
                ${inst.dueDay ? ` • Pagar día <strong style="color:var(--text);">${inst.dueDay}</strong>` : ''}
                <div style="font-size:0.75rem; color:#ef4444;">Restante: ${formatMoney(remainingAmount)}</div>
              </div>
              <div style="display:flex; gap:0.4rem;">
                ${!isCompleted ? `
                  <button onclick="window.finPayQuota('${inst.id}', '${escapeHtml(inst.title)}', ${quotaVal}, ${inst.paidQuotas + 1})" class="btn-fin-pill" style="background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 4px 8px; font-size:0.75rem;">
                    ✓ Abonar
                  </button>
                ` : ''}
                <button onclick="window.finDeleteInstallment('${inst.id}')" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.9rem;">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Error cargando meses:', err);
    }
  }

  async function loadDebts() {
    const listCont = document.getElementById('finDebtsContainerList');
    if (!listCont) return;

    try {
      const res = await fetchWithAuth('/api/admin/finance/debts');
      const d = await res.json();
      if (!res.ok || !d.success) return;

      const items = d.debts || [];
      const pending = items.filter(x => x.status === 'pending');

      const totalReceivable = pending.filter(x => x.type === 'receivable').reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
      const totalPayable = pending.filter(x => x.type === 'payable').reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);

      const statRec = document.getElementById('statFinDebtsReceivable');
      if (statRec) statRec.textContent = formatMoney(totalReceivable);

      const statPay = document.getElementById('statFinDebtsPayable');
      if (statPay) statPay.textContent = `Por pagar: ${formatMoney(totalPayable)}`;

      if (!items.length) {
        listCont.innerHTML = `
          <div style="text-align:center; padding: 2rem; color: var(--text-muted);">
            <i data-lucide="hand-coins" style="width:32px; height:32px; margin:0 auto 0.5rem; opacity:0.5;"></i>
            <p style="margin:0; font-size:0.9rem;">No hay deudas registradas.</p>
          </div>
        `;
        return;
      }

      listCont.innerHTML = items.map(debt => {
        const isRec = debt.type === 'receivable';
        const isSettled = debt.status === 'settled';
        return `
          <div style="background: var(--bg); border: 1px solid ${isSettled ? 'var(--border)' : (isRec ? 'rgba(59, 130, 246, 0.25)' : 'rgba(239, 68, 68, 0.25)')}; border-radius: 12px; padding: 1rem; margin-bottom: 0.75rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <span style="font-size:0.7rem; font-weight:700; text-transform:uppercase; padding:2px 6px; border-radius:4px; background: ${isRec ? 'rgba(59, 130, 246, 0.12)' : 'rgba(239, 68, 68, 0.12)'}; color: ${isRec ? '#3b82f6' : '#ef4444'};">
                  ${isRec ? 'Por Cobrar' : 'Por Pagar'}
                </span>
                <div style="font-size:0.95rem; font-weight:700; color:var(--text); margin-top:2px;">${escapeHtml(debt.personName)}</div>
                <small style="color:var(--text-muted); font-size:0.75rem;">${escapeHtml(debt.notes || 'Sin nota')}</small>
              </div>
              <div style="text-align:right;">
                <div style="font-size:1.05rem; font-weight:800; color:${isRec ? '#3b82f6' : '#ef4444'};">${formatMoney(debt.amount)}</div>
                <small style="color:${isSettled ? '#10b981' : '#f59e0b'}; font-weight:700;">${isSettled ? 'Saldada' : 'Pendiente'}</small>
              </div>
            </div>
            ${!isSettled ? `
              <div style="display:flex; justify-content:flex-end; gap:0.4rem; margin-top:0.5rem;">
                <button onclick="window.finSettleDebt('${debt.id}', '${escapeHtml(debt.personName)}', ${debt.amount})" class="btn-fin-pill" style="background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 4px 8px; font-size:0.75rem;">
                  ✓ Saldar
                </button>
                <button onclick="window.finDeleteDebt('${debt.id}')" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.9rem;">
                  🗑️
                </button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Error cargando deudas:', err);
    }
  }

  function renderLedger(items) {
    const tbody = document.getElementById('finLedgerTbody');
    if (!tbody) return;

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">Sin movimientos contables recientes.</td></tr>';
      return;
    }

    tbody.innerHTML = items.slice(0, 30).map(tx => {
      const charged = parseFloat(tx.chargedAmount) || 0;
      const cost = parseFloat(tx.costAmount) || 0;
      const profit = parseFloat(tx.grossProfit) || (charged - cost);
      const dateStr = tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('es-MX', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '-';

      return `
        <tr style="border-bottom: 1px solid var(--border);">
          <td style="padding: 10px 12px; color:var(--text-muted); font-size:0.8rem;">${dateStr}</td>
          <td style="padding: 10px 12px; font-weight:600; color:var(--text);">${escapeHtml(tx.description || tx.orderId || 'Movimiento')}</td>
          <td style="padding: 10px 12px; color:var(--text-muted); font-size:0.8rem;">${escapeHtml(tx.accountId || '-')}</td>
          <td style="padding: 10px 12px; text-align:right; color:#10b981; font-weight:600;">${formatMoney(charged)}</td>
          <td style="padding: 10px 12px; text-align:right; color:#ef4444;">${formatMoney(cost)}</td>
          <td style="padding: 10px 12px; text-align:right; font-weight:700; color:${profit >= 0 ? '#10b981' : '#ef4444'};">${formatMoney(profit)}</td>
        </tr>
      `;
    }).join('');
  }

  // Acciones Rápidas
  window.finPayQuota = async function(id, title, amount, quotaNum) {
    const promptVal = prompt(`Pagar mensualidad #${quotaNum} para "${title}":`, amount.toFixed(2));
    if (!promptVal) return;
    const val = parseFloat(promptVal);
    if (isNaN(val) || val <= 0) return alert('Monto inválido.');

    const res = await fetchWithAuth(`/api/admin/finance/installments/${encodeURIComponent(id)}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: val })
    });
    const d = await res.json();
    if (res.ok && d.success) {
      alert('✅ Mensualidad registrada exitosamente.');
      loadAllFinanceData();
    } else {
      alert(d.error || 'Error al procesar el pago.');
    }
  };

  window.finDeleteInstallment = async function(id) {
    if (!confirm('¿Eliminar este plan a meses?')) return;
    const res = await fetchWithAuth(`/api/admin/finance/installments/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) loadAllFinanceData();
  };

  window.finSettleDebt = async function(id, person, amount) {
    const promptVal = prompt(`Monto a liquidar/abonar para deuda de "${person}":`, amount.toFixed(2));
    if (!promptVal) return;
    const val = parseFloat(promptVal);
    if (isNaN(val) || val <= 0) return alert('Monto inválido.');

    const res = await fetchWithAuth(`/api/admin/finance/debts/${encodeURIComponent(id)}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: val })
    });
    if (res.ok) {
      alert('✅ Abono/Liquidación completada.');
      loadAllFinanceData();
    }
  };

  window.finDeleteDebt = async function(id) {
    if (!confirm('¿Eliminar registro de deuda?')) return;
    const res = await fetchWithAuth(`/api/admin/finance/debts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) loadAllFinanceData();
  };

  // Botón Pasaje / Comida Universidad
  const btnCollege = document.getElementById('btnFinCollegeQuick');
  if (btnCollege) {
    btnCollege.addEventListener('click', async () => {
      const amountStr = prompt('🎒 Ingresar efectivo recibido para pasajes y comida de la universidad:', '300.00');
      if (!amountStr) return;
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) return alert('Monto inválido.');

      const notes = prompt('Nota (ej. Pasaje y comida semana uni):', 'Pasaje y comida universidad') || 'Pasaje y comida universidad';

      const res = await fetchWithAuth('/api/admin/finance/college-allowance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, notes, targetAccount: 'acc_cash' })
      });
      const d = await res.json();
      if (res.ok && d.success) {
        alert(`✅ Registrado con éxito: $${amount.toFixed(2)} en Efectivo.`);
        loadAllFinanceData();
      } else {
        alert(d.error || 'Error al registrar.');
      }
    });
  }

  // Botón Actualizar
  const btnRefresh = document.getElementById('btnFinRefreshAll');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', loadAllFinanceData);
  }

  // Inicializar al cargar
  document.addEventListener('DOMContentLoaded', loadAllFinanceData);
})();
