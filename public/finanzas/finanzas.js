// Portal Autónomo y Modular de Tesorería & Finanzas Personales
(function() {
  const token = localStorage.getItem('dhru_token') || localStorage.getItem('mega_auth_token');
  const serverId = localStorage.getItem('currentServerId') || '1';

  // Si no está autenticado como administrador, redirigir al login principal
  if (!token) {
    alert('Acceso restringido. Por favor inicia sesión como Administrador en el panel principal.');
    window.location.href = '/#login';
    return;
  }

  // Caché de cuentas disponibles para selectores en modales
  let cachedAccounts = [];
  let cachedDebts = [];

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

  // Control de Modales limpios
  window.finOpenModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      if (window.lucide) lucide.createIcons();
    }
  };

  window.finCloseModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  };

  // Carga general de datos
  async function loadAllFinanceData() {
    try {
      // 1. Dashboard general
      const resDash = await fetchWithAuth('/api/admin/finance/dashboard');
      if (resDash.status === 401 || resDash.status === 403) {
        alert('Sesión no autorizada o expirada.');
        window.location.href = '/#login';
        return;
      }
      const dataDash = await resDash.json();
      if (dataDash.success) {
        cachedAccounts = dataDash.accounts || [];
        renderGlobalMetrics(dataDash);
        renderAccounts(cachedAccounts);
        renderLedger(dataDash.recent || []);
        populateAccountSelects(cachedAccounts);
        renderConfigSettings(dataDash.config || {});
      }

      // 2. Planes móviles / recargas
      await loadMobilePlans();

      // 3. Meses sin intereses
      await loadInstallments();

      // 4. Deudas
      await loadDebts();

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error('Error cargando finanzas:', err);
    }
  }

  function renderGlobalMetrics(dash) {
    const statNetWorth = document.getElementById('statFinNetWorth');
    if (statNetWorth) {
      let netTotal = 0;
      (dash.accounts || []).forEach(a => {
        if (a.type !== 'credit') {
          netTotal += parseFloat(a.balance || 0);
        }
      });
      statNetWorth.textContent = formatMoney(netTotal);
    }

    const statGross = document.getElementById('statFinGrossProfit');
    if (statGross) {
      statGross.textContent = formatMoney(dash.summary?.totalGrossProfit || 0);
    }

    const statGrossCount = document.getElementById('statFinGrossCount');
    if (statGrossCount) {
      statGrossCount.textContent = `${dash.summary?.count || 0} movimientos registrados`;
    }
  }

  function populateAccountSelects(accounts) {
    const selects = [
      document.getElementById('mplanAccount'),
      document.getElementById('txAccount'),
      document.getElementById('txSplitAccount'),
      document.getElementById('transferFrom'),
      document.getElementById('transferTo')
    ];

    const optionsHtml = accounts.map(a => {
      return `<option value="${escapeHtml(a.name)}">${escapeHtml(a.name)} (${formatMoney(a.balance || 0)})</option>`;
    }).join('');

    selects.forEach(sel => {
      if (sel) {
        sel.innerHTML = optionsHtml;
      }
    });

    // En transferencias, diferenciar por defecto origen y destino
    const fromSel = document.getElementById('transferFrom');
    const toSel = document.getElementById('transferTo');
    if (fromSel && toSel && accounts.length > 1) {
      toSel.selectedIndex = 1;
    }
  }

  function renderAccounts(accounts) {
    const grid = document.getElementById('finAccountsGrid');
    if (!grid) return;

    if (!accounts.length) {
      grid.innerHTML = '<div style="color:var(--fin-text-muted); padding:1rem;">No hay cuentas o billeteras configuradas.</div>';
      return;
    }

    grid.innerHTML = accounts.map(acc => {
      const balance = parseFloat(acc.balance) || 0;
      const profit = parseFloat(acc.totalProfit !== undefined ? acc.totalProfit : (acc.netProfit || 0));
      const isCard = acc.type === 'card' || acc.type === 'credit';
      const badgeColor = isCard ? '#8218fc' : (acc.type === 'cash' ? '#f59e0b' : '#10b981');
      const badgeBg = isCard ? 'rgba(130,24,252,0.14)' : (acc.type === 'cash' ? 'rgba(245,158,11,0.14)' : 'rgba(16,185,129,0.14)');

      return `
        <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 1.25rem; display:flex; flex-direction:column; justify-content:space-between; position:relative; overflow:hidden;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.8rem;">
            <div>
              <span class="fin-badge" style="background:${badgeBg}; color:${badgeColor};">${escapeHtml(acc.type || 'Cuenta')}</span>
              <h3 style="margin:4px 0 0; font-size:1.1rem; font-weight:700; color:#f8fafc;">${escapeHtml(acc.name)}</h3>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
              <button onclick="window.finOpenEditAccount('${acc.id}')" title="Editar cuenta y saldo" style="background:rgba(255,255,255,0.06); border:none; border-radius:8px; color:#cbd5e1; cursor:pointer; font-size:0.85rem; padding:5px 8px;">
                ✏️
              </button>
              <button onclick="window.finDeleteAccount('${acc.id}', '${escapeHtml(acc.name)}')" title="Archivar cuenta" style="background:rgba(255,255,255,0.06); border:none; border-radius:8px; color:var(--fin-text-sub); cursor:pointer; font-size:0.85rem; padding:5px 8px;">
                🗑️
              </button>
            </div>
          </div>
          <div style="margin-bottom:0.75rem;">
            <div style="font-size:1.65rem; font-weight:800; color:#ffffff; font-family:'Outfit',sans-serif;">${formatMoney(balance)}</div>
            <small style="color:var(--fin-text-muted); font-size:0.75rem;">${isCard ? 'Línea de saldo/uso' : 'Saldo actual disponible'}</small>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed rgba(255,255,255,0.08); padding-top:0.6rem; font-size:0.78rem;">
            <span style="color:var(--fin-text-muted);">Movimientos / Margen:</span>
            <strong style="color:${profit >= 0 ? '#10b981' : '#f43f5e'};">${formatMoney(profit)}</strong>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- SECCIÓN: RECARGAS TELEFÓNICAS & PLANES MÓVILES ---
  async function loadMobilePlans() {
    const listCont = document.getElementById('finMobilePlansContainerList');
    if (!listCont) return;

    try {
      const res = await fetchWithAuth('/api/admin/finance/mobile-plans');
      const d = await res.json();
      if (!res.ok || !d.success) return;

      const items = d.plans || [];
      const sum = d.summary || {};

      const statMobileEst = document.getElementById('statFinMobileEst');
      if (statMobileEst) statMobileEst.textContent = formatMoney(sum.totalMonthlyEstimated || 0);

      const statMobileAlert = document.getElementById('statFinMobileAlert');
      if (statMobileAlert) {
        statMobileAlert.textContent = `${sum.renewalsDueSoon || 0} por recargar pronto`;
        statMobileAlert.style.color = sum.renewalsDueSoon > 0 ? '#f59e0b' : '#94a3b8';
      }

      if (!items.length) {
        listCont.innerHTML = `
          <div style="text-align:center; padding: 2.5rem 1rem; color: var(--fin-text-muted); background:rgba(255,255,255,0.02); border-radius:14px; border:1px dashed rgba(255,255,255,0.08);">
            <i data-lucide="smartphone" style="width:36px; height:36px; margin:0 auto 0.6rem; opacity:0.4; color:#c084fc;"></i>
            <h4 style="margin:0 0 0.3rem; color:#f8fafc;">No hay planes telefónicos registrados</h4>
            <p style="margin:0 0 1rem; font-size:0.85rem;">Registra tu línea (Telcel, Bait, AT&T, Movistar) con su vigencia y ten controlado el gasto de recargas.</p>
            <button class="fin-btn fin-btn-primary" onclick="window.finOpenNewMobilePlan()">
              <i data-lucide="plus" style="width:14px; height:14px;"></i> Registrar Mi Primera Línea
            </button>
          </div>
        `;
        return;
      }

      listCont.innerHTML = items.map(p => {
        const days = p.daysRemaining;
        let alertBadge = '';
        if (p.isExpired) {
          alertBadge = `<span class="fin-badge" style="background:rgba(244,63,94,0.15); color:#f43f5e;"><i data-lucide="alert-circle" style="width:12px; height:12px;"></i> Venció hace ${Math.abs(days)} días</span>`;
        } else if (p.isDueSoon) {
          alertBadge = `<span class="fin-badge" style="background:rgba(245,158,11,0.15); color:#f59e0b;"><i data-lucide="clock" style="width:12px; height:12px;"></i> Vence en ${days} días</span>`;
        } else {
          alertBadge = `<span class="fin-badge" style="background:rgba(16,185,129,0.15); color:#10b981;"><i data-lucide="check" style="width:12px; height:12px;"></i> Activo (${days} días restantes)</span>`;
        }

        return `
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid ${p.isDueSoon || p.isExpired ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)'}; border-radius: 14px; padding: 1.15rem; margin-bottom: 0.85rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem;">
              <div>
                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:4px;">
                  <span class="fin-badge" style="background:rgba(192,132,252,0.15); color:#c084fc;">${escapeHtml(p.carrier)}</span>
                  ${alertBadge}
                </div>
                <h4 style="margin:2px 0 0; font-size:1.05rem; font-weight:700; color:#f8fafc;">${escapeHtml(p.planName)}</h4>
                <div style="font-size:0.8rem; color:var(--fin-text-muted); margin-top:2px;">
                  ${p.phoneNumber ? `📱 <strong>${escapeHtml(p.phoneNumber)}</strong> • ` : ''}
                  Vigencia: <strong>${p.durationDays} días</strong> • Pagado con: <strong>${escapeHtml(p.preferredAccount || 'Efectivo')}</strong>
                </div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:1.35rem; font-weight:800; color:#ffffff; font-family:'Outfit',sans-serif;">${formatMoney(p.amount)}</div>
                <small style="color:var(--fin-text-muted); font-size:0.75rem;">Próxima renovación: ${p.nextRenewalDate || 'No definida'}</small>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.06); margin-top:0.8rem; padding-top:0.7rem; flex-wrap:wrap; gap:0.5rem;">
              <small style="color:var(--fin-text-sub); font-size:0.75rem;">${escapeHtml(p.notes || 'Sin notas especiales')}</small>
              <div style="display:flex; gap:0.45rem;">
                <button onclick="window.finQuickRechargeMobile('${p.id}', '${escapeHtml(p.planName)}', ${p.amount}, '${escapeHtml(p.preferredAccount || 'acc_cash')}')" class="fin-btn fin-btn-primary" style="padding:0.4rem 0.85rem; font-size:0.78rem;">
                  <i data-lucide="refresh-cw" style="width:13px; height:13px;"></i> Registrar Recarga de Hoy
                </button>
                <button onclick="window.finEditMobilePlan('${p.id}')" class="fin-btn fin-btn-soft" style="padding:0.4rem 0.65rem; font-size:0.78rem;" title="Editar plan">
                  ✏️
                </button>
                <button onclick="window.finDeleteMobilePlan('${p.id}')" style="background:none; border:none; color:var(--fin-text-sub); cursor:pointer; font-size:0.9rem;" title="Eliminar plan">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Error cargando planes móviles:', err);
    }
  }

  // Abrir modal de nuevo plan telefónico
  window.finOpenNewMobilePlan = function() {
    document.getElementById('formMobilePlan').reset();
    document.getElementById('mplanId').value = '';
    document.getElementById('modalMobilePlanTitle').textContent = 'Nuevo Plan Telefónico';
    document.getElementById('mplanLastDate').value = new Date().toISOString().slice(0, 10);
    window.finOpenModal('modalMobilePlan');
  };

  // Abrir modal de edición
  window.finEditMobilePlan = async function(id) {
    try {
      const res = await fetchWithAuth('/api/admin/finance/mobile-plans');
      const d = await res.json();
      const p = (d.plans || []).find(x => x.id === id);
      if (!p) return;

      document.getElementById('mplanId').value = p.id;
      document.getElementById('modalMobilePlanTitle').textContent = 'Editar Plan Telefónico';
      document.getElementById('mplanCarrier').value = p.carrier;
      document.getElementById('mplanPhone').value = p.phoneNumber || '';
      document.getElementById('mplanName').value = p.planName || '';
      document.getElementById('mplanAmount').value = p.amount;
      document.getElementById('mplanDuration').value = p.durationDays || 30;
      document.getElementById('mplanLastDate').value = p.lastRechargeDate || '';
      document.getElementById('mplanAccount').value = p.preferredAccount || '';
      document.getElementById('mplanNotes').value = p.notes || '';

      window.finOpenModal('modalMobilePlan');
    } catch (e) {
      console.error(e);
    }
  };

  // Ejecutar recarga de hoy (descuenta saldo y actualiza fecha)
  window.finQuickRechargeMobile = async function(id, name, amount, acc) {
    if (!confirm(`¿Confirmar recarga de $${amount.toFixed(2)} para "${name}"?\nSe registrará el gasto y se renovará la vigencia automáticamente.`)) return;

    try {
      const res = await fetchWithAuth(`/api/admin/finance/mobile-plans/${encodeURIComponent(id)}/recharge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: acc, amount })
      });
      const d = await res.json();
      if (res.ok && d.success) {
        alert('✅ Recarga efectuada y sincronizada con éxito en tus cuentas.');
        loadAllFinanceData();
      } else {
        alert(d.error || 'Error al procesar recarga');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  window.finDeleteMobilePlan = async function(id) {
    if (!confirm('¿Eliminar este plan de recargas?')) return;
    const res = await fetchWithAuth(`/api/admin/finance/mobile-plans/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) loadAllFinanceData();
  };

  // --- SECCIÓN: MESES SIN INTERESES ---
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
          <div style="text-align:center; padding: 2.5rem 1rem; color: var(--fin-text-muted); background:rgba(255,255,255,0.02); border-radius:14px; border:1px dashed rgba(255,255,255,0.08);">
            <i data-lucide="credit-card" style="width:36px; height:36px; margin:0 auto 0.6rem; opacity:0.4; color:#a855f7;"></i>
            <h4 style="margin:0 0 0.3rem; color:#f8fafc;">No hay mensualidades registradas</h4>
            <p style="margin:0 0 1rem; font-size:0.85rem;">Registra compras diferidas a meses (Nu, BBVA, etc.) y calcula tus mensualidades.</p>
            <button class="fin-btn fin-btn-primary" onclick="window.finOpenModal('modalNewInstallment')">
              <i data-lucide="plus" style="width:14px; height:14px;"></i> Registrar Compra a Meses
            </button>
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
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid ${isCompleted ? 'rgba(255,255,255,0.08)' : 'rgba(130, 24, 252, 0.3)'}; border-radius: 14px; padding: 1.15rem; margin-bottom: 0.85rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem;">
              <div>
                <span class="fin-badge" style="background:rgba(130, 24, 252, 0.15); color:#a855f7;">
                  ${escapeHtml(inst.accountName || 'Tarjeta')}
                </span>
                <h4 style="margin:4px 0 0; font-size:1.05rem; font-weight:700; color:#f8fafc;">${escapeHtml(inst.title)}</h4>
                <div style="font-size:0.8rem; color:var(--fin-text-muted); margin-top:2px;">
                  Día de corte/pago: <strong>${inst.dueDay || 13} de cada mes</strong>
                  ${inst.notes ? ` • <span style="color:#a855f7;">${escapeHtml(inst.notes)}</span>` : ''}
                </div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:1.35rem; font-weight:800; color:#ffffff; font-family:'Outfit',sans-serif;">${formatMoney(inst.totalAmount)}</div>
                <small style="color:${isCompleted ? '#10b981' : '#f59e0b'}; font-weight:700;">${inst.paidQuotas}/${inst.totalQuotas} meses cubiertos</small>
              </div>
            </div>

            <div style="background: rgba(255, 255, 255, 0.05); border-radius: 999px; height: 6px; overflow: hidden; margin: 0.8rem 0; border: 1px solid rgba(255,255,255,0.08);">
              <div style="width: ${progressPct}%; height: 100%; background: linear-gradient(90deg, #8218fc, #10b981);"></div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.82rem; color:var(--fin-text-muted); flex-wrap:wrap; gap:0.5rem;">
              <div>
                Cuota mensual: <strong style="color:#ffffff;">${formatMoney(quotaVal)}</strong>
                <span style="color:#f43f5e; margin-left:0.6rem;">Resta pagar: <strong>${formatMoney(remainingAmount)}</strong></span>
              </div>
              <div style="display:flex; gap:0.45rem;">
                ${!isCompleted ? `
                  <button onclick="window.finPayQuota('${inst.id}', '${escapeHtml(inst.title)}', ${quotaVal}, ${inst.paidQuotas + 1})" class="fin-btn fin-btn-primary" style="padding:0.35rem 0.85rem; font-size:0.78rem;">
                    ✓ Abonar Mes #${inst.paidQuotas + 1}
                  </button>
                ` : '<span style="color:#10b981; font-weight:700;">✓ Plan Concluido</span>'}
                <button onclick="window.finDeleteInstallment('${inst.id}')" style="background:none; border:none; color:var(--fin-text-sub); cursor:pointer; font-size:0.9rem;" title="Eliminar plan">
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

  // --- SECCIÓN: DEUDAS & PRÉSTAMOS ---
  async function loadDebts() {
    const listCont = document.getElementById('finDebtsContainerList');
    if (!listCont) return;

    try {
      const res = await fetchWithAuth('/api/admin/finance/debts');
      const d = await res.json();
      if (!res.ok || !d.success) return;

      const items = d.debts || [];
      cachedDebts = items;
      populateDebtSelectOptions(items);
      const s = d.summary || {};

      const statRec = document.getElementById('statFinDebtsReceivable');
      if (statRec) statRec.textContent = formatMoney(s.pendingReceivable || 0);

      const statPay = document.getElementById('statFinDebtsPayable');
      if (statPay) statPay.textContent = `Debo: ${formatMoney(s.pendingPayable || 0)}`;

      if (!items.length) {
        listCont.innerHTML = `
          <div style="text-align:center; padding: 2.5rem 1rem; color: var(--fin-text-muted); background:rgba(255,255,255,0.02); border-radius:14px; border:1px dashed rgba(255,255,255,0.08);">
            <i data-lucide="hand-coins" style="width:36px; height:36px; margin:0 auto 0.6rem; opacity:0.4; color:#38bdf8;"></i>
            <h4 style="margin:0 0 0.3rem; color:#f8fafc;">No hay deudas ni cuentas pendientes</h4>
            <p style="margin:0 0 1rem; font-size:0.85rem;">Lleva el registro de a quién le prestaste dinero o tus deudas personales.</p>
            <button class="fin-btn fin-btn-primary" onclick="window.finOpenModal('modalNewDebt')">
              <i data-lucide="plus" style="width:14px; height:14px;"></i> Registrar Deuda / Préstamo
            </button>
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
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid ${isSettled ? 'rgba(255,255,255,0.08)' : (isRec ? 'rgba(56, 189, 248, 0.3)' : 'rgba(244, 63, 94, 0.3)')}; border-radius: 14px; padding: 1.15rem; margin-bottom: 0.85rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem;">
              <div>
                <span class="fin-badge" style="background:${isRec ? 'rgba(56, 189, 248, 0.15)' : 'rgba(244, 63, 94, 0.15)'}; color:${isRec ? '#38bdf8' : '#f43f5e'};">
                  ${isRec ? 'Me Deben' : 'Yo Debo'}
                </span>
                <h4 style="margin:4px 0 0; font-size:1.05rem; font-weight:700; color:#f8fafc;">${escapeHtml(debt.personName)}</h4>
                <small style="color:var(--fin-text-muted); font-size:0.8rem;">${escapeHtml(debt.concept || debt.notes || 'Préstamo/Deuda')}</small>
              </div>
              <div style="text-align:right;">
                <div style="font-size:1.35rem; font-weight:800; color:${isRec ? '#38bdf8' : '#f43f5e'}; font-family:'Outfit',sans-serif;">${formatMoney(rem)}</div>
                <small style="color:${isSettled ? '#10b981' : (isPartial ? '#f59e0b' : 'var(--fin-text-muted)')}; font-weight:700;">
                  ${isSettled ? '✓ Liquidado' : (isPartial ? `Abonado (${formatMoney(debt.paidAmount)})` : `Total: ${formatMoney(tot)}`)}
                </small>
              </div>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.8rem; border-top:1px solid rgba(255,255,255,0.06); padding-top:0.7rem;">
              ${!isSettled ? `
                <button onclick="window.finSettleDebt('${debt.id}', '${escapeHtml(debt.personName)}', ${rem})" class="fin-btn fin-btn-primary" style="padding:0.35rem 0.85rem; font-size:0.78rem;">
                  ✓ Abonar / Saldar
                </button>
              ` : ''}
              <button onclick="window.finDeleteDebt('${debt.id}')" style="background:none; border:none; color:var(--fin-text-sub); cursor:pointer; font-size:0.9rem;" title="Eliminar registro">
                🗑️
              </button>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Error cargando deudas:', err);
    }
  }

  // --- SECCIÓN: LIBRO CONTABLE & MOVIMIENTOS ---
  function renderLedger(items) {
    const tbody = document.getElementById('finLedgerTbody');
    if (!tbody) return;

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--fin-text-muted);">Sin movimientos contables registrados aún.</td></tr>';
      return;
    }

    tbody.innerHTML = items.slice(0, 50).map(tx => {
      const charged = parseFloat(tx.chargedAmount) || 0;
      const cost = parseFloat(tx.costAmount) || 0;
      const profit = parseFloat(tx.grossProfit) || (charged - cost);
      const dateStr = tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('es-MX', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '-';

      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
          <td style="padding: 11px 12px; color:var(--fin-text-muted); font-size:0.8rem;">${dateStr}</td>
          <td style="padding: 11px 12px; font-weight:600; color:#f8fafc;">
            ${escapeHtml(tx.serviceName || tx.description || tx.orderId || 'Movimiento')}
            ${tx.notes ? `<div style="font-size:0.75rem; color:var(--fin-text-sub); font-weight:normal;">${escapeHtml(tx.notes)}</div>` : ''}
          </td>
          <td style="padding: 11px 12px; color:var(--fin-text-muted); font-size:0.82rem;">${escapeHtml(tx.account || '-')}</td>
          <td style="padding: 11px 12px; text-align:right; color:#10b981; font-weight:600;">${charged > 0 ? formatMoney(charged) : '-'}</td>
          <td style="padding: 11px 12px; text-align:right; color:#f43f5e;">${cost > 0 ? formatMoney(cost) : '-'}</td>
          <td style="padding: 11px 12px; text-align:right; font-weight:700; color:${profit >= 0 ? '#10b981' : '#f43f5e'};">${formatMoney(profit)}</td>
          <td style="padding: 11px 8px; text-align:center;">
            <button onclick="window.finDeleteTx('${tx.id}')" title="Eliminar y revertir saldo" style="background:none; border:none; color:var(--fin-text-sub); cursor:pointer; font-size:0.9rem; padding:3px;">
              🗑️
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderConfigSettings(config) {
    const setReinvest = document.getElementById('setFinReinvestPercent');
    if (setReinvest && config.reinvestPercent !== undefined) {
      setReinvest.value = config.reinvestPercent;
    }
    const setEmerg = document.getElementById('setFinEmergencyTarget');
    if (setEmerg && config.targetGoals?.emergencyFund) {
      setEmerg.value = config.targetGoals.emergencyFund;
    }
  }

  // Poblar selector de deudas en el modal de movimientos
  function populateDebtSelectOptions(debts) {
    const sel = document.getElementById('txDebtId');
    if (!sel) return;
    const currentVal = sel.value;
    const type = document.getElementById('txType')?.value;
    
    // Filtrar deudas pendientes o parciales
    const isReceivable = type === 'debt_collect';
    const isPayable = type === 'debt_pay';
    const filterType = isReceivable ? 'receivable' : (isPayable ? 'payable' : null);

    let filtered = debts.filter(d => d.status !== 'settled');
    if (filterType) {
      filtered = filtered.filter(d => d.type === filterType);
    }

    sel.innerHTML = `<option value="">-- Seleccionar Deuda Pendiente (${filtered.length}) --</option>` +
      filtered.map(d => {
        const rem = parseFloat(d.remainingAmount || d.totalAmount || 0);
        return `<option value="${d.id}" data-type="${d.type}" data-remaining="${rem}" data-person="${escapeHtml(d.personName)}" data-concept="${escapeHtml(d.concept || '')}">
          ${escapeHtml(d.personName)} - Resta: ${formatMoney(rem)} (${escapeHtml(d.concept || 'Deuda')})
        </option>`;
      }).join('');

    if (currentVal) sel.value = currentVal;
  }

  // Al seleccionar una deuda del dropdown
  window.finOnSelectDebtOption = function() {
    const sel = document.getElementById('txDebtId');
    const hint = document.getElementById('txDebtDetailsHint');
    const conceptInput = document.getElementById('txConcept');
    const totalInput = document.getElementById('txTotalAmount');
    if (!sel) return;

    const opt = sel.selectedOptions[0];
    if (opt && opt.value) {
      const remaining = parseFloat(opt.getAttribute('data-remaining')) || 0;
      const person = opt.getAttribute('data-person') || '';
      const concept = opt.getAttribute('data-concept') || '';
      const type = document.getElementById('txType')?.value;

      totalInput.value = remaining > 0 ? remaining.toFixed(2) : '';
      if (type === 'debt_collect') {
        conceptInput.value = `Abono/Cobro a ${person} (${concept || 'Deuda'})`;
      } else if (type === 'debt_pay') {
        conceptInput.value = `Pago realizado a ${person} (${concept || 'Deuda'})`;
      }
      if (hint) hint.innerHTML = `Saldo total pendiente: <strong style="color:#38bdf8;">${formatMoney(remaining)}</strong>`;
      
      // Auto dividir si está en modo split
      const mode = document.getElementById('txPaymentMode')?.value;
      if (mode === 'split' || type === 'expense_split') {
        const cashInput = document.getElementById('txSplitCash');
        const bankInput = document.getElementById('txSplitBank');
        if (cashInput && bankInput) {
          cashInput.value = (remaining / 2).toFixed(2);
          bankInput.value = (remaining / 2).toFixed(2);
        }
      }
    } else {
      if (hint) hint.textContent = '';
    }
  };

  // Toggle de modo de pago (Una sola cuenta vs Mixto/Dividido)
  window.finTogglePaymentMode = function() {
    const mode = document.getElementById('txPaymentMode')?.value || 'single';
    const splitBlock = document.getElementById('txSplitBlock');
    const simpleBlock = document.getElementById('txSimpleAccountBlock');
    const totalInput = document.getElementById('txTotalAmount');

    if (mode === 'split') {
      splitBlock.style.display = 'block';
      simpleBlock.style.display = 'none';
      const tot = parseFloat(totalInput.value) || 0;
      if (tot > 0) {
        document.getElementById('txSplitCash').value = (tot / 2).toFixed(2);
        document.getElementById('txSplitBank').value = (tot / 2).toFixed(2);
      }
    } else {
      splitBlock.style.display = 'none';
      simpleBlock.style.display = 'block';
    }
  };

  // --- TOGGLE CAMPOS DE MOVIMIENTO MANUAL ---
  window.finToggleTxFields = function() {
    const type = document.getElementById('txType').value;
    const splitBlock = document.getElementById('txSplitBlock');
    const simpleBlock = document.getElementById('txSimpleAccountBlock');
    const totalInput = document.getElementById('txTotalAmount');
    const debtSelectBlock = document.getElementById('txDebtSelectBlock');
    const modeGroup = document.getElementById('txPaymentMethodTypeGroup');
    const accLabel = document.getElementById('txAccountLabel');
    const categoryGroup = document.getElementById('txCategoryGroup');
    const catSelect = document.getElementById('txCategory');

    // Reset o mostrar bloque de deuda
    if (type === 'debt_collect' || type === 'debt_pay') {
      debtSelectBlock.style.display = 'block';
      modeGroup.style.display = 'block';
      categoryGroup.style.display = 'none';
      if (catSelect) catSelect.value = 'deudas';

      if (type === 'debt_collect') {
        if (accLabel) accLabel.textContent = 'Cuenta donde entra el dinero (+ Cobro)';
      } else {
        if (accLabel) accLabel.textContent = 'Cuenta de donde sale el dinero (- Pago)';
      }
      populateDebtSelectOptions(cachedDebts);
      window.finTogglePaymentMode();
    } else if (type === 'expense_split') {
      debtSelectBlock.style.display = 'none';
      modeGroup.style.display = 'none';
      categoryGroup.style.display = 'block';
      splitBlock.style.display = 'block';
      simpleBlock.style.display = 'none';
      if (accLabel) accLabel.textContent = 'Cuenta de Cargo / Abono';
      const tot = parseFloat(totalInput.value) || 0;
      if (tot > 0) {
        document.getElementById('txSplitCash').value = (tot / 2).toFixed(2);
        document.getElementById('txSplitBank').value = (tot / 2).toFixed(2);
      }
    } else {
      // Gasto simple o Ingreso simple
      debtSelectBlock.style.display = 'none';
      modeGroup.style.display = 'none';
      categoryGroup.style.display = 'block';
      splitBlock.style.display = 'none';
      simpleBlock.style.display = 'block';
      if (accLabel) {
        accLabel.textContent = type === 'income_simple' ? 'Cuenta donde entra el dinero (+)' : 'Cuenta de donde sale el dinero (-)';
      }
    }
  };

  // --- ACCIONES RÁPIDAS Y APIS ---

  window.finPayQuota = async function(id, title, amount, quotaNum) {
    const acc = prompt(`Pagar mensualidad #${quotaNum} para "${title}" ($${amount.toFixed(2)}):\n¿Con qué cuenta deseas pagar? (Ej: Nu, BBVA, Efectivo):`, 'Nu');
    if (!acc) return;

    const res = await fetchWithAuth(`/api/admin/finance/installments/${encodeURIComponent(id)}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quotas: 1, account: acc })
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
    const debt = cachedDebts.find(d => d.id === id);
    const isReceivable = debt ? debt.type === 'receivable' : true;

    // Abrir el modal unificado configurado para esta deuda
    const txType = document.getElementById('txType');
    if (txType) {
      txType.value = isReceivable ? 'debt_collect' : 'debt_pay';
      window.finToggleTxFields();
    }

    const txDebtId = document.getElementById('txDebtId');
    if (txDebtId) {
      txDebtId.value = id;
      window.finOnSelectDebtOption();
    }

    window.finOpenModal('modalManualTx');
  };

  window.finDeleteDebt = async function(id) {
    if (!confirm('¿Eliminar definitivamente el registro de deuda?')) return;
    const res = await fetchWithAuth(`/api/admin/finance/debts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) loadAllFinanceData();
  };

  window.finOpenNewAccount = function() {
    document.getElementById('formNewAccount').reset();
    document.getElementById('accId').value = '';
    document.getElementById('modalAccountTitle').textContent = 'Nueva Billetera / Cuenta';
    document.getElementById('btnSubmitAccount').textContent = 'Crear Cuenta';
    window.finOpenModal('modalNewAccount');
  };

  window.finOpenEditAccount = function(id) {
    const acc = cachedAccounts.find(a => a.id === id);
    if (!acc) return;

    document.getElementById('accId').value = acc.id;
    document.getElementById('modalAccountTitle').textContent = `Editar Cuenta: ${acc.name}`;
    document.getElementById('accName').value = acc.name || '';
    document.getElementById('accType').value = acc.type || 'bank';
    document.getElementById('accBalance').value = acc.balance !== undefined ? acc.balance : (acc.currentBalance || 0);
    document.getElementById('accDesc').value = acc.description || '';
    document.getElementById('btnSubmitAccount').textContent = 'Guardar Cambios';

    window.finOpenModal('modalNewAccount');
  };

  window.finDeleteAccount = async function(id, name) {
    if (!confirm(`¿Archivar la cuenta "${name}"? No se eliminarán sus registros históricos.`)) return;
    const res = await fetchWithAuth(`/api/admin/finance/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) loadAllFinanceData();
  };

  window.finDeleteTx = async function(id) {
    if (!confirm('¿Eliminar este movimiento? Se revertirá automáticamente el impacto en el balance.')) return;
    const res = await fetchWithAuth(`/api/admin/finance/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const d = await res.json();
    if (res.ok && d.success) {
      alert('✅ Movimiento revertido y eliminado correctamente.');
      loadAllFinanceData();
    } else {
      alert(d.error || 'Error al eliminar');
    }
  };

  // Botón Pasaje / Comida Universidad
  const btnCollege = document.getElementById('btnFinCollegeQuick');
  if (btnCollege) {
    btnCollege.addEventListener('click', async () => {
      const amountStr = prompt('🎒 Ingresar apoyo recibido para pasajes y comida de la universidad:', '300.00');
      if (!amountStr) return;
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) return alert('Monto inválido.');

      const notes = prompt('Nota:', 'Pasaje y comida universidad') || 'Pasaje y comida universidad';

      const res = await fetchWithAuth('/api/admin/finance/college-allowance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, notes, account: 'Efectivo / Caja' })
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

  // Event Listeners de Botones de Apertura de Modales
  const btnNewMobilePlan = document.getElementById('btnFinNewMobilePlan');
  if (btnNewMobilePlan) {
    btnNewMobilePlan.addEventListener('click', window.finOpenNewMobilePlan);
  }

  const btnNewManualTx = document.getElementById('btnFinNewManualTx');
  if (btnNewManualTx) {
    btnNewManualTx.addEventListener('click', () => {
      document.getElementById('formManualTx').reset();
      window.finToggleTxFields();
      window.finOpenModal('modalManualTx');
    });
  }

  const btnTransfer = document.getElementById('btnFinTransferMoney');
  if (btnTransfer) {
    btnTransfer.addEventListener('click', () => {
      document.getElementById('formTransfer').reset();
      window.finOpenModal('modalTransfer');
    });
  }

  const btnNewAcc = document.getElementById('btnFinNewAccount');
  if (btnNewAcc) {
    btnNewAcc.addEventListener('click', window.finOpenNewAccount);
  }

  const btnNewDebt = document.getElementById('btnFinNewDebt');
  if (btnNewDebt) {
    btnNewDebt.addEventListener('click', () => {
      document.getElementById('formNewDebt').reset();
      window.finOpenModal('modalNewDebt');
    });
  }

  const btnNewInst = document.getElementById('btnFinNewInstallment');
  if (btnNewInst) {
    btnNewInst.addEventListener('click', () => {
      document.getElementById('formNewInstallment').reset();
      window.finOpenModal('modalNewInstallment');
    });
  }

  const btnRefresh = document.getElementById('btnFinRefreshAll');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', loadAllFinanceData);
  }

  // --- SUBMITS DE FORMULARIOS MODALES ---

  // 1. Guardar Plan Telefónico
  const formMobilePlan = document.getElementById('formMobilePlan');
  if (formMobilePlan) {
    formMobilePlan.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        id: document.getElementById('mplanId').value || undefined,
        carrier: document.getElementById('mplanCarrier').value,
        phoneNumber: document.getElementById('mplanPhone').value.trim(),
        planName: document.getElementById('mplanName').value.trim(),
        amount: parseFloat(document.getElementById('mplanAmount').value) || 0,
        durationDays: parseInt(document.getElementById('mplanDuration').value) || 30,
        lastRechargeDate: document.getElementById('mplanLastDate').value || undefined,
        preferredAccount: document.getElementById('mplanAccount').value,
        notes: document.getElementById('mplanNotes').value.trim()
      };

      const res = await fetchWithAuth('/api/admin/finance/mobile-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const d = await res.json();
      if (res.ok && d.success) {
        window.finCloseModal('modalMobilePlan');
        loadAllFinanceData();
      } else {
        alert(d.error || 'Error al guardar plan');
      }
    });
  }

  // 2. Guardar Movimiento Manual / Dividido
  const formManualTx = document.getElementById('formManualTx');
  if (formManualTx) {
    formManualTx.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = document.getElementById('txType').value;
      const concept = document.getElementById('txConcept').value.trim();
      const totalAmount = parseFloat(document.getElementById('txTotalAmount').value) || 0;
      const category = document.getElementById('txCategory').value;

      // 2.A: Si es Cobro o Abono a una Deuda
      if (type === 'debt_collect' || type === 'debt_pay') {
        const debtId = document.getElementById('txDebtId').value;
        const mode = document.getElementById('txPaymentMode')?.value || 'single';
        let account = document.getElementById('txAccount').value;
        let splits = null;

        if (mode === 'split') {
          const cashAmount = parseFloat(document.getElementById('txSplitCash').value) || 0;
          const bankAmount = parseFloat(document.getElementById('txSplitBank').value) || 0;
          const splitAcc = document.getElementById('txSplitAccount').value;

          splits = [
            { account: 'Efectivo / Caja', amount: cashAmount },
            { account: splitAcc, amount: bankAmount }
          ];
          account = null;
        }

        // Si hay una deuda seleccionada de la base de datos, liquidarla o abonar
        if (debtId) {
          const resDebt = await fetchWithAuth(`/api/admin/finance/debts/${encodeURIComponent(debtId)}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: totalAmount, account, splits })
          });
          const dDebt = await resDebt.json();
          if (resDebt.ok && dDebt.success) {
            window.finCloseModal('modalManualTx');
            formManualTx.reset();
            window.finToggleTxFields();
            loadAllFinanceData();
            return;
          } else {
            alert(dDebt.error || 'Error al abonar a la deuda');
            return;
          }
        } else {
          // Si no seleccionó una deuda existente, registrarlo como movimiento contable directo de deuda
          const isIncome = type === 'debt_collect';
          let payload = {};
          if (splits) {
            payload = {
              type: isIncome ? 'income_manual' : 'expense_manual',
              category: 'deudas',
              serviceName: concept || (isIncome ? 'Cobro de Deuda' : 'Pago de Deuda'),
              notes: concept,
              splits
            };
          } else {
            payload = {
              type: isIncome ? 'income_manual' : 'expense_manual',
              category: 'deudas',
              serviceName: concept || (isIncome ? 'Cobro de Deuda' : 'Pago de Deuda'),
              notes: concept,
              chargedAmount: isIncome ? totalAmount : 0,
              costAmount: isIncome ? 0 : totalAmount,
              account
            };
          }

          const res = await fetchWithAuth('/api/admin/finance/record', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const d = await res.json();
          if (res.ok && d.success) {
            window.finCloseModal('modalManualTx');
            formManualTx.reset();
            window.finToggleTxFields();
            loadAllFinanceData();
            return;
          } else {
            alert(d.error || 'Error al registrar');
            return;
          }
        }
      }

      // 2.B: Gasto normal, dividido o ingreso normal
      let payload = {};

      if (type === 'expense_split') {
        const cashAmount = parseFloat(document.getElementById('txSplitCash').value) || 0;
        const bankAmount = parseFloat(document.getElementById('txSplitBank').value) || 0;
        const splitAcc = document.getElementById('txSplitAccount').value;

        payload = {
          type: 'expense_manual',
          category,
          serviceName: concept,
          notes: concept,
          splits: [
            { account: 'Efectivo / Caja', amount: cashAmount },
            { account: splitAcc, amount: bankAmount }
          ]
        };
      } else {
        const isIncome = type === 'income_simple';
        const account = document.getElementById('txAccount').value;

        payload = {
          type: isIncome ? 'income_manual' : 'expense_manual',
          category,
          serviceName: concept,
          notes: concept,
          chargedAmount: isIncome ? totalAmount : 0,
          costAmount: isIncome ? 0 : totalAmount,
          account
        };
      }

      const res = await fetchWithAuth('/api/admin/finance/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const d = await res.json();
      if (res.ok && d.success) {
        window.finCloseModal('modalManualTx');
        formManualTx.reset();
        window.finToggleTxFields();
        loadAllFinanceData();
      } else {
        alert(d.error || 'Error al registrar');
      }
    });
  }

  // 3. Guardar Traspaso
  const formTransfer = document.getElementById('formTransfer');
  if (formTransfer) {
    formTransfer.addEventListener('submit', async (e) => {
      e.preventDefault();
      const from = document.getElementById('transferFrom').value;
      const to = document.getElementById('transferTo').value;
      const amount = parseFloat(document.getElementById('transferAmount').value) || 0;
      const notes = document.getElementById('transferNotes').value.trim() || `Traspaso de ${from} a ${to}`;

      if (from === to) return alert('La cuenta origen y destino deben ser distintas.');

      const res = await fetchWithAuth('/api/admin/finance/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'transfer',
          serviceName: `Traspaso: ${from} ➔ ${to}`,
          chargedAmount: 0,
          costAmount: amount,
          account: from,
          destAccount: to,
          notes
        })
      });
      const d = await res.json();
      if (res.ok && d.success) {
        window.finCloseModal('modalTransfer');
        loadAllFinanceData();
      } else {
        alert(d.error || 'Error al efectuar traspaso');
      }
    });
  }

  // 4. Guardar / Editar Cuenta
  const formNewAccount = document.getElementById('formNewAccount');
  if (formNewAccount) {
    formNewAccount.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('accId').value || undefined;
      const initialBalance = parseFloat(document.getElementById('accBalance').value) || 0;

      const payload = {
        id,
        name: document.getElementById('accName').value.trim(),
        type: document.getElementById('accType').value,
        initialBalance,
        currentBalance: initialBalance,
        balance: initialBalance,
        description: document.getElementById('accDesc').value.trim()
      };

      const res = await fetchWithAuth('/api/admin/finance/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const d = await res.json();
      if (res.ok && d.success) {
        window.finCloseModal('modalNewAccount');
        loadAllFinanceData();
      } else {
        alert(d.error || 'Error al guardar cuenta');
      }
    });
  }

  // 5. Guardar Deuda
  const formNewDebt = document.getElementById('formNewDebt');
  if (formNewDebt) {
    formNewDebt.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        type: document.getElementById('debtType').value,
        personName: document.getElementById('debtPerson').value.trim(),
        totalAmount: parseFloat(document.getElementById('debtAmount').value) || 0,
        concept: document.getElementById('debtConcept').value.trim()
      };

      const res = await fetchWithAuth('/api/admin/finance/debts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const d = await res.json();
      if (res.ok && d.success) {
        window.finCloseModal('modalNewDebt');
        loadAllFinanceData();
      } else {
        alert(d.error || 'Error al guardar deuda');
      }
    });
  }

  // 6. Calculadora en Vivo y Guardado de Plan a Plazos
  const instNetReceived = document.getElementById('instNetReceived');
  const instTotal = document.getElementById('instTotal');
  const instQuotas = document.getElementById('instQuotas');
  const instLiveFee = document.getElementById('instLiveFee');
  const instLiveQuota = document.getElementById('instLiveQuota');

  function updateInstallmentLiveCalc() {
    if (!instTotal || !instQuotas || !instLiveQuota) return;
    const net = parseFloat(instNetReceived?.value) || 0;
    const total = parseFloat(instTotal.value) || 0;
    const quotas = Math.max(1, parseInt(instQuotas.value) || 1);

    const fee = Math.max(0, total - net);
    const feePct = net > 0 ? ((fee / net) * 100).toFixed(1) : 0;
    const monthly = (total / quotas);

    if (instLiveFee) {
      if (net > 0 && total >= net) {
        instLiveFee.textContent = `${formatMoney(fee)} (+${feePct}%)`;
        instLiveFee.style.color = fee > 0 ? '#f43f5e' : '#10b981';
      } else {
        instLiveFee.textContent = '$0.00 (0%)';
        instLiveFee.style.color = '#94a3b8';
      }
    }

    if (instLiveQuota) {
      instLiveQuota.textContent = `${formatMoney(monthly)} / mes`;
    }
  }

  if (instNetReceived) {
    instNetReceived.addEventListener('input', () => {
      // Si el usuario introduce monto neto y no ha cambiado el total, sugerir el mismo total
      if (!instTotal.value || parseFloat(instTotal.value) === 0) {
        instTotal.value = instNetReceived.value;
      }
      updateInstallmentLiveCalc();
    });
  }
  if (instTotal) instTotal.addEventListener('input', updateInstallmentLiveCalc);
  if (instQuotas) instQuotas.addEventListener('input', updateInstallmentLiveCalc);

  const formNewInstallment = document.getElementById('formNewInstallment');
  if (formNewInstallment) {
    formNewInstallment.addEventListener('submit', async (e) => {
      e.preventDefault();
      const net = parseFloat(document.getElementById('instNetReceived')?.value) || 0;
      const total = parseFloat(document.getElementById('instTotal').value) || 0;
      const quotas = parseInt(document.getElementById('instQuotas').value) || 6;
      const customNotes = document.getElementById('instNotes')?.value.trim() || '';

      const fee = Math.max(0, total - net);
      let calculatedNotes = customNotes;
      if (net > 0 && fee > 0) {
        const extraNote = `Recibido: ${formatMoney(net)} • Costo financiamiento: ${formatMoney(fee)}`;
        calculatedNotes = calculatedNotes ? `${calculatedNotes} | ${extraNote}` : extraNote;
      }

      const payload = {
        title: document.getElementById('instTitle').value.trim(),
        totalAmount: total,
        totalQuotas: quotas,
        accountName: document.getElementById('instCard').value.trim() || 'Nu',
        dueDay: parseInt(document.getElementById('instDueDay').value) || 13,
        notes: calculatedNotes
      };

      const res = await fetchWithAuth('/api/admin/finance/installments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const d = await res.json();
      if (res.ok && d.success) {
        window.finCloseModal('modalNewInstallment');
        formNewInstallment.reset();
        updateInstallmentLiveCalc();
        loadAllFinanceData();
      } else {
        alert(d.error || 'Error al crear plan a plazos');
      }
    });
  }

  // 7. Guardar Configuración
  const formSettings = document.getElementById('formFinSettings');
  if (formSettings) {
    formSettings.addEventListener('submit', async (e) => {
      e.preventDefault();
      const reinvestPercent = parseFloat(document.getElementById('setFinReinvestPercent').value) || 50;
      const emergencyFund = parseFloat(document.getElementById('setFinEmergencyTarget').value) || 5000;

      const res = await fetchWithAuth('/api/admin/finance/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reinvestPercent,
          targetGoals: { emergencyFund }
        })
      });
      const d = await res.json();
      if (res.ok && d.success) {
        alert('✅ Configuración financiera actualizada correctamente.');
        loadAllFinanceData();
      } else {
        alert(d.error || 'Error al guardar configuración');
      }
    });
  }

  // Manejo de Pestañas Segmentadas
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
