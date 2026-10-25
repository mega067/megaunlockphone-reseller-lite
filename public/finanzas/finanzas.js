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
      const s = d.summary || {};

      const statRec = document.getElementById('statFinDebtsReceivable');
      if (statRec) statRec.textContent = formatMoney(s.pendingReceivable || 0);

      const statPay = document.getElementById('statFinDebtsPayable');
      if (statPay) statPay.textContent = `Por pagar: ${formatMoney(s.pendingPayable || 0)}`;

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
        const isPartial = debt.status === 'partial';
        const rem = parseFloat(debt.remainingAmount || debt.totalAmount || 0);
        const tot = parseFloat(debt.totalAmount || 0);

        return `
          <div style="background: var(--bg); border: 1px solid ${isSettled ? 'var(--border)' : (isRec ? 'rgba(59, 130, 246, 0.25)' : 'rgba(239, 68, 68, 0.25)')}; border-radius: 12px; padding: 1rem; margin-bottom: 0.75rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <span style="font-size:0.7rem; font-weight:700; text-transform:uppercase; padding:2px 6px; border-radius:4px; background: ${isRec ? 'rgba(59, 130, 246, 0.12)' : 'rgba(239, 68, 68, 0.12)'}; color: ${isRec ? '#3b82f6' : '#ef4444'};">
                  ${isRec ? 'Me Deben' : 'Yo Debo'}
                </span>
                <div style="font-size:0.95rem; font-weight:700; color:var(--text); margin-top:2px;">${escapeHtml(debt.personName)}</div>
                <small style="color:var(--text-muted); font-size:0.75rem;">${escapeHtml(debt.concept || debt.notes || 'Préstamo/Deuda')}</small>
              </div>
              <div style="text-align:right;">
                <div style="font-size:1.05rem; font-weight:800; color:${isRec ? '#3b82f6' : '#ef4444'};">${formatMoney(rem)}</div>
                <small style="color:${isSettled ? '#10b981' : (isPartial ? '#f59e0b' : 'var(--text-muted)')}; font-weight:700;">
                  ${isSettled ? '✓ Liquidado' : (isPartial ? `Abonado (${formatMoney(debt.paidAmount)})` : `Total: ${formatMoney(tot)}`)}
                </small>
              </div>
            </div>
            ${!isSettled ? `
              <div style="display:flex; justify-content:flex-end; gap:0.4rem; margin-top:0.5rem;">
                <button onclick="window.finSettleDebt('${debt.id}', '${escapeHtml(debt.personName)}', ${rem})" class="btn-fin-pill" style="background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 4px 8px; font-size:0.75rem;">
                  ✓ Abonar / Saldar
                </button>
                <button onclick="window.finDeleteDebt('${debt.id}')" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.9rem;">
                  🗑️
                </button>
              </div>
            ` : `
              <div style="display:flex; justify-content:flex-end; margin-top:0.3rem;">
                <button onclick="window.finDeleteDebt('${debt.id}')" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.8rem;">
                  Eliminar registro 🗑️
                </button>
              </div>
            `}
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
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">Sin movimientos contables recientes.</td></tr>';
      return;
    }

    tbody.innerHTML = items.slice(0, 40).map(tx => {
      const charged = parseFloat(tx.chargedAmount) || 0;
      const cost = parseFloat(tx.costAmount) || 0;
      const profit = parseFloat(tx.grossProfit) || (charged - cost);
      const dateStr = tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('es-MX', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '-';

      return `
        <tr style="border-bottom: 1px solid var(--border);">
          <td style="padding: 10px 12px; color:var(--text-muted); font-size:0.8rem;">${dateStr}</td>
          <td style="padding: 10px 12px; font-weight:600; color:var(--text);">${escapeHtml(tx.description || tx.orderId || 'Movimiento')}</td>
          <td style="padding: 10px 12px; color:var(--text-muted); font-size:0.8rem;">${escapeHtml(tx.account || '-')}</td>
          <td style="padding: 10px 12px; text-align:right; color:#10b981; font-weight:600;">${formatMoney(charged)}</td>
          <td style="padding: 10px 12px; text-align:right; color:#ef4444;">${formatMoney(cost)}</td>
          <td style="padding: 10px 12px; text-align:right; font-weight:700; color:${profit >= 0 ? '#10b981' : '#ef4444'};">${formatMoney(profit)}</td>
          <td style="padding: 10px 8px; text-align:center;">
            <button onclick="window.finDeleteTx('${tx.id}')" title="Eliminar y revertir saldo" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.85rem; padding:2px;">
              🗑️
            </button>
          </td>
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
    const promptVal = prompt(`Monto a liquidar o abonar para deuda de "${person}":`, amount.toFixed(2));
    if (!promptVal) return;
    const val = parseFloat(promptVal);
    if (isNaN(val) || val <= 0) return alert('Monto inválido.');

    const accPrompt = prompt('¿En qué cuenta entra o sale el dinero? (Ej: Efectivo / Caja, Nu, BBVA):', 'acc_cash');

    const res = await fetchWithAuth(`/api/admin/finance/debts/${encodeURIComponent(id)}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: val, account: accPrompt || undefined })
    });
    const d = await res.json();
    if (res.ok && d.success) {
      alert('✅ Abono / Liquidación registrada y sincronizada con el balance.');
      loadAllFinanceData();
    } else {
      alert(d.error || 'Error al procesar abono.');
    }
  };

  window.finDeleteDebt = async function(id) {
    if (!confirm('¿Eliminar definitivamente el registro de deuda?')) return;
    const res = await fetchWithAuth(`/api/admin/finance/debts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) loadAllFinanceData();
  };

  window.finDeleteTx = async function(id) {
    if (!confirm('¿Eliminar este movimiento? Se revertirá automáticamente el impacto de saldo en las cuentas asociadas.')) return;
    const res = await fetchWithAuth(`/api/admin/finance/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const d = await res.json();
    if (res.ok && d.success) {
      alert('✅ Movimiento eliminado y saldos de cuentas revertidos correctamente.');
      loadAllFinanceData();
    } else {
      alert(d.error || 'Error al eliminar');
    }
  };

  // Botón Nueva Deuda
  const btnNewDebt = document.getElementById('btnFinNewDebt');
  if (btnNewDebt) {
    btnNewDebt.addEventListener('click', async () => {
      const type = prompt('Tipo de deuda:\n1. ME DEBEN (Por cobrar)\n2. YO DEBO (Por pagar)\n\nEscribe 1 o 2:', '1') === '2' ? 'payable' : 'receivable';
      const personName = prompt(type === 'receivable' ? 'Nombre de la persona que te debe:' : 'Nombre de la persona a quien le debes:');
      if (!personName || !personName.trim()) return;

      const amountStr = prompt('Monto total de la deuda:', '500.00');
      if (!amountStr) return;
      const totalAmount = parseFloat(amountStr);
      if (isNaN(totalAmount) || totalAmount <= 0) return alert('Monto inválido.');

      const concept = prompt('Concepto o motivo:', 'Préstamo / Servicio') || 'Préstamo';

      const res = await fetchWithAuth('/api/admin/finance/debts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          personName: personName.trim(),
          totalAmount,
          concept
        })
      });
      const d = await res.json();
      if (res.ok && d.success) {
        alert('✅ Deuda registrada correctamente.');
        loadAllFinanceData();
      } else {
        alert(d.error || 'Error al guardar deuda.');
      }
    });
  }

  // Botón Nuevo Plan a Meses (Automático: Solo Total, Meses y Fecha)
  const btnNewInst = document.getElementById('btnFinNewInstallment');
  if (btnNewInst) {
    btnNewInst.addEventListener('click', async () => {
      const title = prompt('Concepto o compra a meses (Ej. Laptop Nu, Seguro, Disposición):');
      if (!title || !title.trim()) return;

      const totalStr = prompt('Monto total de la compra o pedido:', '1200.00');
      if (!totalStr) return;
      const totalAmount = parseFloat(totalStr);
      if (isNaN(totalAmount) || totalAmount <= 0) return alert('Monto inválido.');

      const quotasStr = prompt('¿A cuántos meses / cuotas? (Ej. 3, 6, 12):', '6');
      const totalQuotas = parseInt(quotasStr, 10) || 6;

      const firstDateStr = prompt('Fecha de primer pago (YYYY-MM-DD o día del mes):', new Date().toISOString().slice(0, 10));
      const card = prompt('Tarjeta o Banco (Ej: Nu, BBVA, Mercado Pago):', 'Nu');

      // Cálculo automático de cuota mensual
      const quotaPreview = (totalAmount / totalQuotas).toFixed(2);
      const confirmMsg = `Confirmar registro de meses:\n• Concepto: ${title}\n• Total: $${totalAmount.toFixed(2)}\n• Mensualidades: ${totalQuotas} pagos de ~$${quotaPreview}/mes\n• Primer pago: ${firstDateStr || 'Hoy'}\n\n¿Guardar plan?`;
      if (!confirm(confirmMsg)) return;

      const res = await fetchWithAuth('/api/admin/finance/installments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          totalAmount,
          totalQuotas,
          firstPaymentDate: firstDateStr || undefined,
          accountName: card || 'Nu'
        })
      });
      const d = await res.json();
      if (res.ok && d.success) {
        alert(`✅ Plan a meses registrado con éxito.\nMensualidad automática: $${quotaPreview}/mes.`);
        loadAllFinanceData();
      } else {
        alert(d.error || 'Error al guardar.');
      }
    });
  }

  // Botón Registrar Movimiento Manual (con soporte de pago dividido: efectivo + transferencia / tarjeta)
  const btnManualTx = document.getElementById('btnFinNewManualTx');
  if (btnManualTx) {
    btnManualTx.addEventListener('click', async () => {
      const opt = prompt('Tipo de movimiento:\n1. Ingreso / Venta (+)\n2. Gasto Simple (-)\n3. Gasto Dividido (Ej: parte en efectivo y parte en transferencia/tarjeta)\n\nEscribe 1, 2 o 3:', '2');
      if (!opt) return;

      if (opt === '3') {
        // Gasto Dividido / Conexión Multi-Cuenta
        const desc = prompt('Concepto del gasto dividido (ej. Compra herramienta / Servicio):');
        if (!desc || !desc.trim()) return;

        const totalStr = prompt('Monto total del gasto:', '500.00');
        if (!totalStr) return;
        const totalExpense = parseFloat(totalStr);
        if (isNaN(totalExpense) || totalExpense <= 0) return alert('Monto inválido.');

        const cashStr = prompt('¿Cuánto pagas en Efectivo?', (totalExpense / 2).toFixed(2));
        const cashAmount = parseFloat(cashStr) || 0;
        const bankAmount = Math.max(0, totalExpense - cashAmount);

        const cardName = prompt(`¿De qué cuenta/tarjeta se paga el restante ($${bankAmount.toFixed(2)})? (Ej: acc_nu, acc_bbva, Nu Débito, BBVA):`, 'acc_nu') || 'acc_nu';

        const payload = {
          type: 'expense_manual',
          serviceName: desc.trim(),
          notes: desc.trim(),
          splits: [
            { account: 'Efectivo / Caja', amount: cashAmount },
            { account: cardName, amount: bankAmount }
          ]
        };

        const res = await fetchWithAuth('/api/admin/finance/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const d = await res.json();
        if (res.ok && d.success) {
          alert(`✅ Gasto dividido registrado con éxito:\n• $${cashAmount.toFixed(2)} en Efectivo\n• $${bankAmount.toFixed(2)} vía ${cardName}`);
          loadAllFinanceData();
        } else {
          alert(d.error || 'Error al registrar.');
        }
        return;
      }

      const isIncome = opt === '1';
      const desc = prompt(isIncome ? 'Concepto del ingreso (ej. Venta de servicio):' : 'Concepto del gasto (ej. Despensa / Compra):');
      if (!desc || !desc.trim()) return;

      const amountStr = prompt('Monto:', '100.00');
      if (!amountStr) return;
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) return alert('Monto inválido.');

      const account = prompt('Cuenta (Ej: acc_cash, acc_nu, acc_bbva, Efectivo, Nu, BBVA):', 'acc_cash') || 'acc_cash';

      const payload = {
        type: isIncome ? 'income_manual' : 'expense_manual',
        chargedAmount: isIncome ? amount : 0,
        costAmount: isIncome ? 0 : amount,
        account,
        notes: desc.trim(),
        serviceName: desc.trim()
      };

      const res = await fetchWithAuth('/api/admin/finance/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const d = await res.json();
      if (res.ok && d.success) {
        alert('✅ Movimiento registrado y sincronizado en balances.');
        loadAllFinanceData();
      } else {
        alert(d.error || 'Error al registrar.');
      }
    });
  }

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

  // Manejo de Pestañas Segmentadas (Sin saturar al usuario)
  function initTabs() {
    const tabBtns = document.querySelectorAll('.fin-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-tab');
        if (!targetId) return;

        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.fin-panel').forEach(panel => {
          panel.classList.remove('active');
        });

        const activePanel = document.getElementById(targetId);
        if (activePanel) {
          activePanel.classList.add('active');
        }
        if (window.lucide) lucide.createIcons();
      });
    });
  }

  // Inicializar al cargar
  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadAllFinanceData();
  });
})();
