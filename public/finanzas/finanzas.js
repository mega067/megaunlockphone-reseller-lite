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
  let cachedInstallments = [];
  let cachedInvestments = [];
  let investmentChart = null;

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
        renderFinanceServerBalances(dataDash.serverBalances || []);
        renderLedger(dataDash.recent || []);
        populateAccountSelects(cachedAccounts);
        renderConfigSettings(dataDash.config || {});
      }

      // 2. Planes móviles / recargas
      await loadMobilePlans();

      // 3. Meses sin intereses
      await loadInstallments();

      // 4. Inversiones & Rendimiento (Plusvalía / Minusvalía / Gráfica)
      await loadInvestments();

      // 5. Deudas
      await loadDebts();

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error('Error cargando finanzas:', err);
    }
  }

  function renderGlobalMetrics(dash) {
    const statNetWorth = document.getElementById('statFinNetWorth');
    const statUsableBreakdown = document.getElementById('statFinUsableBreakdown');
    if (statNetWorth) {
      let netTotal = 0;
      let usableTotal = 0;
      let savingsTotal = 0;

      (dash.accounts || []).forEach(a => {
        const isCreditOrCard = a.type === 'credit' || a.type === 'card' || (a.creditLimit && parseFloat(a.creditLimit) > 0);
        if (!isCreditOrCard) {
          const bal = parseFloat(a.balance || a.currentBalance || 0);
          netTotal += bal;
          if (a.type === 'savings' || a.name.toLowerCase().includes('cajita')) {
            savingsTotal += bal;
          } else {
            usableTotal += bal;
          }
        }
      });
      statNetWorth.textContent = formatMoney(netTotal);
      if (statUsableBreakdown) {
        statUsableBreakdown.innerHTML = `Usable en tarjeta: <strong style="color:#38bdf8;">${formatMoney(usableTotal)}</strong> • En Cajitas: <strong style="color:#f472b6;">${formatMoney(savingsTotal)}</strong>`;
      }
    }

    const statGross = document.getElementById('statFinGrossProfit');
    const grossVal = parseFloat(dash.summary?.totalGrossProfit || 0);
    if (statGross) {
      statGross.textContent = formatMoney(grossVal);
      statGross.style.color = grossVal >= 0 ? '#10b981' : '#f43f5e';
    }

    const statGrossTitle = document.getElementById('statFinGrossTitle');
    if (statGrossTitle) {
      statGrossTitle.textContent = grossVal >= 0 ? 'Flujo Neto / Ganancias' : 'Balance Neto / Egresos';
    }

    const statGrossCount = document.getElementById('statFinGrossCount');
    if (statGrossCount) {
      statGrossCount.textContent = `${dash.summary?.count || 0} movimientos registrados`;
    }

    // Indicador inteligente de Cajita Nu (Saldo Real en Cajita vs Pendiente por Mover)
    const statCajitaNu = document.getElementById('statFinCajitaNu');
    const statCajitaHint = document.getElementById('statFinCajitaGoalHint');
    if (statCajitaNu) {
      const actualBalance = parseFloat(dash.summary?.cajitaActualBalance !== undefined ? dash.summary.cajitaActualBalance : 0);
      const targetFund = parseFloat(dash.summary?.cajitaTargetFund !== undefined ? dash.summary.cajitaTargetFund : 0);
      const pendingToMove = parseFloat(dash.summary?.cajitaPendingToMove !== undefined ? dash.summary.cajitaPendingToMove : Math.max(0, targetFund - actualBalance));
      const sCost = parseFloat(dash.summary?.totalTicketServerCost || 0);
      const sReinvest = parseFloat(dash.summary?.totalReinvest || 0);

      statCajitaNu.textContent = formatMoney(actualBalance);

      if (statCajitaHint) {
        if (pendingToMove > 0) {
          statCajitaHint.innerHTML = `⚠️ <span style="color:#ec4899; font-weight:700;">Debes mover ${formatMoney(pendingToMove)}</span> <span style="font-size:0.68rem; opacity:0.8;">(Meta: ${formatMoney(targetFund)} • Costo: ${formatMoney(sCost)} + Margen: ${formatMoney(sReinvest)})</span>`;
        } else if (actualBalance >= 100) {
          statCajitaHint.innerHTML = `<span style="color:#10b981; font-weight:700;">✅ ¡Listo para recargar $100 en Servidor!</span> <span style="font-size:0.68rem; opacity:0.8;">(Cajita al día: ${formatMoney(actualBalance)})</span>`;
        } else if (actualBalance >= 50) {
          statCajitaHint.innerHTML = `<span style="color:#38bdf8; font-weight:700;">⚡ ¡Alcanza para recarga mínima de $50!</span> <span style="font-size:0.68rem; opacity:0.8;">(Faltan ${formatMoney(100 - actualBalance)} p/ $100)</span>`;
        } else {
          statCajitaHint.innerHTML = `<span style="color:#10b981;">✅ Cajita al día</span> <span style="font-size:0.68rem; opacity:0.8;">(Acumulado: ${formatMoney(actualBalance)} • Faltan ${formatMoney(Math.max(0, 50 - actualBalance))} p/ $50)</span>`;
        }
      }
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
      const isCard = a.type === 'card' || a.type === 'credit';
      const isSavings = a.type === 'savings' || a.name.toLowerCase().includes('cajita');
      let typeTag = '';
      if (isSavings) typeTag = ' [🔒 Cajita Apartada]';
      else if (isCard) typeTag = ' [💳 Tarjeta]';
      return `<option value="${escapeHtml(a.name)}">${escapeHtml(a.name)}${typeTag} (${formatMoney(a.balance || 0)})</option>`;
    }).join('');

    selects.forEach(sel => {
      if (sel) {
        sel.innerHTML = optionsHtml;
      }
    });

    // Poblar selector de tarjeta para planes a plazos / disposición
    const instCardSel = document.getElementById('instCard');
    if (instCardSel) {
      // Priorizar cuentas de tipo 'card' o 'credit', o incluir todas
      const cards = accounts.filter(a => a.type === 'card' || a.type === 'credit');
      const cardOptions = (cards.length > 0 ? cards : accounts).map(a => {
        const line = parseFloat(a.creditLimit || a.balance || 0);
        return `<option value="${escapeHtml(a.name)}" data-id="${a.id}" data-limit="${line}">
          ${escapeHtml(a.name)} ${line > 0 ? `(Línea: ${formatMoney(line)})` : `(${formatMoney(a.balance || 0)})`}
        </option>`;
      }).join('');
      instCardSel.innerHTML = cardOptions;
    }

    // Poblar selector de cuenta donde entra el dinero de la disposición (Efectivo o banco)
    const instDepSel = document.getElementById('instDepositAccount');
    if (instDepSel) {
      const depOptions = accounts.map(a => {
        return `<option value="${escapeHtml(a.name)}">${escapeHtml(a.name)} [Entra el dinero]</option>`;
      }).join('');
      instDepSel.innerHTML = `
        <option value="none">-- No ingresar a ninguna cuenta (Solo aumentar deuda a la tarjeta) --</option>
        ${depOptions}
      `;
      // Seleccionar efectivo o primera cuenta por defecto
      const cashAcc = accounts.find(a => a.type === 'cash');
      if (cashAcc) instDepSel.value = cashAcc.name;
    }

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
      const isCard = acc.type === 'card' || acc.type === 'credit';
      const isSavings = acc.type === 'savings' || acc.name.toLowerCase().includes('cajita');
      const lineLimit = parseFloat(acc.creditLimit || 0);
      const debt = parseFloat(acc.currentDebt || 0);
      // Para tarjeta de crédito, el disponible real es la línea menos la deuda
      const balance = isCard && lineLimit > 0
        ? Math.max(0, parseFloat((lineLimit - debt).toFixed(2)))
        : parseFloat(acc.balance !== undefined ? acc.balance : (acc.currentBalance || 0));
      const profit = parseFloat(acc.totalProfit !== undefined ? acc.totalProfit : (acc.netProfit || 0));
      
      let badgeLabel = 'Cuenta Bancaria';
      let badgeColor = '#10b981';
      let badgeBg = 'rgba(16,185,129,0.14)';
      let subHint = 'Saldo disponible para gastar';

      if (isCard) {
        badgeLabel = 'Tarjeta de Crédito';
        badgeColor = '#8218fc';
        badgeBg = 'rgba(130,24,252,0.14)';
        subHint = lineLimit > 0 ? `Línea: ${formatMoney(lineLimit)} ${debt > 0 ? `• Deuda: ${formatMoney(debt)}` : ''}` : 'Crédito disponible';
      } else if (isSavings) {
        badgeLabel = 'Cajita Nu / Ahorro Apartado';
        badgeColor = '#ec4899';
        badgeBg = 'rgba(236,72,153,0.15)';
        subHint = '🔒 Dinero apartado (No gastable en tarjeta)';
      } else if (acc.type === 'cash') {
        badgeLabel = 'Efectivo';
        badgeColor = '#f59e0b';
        badgeBg = 'rgba(245,158,11,0.14)';
        subHint = 'Dinero físico en mano';
      } else if (acc.type === 'emergency') {
        badgeLabel = 'Fondo Emergencia';
        badgeColor = '#ef4444';
        badgeBg = 'rgba(239,68,68,0.14)';
        subHint = 'Fondo reservado';
      } else if (acc.type === 'investment') {
        badgeLabel = 'Inversión';
        badgeColor = '#38bdf8';
        badgeBg = 'rgba(56,189,248,0.14)';
        subHint = 'Generando rendimientos';
      }

      return `
        <div style="background: ${isSavings ? 'linear-gradient(145deg, rgba(15, 23, 42, 0.85), rgba(236, 72, 153, 0.08))' : 'rgba(15, 23, 42, 0.7)'}; border: 1px solid ${isSavings ? 'rgba(236, 72, 153, 0.3)' : 'rgba(255, 255, 255, 0.08)'}; border-radius: 16px; padding: 1.25rem; display:flex; flex-direction:column; justify-content:space-between; position:relative; overflow:hidden;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.8rem;">
            <div>
              <span class="fin-badge" style="background:${badgeBg}; color:${badgeColor};">${badgeLabel}</span>
              <h3 style="margin:4px 0 0; font-size:1.1rem; font-weight:700; color:#f8fafc;">${escapeHtml(acc.name)}</h3>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
              <button onclick="window.finOpenEditAccount('${acc.id}')" title="Editar cuenta o cajita" style="background:rgba(255,255,255,0.06); border:none; border-radius:8px; color:#cbd5e1; cursor:pointer; font-size:0.85rem; padding:5px 8px;">
                ✏️
              </button>
              <button onclick="window.finDeleteAccount('${acc.id}', '${escapeHtml(acc.name)}')" title="Archivar cuenta o cajita" style="background:rgba(255,255,255,0.06); border:none; border-radius:8px; color:var(--fin-text-sub); cursor:pointer; font-size:0.85rem; padding:5px 8px;">
                🗑️
              </button>
            </div>
          </div>
          <div style="margin-bottom:0.75rem;">
            <div style="font-size:1.65rem; font-weight:800; color:${isSavings ? '#f472b6' : '#ffffff'}; font-family:'Outfit',sans-serif;">${formatMoney(balance)}</div>
            <small style="color:${isSavings ? '#ec4899' : 'var(--fin-text-muted)'}; font-size:0.75rem; font-weight:${isSavings ? '600' : 'normal'};">
              ${subHint}
            </small>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed rgba(255,255,255,0.08); padding-top:0.6rem; font-size:0.78rem;">
            <span style="color:var(--fin-text-muted);">${isCard ? 'Disposición / Margen:' : (isSavings ? 'Rendimientos / Margen:' : 'Movimientos / Margen:')}</span>
            <strong style="color:${profit >= 0 ? '#10b981' : '#f43f5e'};">${formatMoney(profit)}</strong>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderFinanceServerBalances(servers) {
    const container = document.getElementById('finServersGrid');
    const badge = document.getElementById('finTotalServerBalanceBadge');
    if (!container) return;

    if (!servers || servers.length === 0) {
      container.innerHTML = '<div style="color:var(--fin-text-muted); font-size:0.85rem; padding:10px;">No hay servidores configurados.</div>';
      if (badge) badge.textContent = 'Total Servidores: $0.00 MXN';
      return;
    }

    let totalServerMxn = 0;
    const serverColors = {
      '1': { brand: 'MEGA-SERVER', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.08)', border: 'rgba(56, 189, 248, 0.3)', icon: 'zap' },
      '2': { brand: 'POPI-GSM', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.08)', border: 'rgba(251, 191, 36, 0.3)', icon: 'shield' },
      '3': { brand: 'OMEGA-SERVER', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.08)', border: 'rgba(244, 63, 94, 0.3)', icon: 'flame' }
    };

    container.innerHTML = servers.map(srv => {
      const sId = String(srv.id);
      const meta = serverColors[sId] || { color: '#818cf8', bg: 'rgba(129, 140, 248, 0.08)', border: 'rgba(129, 140, 248, 0.3)', icon: 'server' };
      const isOnline = srv.status === 'online';
      const isEnabled = srv.enabled !== false;
      
      if (isEnabled && isOnline) {
        totalServerMxn += parseFloat(srv.creditMxn || 0);
      }

      const statusPill = !isEnabled
        ? '<span style="background: rgba(148, 163, 184, 0.15); color: #94a3b8; font-size: 0.65rem; padding: 2px 7px; border-radius: 999px; font-weight: 700;">APAGADO</span>'
        : (isOnline 
            ? '<span style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 0.65rem; padding: 2px 7px; border-radius: 999px; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;"><span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981;"></span> EN LÍNEA</span>'
            : `<span title="${escapeHtml(srv.statusMsg || 'Error')}" style="background: rgba(239, 68, 68, 0.2); color: #f87171; font-size: 0.65rem; padding: 2px 7px; border-radius: 999px; font-weight: 700; cursor: help; display: inline-flex; align-items: center; gap: 4px;"><span style="width: 6px; height: 6px; border-radius: 50%; background: #ef4444;"></span> ERROR</span>`);

      return `
        <div style="background: ${meta.bg}; border: 1px solid ${meta.border}; border-radius: 14px; padding: 14px 16px; position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-weight: 800; font-size: 0.95rem; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
                <i data-lucide="${meta.icon}" style="width: 16px; height: 16px; color: ${meta.color};"></i> ${escapeHtml(srv.name)}
              </span>
              ${statusPill}
            </div>
            <div style="font-size: 1.5rem; font-weight: 900; color: #ffffff; font-family: 'Outfit', sans-serif; letter-spacing: -0.5px;">
              $${parseFloat(srv.creditMxn || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span style="font-size: 0.72rem; color: #94a3b8; font-weight: normal; margin-left: 2px;">MXN</span>
            </div>
            ${srv.currency === 'USD' ? `
              <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 2px;">
                Saldo DHRU original: <b style="color: #cbd5e1; font-family: monospace;">$${parseFloat(srv.creditRaw || 0).toFixed(2)} USD</b>
              </div>
            ` : ''}
          </div>

          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.1); font-size: 0.72rem; display: flex; justify-content: space-between; color: #cbd5e1;">
            <span>Cedido a clientes: <b style="color: #c4b5fd;">$${parseFloat(srv.assigned || 0).toFixed(2)}</b></span>
            <span>Disponible: <b style="color: #22d3ee;">$${parseFloat(srv.available || 0).toFixed(2)}</b></span>
          </div>

          ${!isOnline && isEnabled && srv.statusMsg ? `
            <div style="margin-top: 8px; font-size: 0.7rem; color: #fca5a5; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.25); padding: 5px 8px; border-radius: 6px; word-break: break-word;">
              ⚠️ ${escapeHtml(srv.statusMsg)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    if (badge) {
      badge.textContent = `Total Servidores: $${totalServerMxn.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
    }
    if (window.lucide) lucide.createIcons();
  }
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
      cachedInstallments = items;
      populateInstallmentSelectOptions(items);
      const active = items.filter(i => i.status === 'active');
      
      let totalPending = 0;
      let nextQuotaTotal = 0;

      active.forEach(i => {
        const totalAmt = parseFloat(i.totalAmount) || 0;
        const paidQ = parseInt(i.paidQuotas) || 0;
        const totalQ = Math.max(1, parseInt(i.totalQuotas) || 1);
        const quota = parseFloat(i.quotaAmount) || (totalAmt / totalQ);
        
        // Calcular restante exacto sin discrepancias de centavos
        const remaining = paidQ === 0 ? totalAmt : Math.max(0, parseFloat((totalAmt - (paidQ * quota)).toFixed(2)));
        totalPending += remaining;
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
        const totalAmt = parseFloat(inst.totalAmount) || 0;
        const remainingQuotas = Math.max(0, (inst.totalQuotas || 0) - (inst.paidQuotas || 0));
        // Si no se ha pagado nada, el restante es exactamente el totalAmount para evitar discrepancias de centavos
        const remainingAmount = (inst.paidQuotas || 0) === 0 
          ? totalAmt 
          : Math.max(0, parseFloat((totalAmt - ((inst.paidQuotas || 0) * quotaVal)).toFixed(2)));

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
              <div style="display:flex; gap:0.45rem; flex-wrap:wrap;">
                ${!isCompleted ? `
                  <button onclick="window.finOpenInstallmentPayment('${inst.id}', 1)" class="fin-btn fin-btn-primary" style="padding:0.35rem 0.85rem; font-size:0.78rem;">
                    ✓ Abonar Mes #${inst.paidQuotas + 1}
                  </button>
                  <button onclick="window.finOpenInstallmentPayment('${inst.id}', ${remainingQuotas})" class="fin-btn" style="padding:0.35rem 0.85rem; font-size:0.78rem; background:rgba(16, 185, 129, 0.15); color:#10b981; border:1px solid rgba(16, 185, 129, 0.3);">
                    ★ Liquidar Plan (${formatMoney(remainingAmount)})
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
            <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.8rem; border-top:1px solid rgba(255,255,255,0.06); padding-top:0.7rem; flex-wrap:wrap;">
              ${!isSettled ? `
                <button onclick="window.finSettleDebt('${debt.id}', '${escapeHtml(debt.personName)}', ${rem})" class="fin-btn fin-btn-primary" style="padding:0.35rem 0.85rem; font-size:0.78rem;">
                  ✓ Abonar / Saldar
                </button>
                <button onclick="window.finOpenCrossOffsetForDebt('${debt.id}')" class="fin-btn" style="padding:0.35rem 0.85rem; font-size:0.78rem; background:rgba(245, 158, 11, 0.15); color:#f59e0b; border:1px solid rgba(245, 158, 11, 0.35);" title="Cruzar y tabular esta deuda con otra persona o deuda inversa">
                  ⚖️ Cruzar Deuda
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

  // --- SECCIÓN: INVERSIONES, RENDIMIENTO Y PLUSVALÍA / MINUSVALÍA ---
  async function loadInvestments() {
    const tbody = document.getElementById('finInvestmentsTbody');
    if (!tbody) return;

    try {
      const res = await fetchWithAuth('/api/admin/finance/investments');
      const d = await res.json();
      if (!res.ok || !d.success) return;

      const items = d.logs || [];
      cachedInvestments = items;
      const s = d.summary || {};

      // Actualizar Métricas Superiores
      const statCap = document.getElementById('statFinInvCapital');
      if (statCap) statCap.textContent = formatMoney(s.totalInvested || 0);

      const statVal = document.getElementById('statFinInvCurrentValue');
      if (statVal) statVal.textContent = formatMoney(s.currentValue || 0);

      const statRet = document.getElementById('statFinInvNetReturn');
      const statLabel = document.getElementById('statFinInvReturnLabel');
      if (statRet) {
        statRet.textContent = `${s.netReturn >= 0 ? '+' : ''}${formatMoney(s.netReturn || 0)}`;
        statRet.style.color = s.netReturn >= 0 ? '#10b981' : '#f43f5e';
      }
      if (statLabel) {
        statLabel.textContent = s.netReturn >= 0 
          ? `Plusvalía: +${(s.returnPercentage || 0).toFixed(2)}%` 
          : `Minusvalía: ${(s.returnPercentage || 0).toFixed(2)}%`;
        statLabel.style.color = s.netReturn >= 0 ? '#10b981' : '#f43f5e';
      }

      const statCount = document.getElementById('statFinInvSnapshotsCount');
      if (statCount) statCount.textContent = items.length;

      const statLastDate = document.getElementById('statFinInvLastDate');
      if (statLastDate) {
        if (items.length > 0) {
          const last = items[items.length - 1];
          statLastDate.textContent = `Último: ${last.date} (${last.platform || 'Revolut'})`;
        } else {
          statLastDate.textContent = 'Sin cortes aún';
        }
      }

      // Renderizar Gráfica
      renderInvestmentChart(items);

      // Renderizar Tabla
      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--fin-text-muted);">Sin cortes ni valuaciones de inversión registradas aún. Haz clic en <strong>+ Registrar Corte</strong>.</td></tr>';
        return;
      }

      // Mostrar en la tabla en orden inverso (más reciente arriba)
      const reversed = [...items].reverse();
      tbody.innerHTML = reversed.map(log => {
        const netRet = parseFloat(log.netReturn || 0);
        const retPct = parseFloat(log.returnPercentage || 0);
        const isProfit = netRet >= 0;
        const injected = parseFloat(log.injectedAmount || 0);
        const withdrawn = parseFloat(log.withdrawnAmount || 0);

        let deltaStr = '-';
        if (injected > 0 && withdrawn > 0) {
          deltaStr = `<span style="color:#10b981;">+${formatMoney(injected)}</span> / <span style="color:#f43f5e;">-${formatMoney(withdrawn)}</span>`;
        } else if (injected > 0) {
          deltaStr = `<span style="color:#10b981; font-weight:600;">+${formatMoney(injected)}</span>`;
        } else if (withdrawn > 0) {
          deltaStr = `<span style="color:#f43f5e; font-weight:600;">-${formatMoney(withdrawn)}</span>`;
        }

        return `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
            <td style="padding: 10px 12px; font-weight:600; color:#f8fafc;">
              ${escapeHtml(log.date)}
            </td>
            <td style="padding: 10px 12px; color:var(--fin-text-muted);">
              <span class="fin-badge" style="background:rgba(16, 185, 129, 0.12); color:#10b981; font-size:0.75rem;">
                ${escapeHtml(log.platform || 'Revolut')}
              </span>
              ${log.notes ? `<div style="font-size:0.75rem; color:var(--fin-text-sub); margin-top:2px;">${escapeHtml(log.notes)}</div>` : ''}
            </td>
            <td style="padding: 10px 12px; text-align:right; color:#94a3b8; font-weight:600;">
              ${formatMoney(log.investedCapital)}
            </td>
            <td style="padding: 10px 12px; text-align:right; font-weight:700; color:#38bdf8;">
              ${formatMoney(log.currentValue)}
            </td>
            <td style="padding: 10px 12px; text-align:right;">
              ${deltaStr}
            </td>
            <td style="padding: 10px 12px; text-align:right; font-weight:700; color:${isProfit ? '#10b981' : '#f43f5e'};">
              ${isProfit ? '+' : ''}${formatMoney(netRet)}
            </td>
            <td style="padding: 10px 12px; text-align:right; font-weight:700; color:${isProfit ? '#10b981' : '#f43f5e'};">
              ${isProfit ? '+' : ''}${retPct.toFixed(2)}%
            </td>
            <td style="padding: 10px 8px; text-align:center;">
              <button onclick="window.finDeleteInvestmentLog('${log.id}')" title="Eliminar corte" style="background:none; border:none; color:var(--fin-text-sub); cursor:pointer; font-size:0.9rem; padding:3px;">
                🗑️
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Error cargando inversiones:', err);
    }
  }

  function renderInvestmentChart(items) {
    const canvas = document.getElementById('chartInvestmentGrowth');
    const emptyMsg = document.getElementById('chartInvestmentEmpty');
    if (!canvas) return;

    if (!items || items.length === 0) {
      if (emptyMsg) emptyMsg.style.display = 'block';
      if (investmentChart) {
        investmentChart.destroy();
        investmentChart = null;
      }
      return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';

    // Preparar series de datos cronológicas
    const labels = items.map(i => i.date);
    const investedData = items.map(i => parseFloat(i.investedCapital) || 0);
    const valueData = items.map(i => parseFloat(i.currentValue) || 0);

    // Destruir instancia previa de Chart.js si existe
    if (investmentChart) {
      investmentChart.destroy();
    }

    // Inicializar nuevo gráfico con Chart.js
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js no está cargado aún en la ventana.');
      return;
    }

    const ctx = canvas.getContext('2d');
    
    // Gradiente sutil para el valor del portafolio
    const gradientVal = ctx.createLinearGradient(0, 0, 0, 300);
    gradientVal.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    gradientVal.addColorStop(1, 'rgba(16, 185, 129, 0.00)');

    investmentChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Valor Real del Portafolio',
            data: valueData,
            borderColor: '#10b981',
            backgroundColor: gradientVal,
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#10b981',
            pointBorderColor: '#ffffff',
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Capital Neto Invertido',
            data: investedData,
            borderColor: '#64748b',
            borderDash: [5, 5],
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointBackgroundColor: '#64748b',
            pointRadius: 3,
            pointHoverRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#94a3b8',
              font: { family: 'Inter', size: 12, weight: 600 },
              usePointStyle: true,
              boxWidth: 8
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                label += formatMoney(context.parsed.y);
                return label;
              },
              afterBody: function(tooltipItems) {
                if (tooltipItems.length >= 2) {
                  const val = tooltipItems[0].parsed.y;
                  const inv = tooltipItems[1].parsed.y;
                  const diff = val - inv;
                  const pct = inv > 0 ? ((diff / inv) * 100).toFixed(2) : 0;
                  const tag = diff >= 0 ? 'Plusvalía' : 'Minusvalía';
                  return `\n${tag}: ${diff >= 0 ? '+' : ''}${formatMoney(diff)} (${pct}%)`;
                }
                return '';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#64748b',
              font: { family: 'Inter', size: 11 },
              callback: function(val) {
                return '$' + val.toLocaleString('es-MX');
              }
            }
          }
        }
      }
    });
  }

  // Poblar selector de cuentas de inversión en el modal
  function populateInvestmentModalSelects(accounts) {
    const accSel = document.getElementById('invAccountId');
    const srcSel = document.getElementById('invSourceAccount');
    if (!accSel) return;

    // Cuentas de tipo inversión o que tengan 'inver' en el nombre
    const invAccounts = accounts.filter(a => a.type === 'investment' || a.name.toLowerCase().includes('inver') || a.id === 'acc_investment');
    const targetAccounts = invAccounts.length > 0 ? invAccounts : accounts;

    accSel.innerHTML = targetAccounts.map(a => {
      return `<option value="${a.id}" data-name="${escapeHtml(a.name)}">${escapeHtml(a.name)} (Actual: ${formatMoney(a.balance || a.currentBalance || 0)})</option>`;
    }).join('');

    if (srcSel) {
      // Cuentas de donde puede salir dinero para fondear la inversión
      const bankOrCash = accounts.filter(a => a.type !== 'investment');
      srcSel.innerHTML = '<option value="">-- No registrar traspaso contable (Solo actualizar valuación) --</option>' +
        bankOrCash.map(a => `<option value="${escapeHtml(a.name)}">${escapeHtml(a.name)} (${formatMoney(a.balance || 0)})</option>`).join('');
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

  // Poblar selector de tarjetas / planes a meses en el modal de movimientos
  function populateInstallmentSelectOptions(installments) {
    const sel = document.getElementById('txInstallmentId');
    if (!sel) return;
    const currentVal = sel.value;

    const active = installments.filter(i => i.status === 'active');
    // Incluir también las tarjetas de crédito configuradas en cuentas
    const creditCards = cachedAccounts.filter(a => a.type === 'credit' || a.type === 'card' || (parseFloat(a.creditLimit || 0) > 0));

    let html = '<option value="">-- Seleccionar Plan a Meses o Tarjeta --</option>';

    if (active.length > 0) {
      html += '<optgroup label="Planes a Meses Activos">';
      active.forEach(inst => {
        const totalAmt = parseFloat(inst.totalAmount) || 0;
        const paidQ = parseInt(inst.paidQuotas) || 0;
        const totalQ = Math.max(1, parseInt(inst.totalQuotas) || 1);
        const quota = parseFloat(inst.quotaAmount) || (totalAmt / totalQ);
        const rem = paidQ === 0 ? totalAmt : Math.max(0, parseFloat((totalAmt - (paidQ * quota)).toFixed(2)));
        html += `<option value="${inst.id}" data-type="installment" data-quota="${quota}" data-remaining="${rem}" data-account="${escapeHtml(inst.accountName || 'Nu')}" data-title="${escapeHtml(inst.title)}" data-paid="${paidQ}" data-totalquotas="${totalQ}">
          Plan: ${escapeHtml(inst.title)} (${inst.accountName || 'Nu'}) - Cuota: ${formatMoney(quota)} (Resta: ${formatMoney(rem)})
        </option>`;
      });
      html += '</optgroup>';
    }

    if (creditCards.length > 0) {
      html += '<optgroup label="Abono Directo a Tarjeta">';
      creditCards.forEach(c => {
        const debt = parseFloat(c.currentDebt || 0);
        html += `<option value="card_${c.id}" data-type="card" data-cardid="${c.id}" data-account="${escapeHtml(c.name)}" data-remaining="${debt}">
          Tarjeta: ${escapeHtml(c.name)} - Deuda Acumulada: ${formatMoney(debt)}
        </option>`;
      });
      html += '</optgroup>';
    }

    sel.innerHTML = html;
    if (currentVal) sel.value = currentVal;
  }

  window.finOnSelectInstallmentOption = function() {
    const sel = document.getElementById('txInstallmentId');
    const hint = document.getElementById('txInstallmentDetailsHint');
    const conceptInput = document.getElementById('txConcept');
    const totalInput = document.getElementById('txTotalAmount');
    if (!sel) return;

    const opt = sel.selectedOptions[0];
    if (opt && opt.value) {
      const optType = opt.getAttribute('data-type');
      const account = opt.getAttribute('data-account') || 'Nu';
      const quota = parseFloat(opt.getAttribute('data-quota')) || 0;
      const remaining = parseFloat(opt.getAttribute('data-remaining')) || 0;
      const title = opt.getAttribute('data-title') || 'Tarjeta';

      if (optType === 'installment') {
        const paid = parseInt(opt.getAttribute('data-paid')) || 0;
        totalInput.value = quota > 0 ? quota.toFixed(2) : remaining.toFixed(2);
        conceptInput.value = `Abono Mes #${paid + 1}: ${title} (${account})`;
        if (hint) hint.innerHTML = `Mensualidad sugerida: <strong style="color:#a855f7;">${formatMoney(quota)}</strong> (Total restante: ${formatMoney(remaining)})`;
      } else {
        totalInput.value = remaining > 0 ? remaining.toFixed(2) : '';
        conceptInput.value = `Abono directo a tarjeta: ${account}`;
        if (hint) hint.innerHTML = `Deuda pendiente en tarjeta: <strong style="color:#a855f7;">${formatMoney(remaining)}</strong>`;
      }

      // Prellenar división si está en modo split
      const mode = document.getElementById('txPaymentMode')?.value;
      const tot = parseFloat(totalInput.value) || 0;
      if (mode === 'split' && tot > 0) {
        const cashInput = document.getElementById('txSplitCash');
        const bankInput = document.getElementById('txSplitBank');
        if (cashInput && bankInput) {
          cashInput.value = (tot / 2).toFixed(2);
          bankInput.value = (tot / 2).toFixed(2);
        }
      }
    } else {
      if (hint) hint.textContent = '';
    }
  };

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
      const cashVal = parseFloat(document.getElementById('txSplitCash')?.value) || 0;
      const bankVal = parseFloat(document.getElementById('txSplitBank')?.value) || 0;
      if (tot > 0 && cashVal === 0 && bankVal === 0) {
        document.getElementById('txSplitCash').value = (tot / 2).toFixed(2);
        document.getElementById('txSplitBank').value = (tot / 2).toFixed(2);
      }
    } else {
      splitBlock.style.display = 'none';
      simpleBlock.style.display = 'block';
    }
  };

  // Sincronización en vivo: al modificar efectivo o banco en modo mixto, recalcular el total
  function initSplitSyncListeners() {
    const cashInput = document.getElementById('txSplitCash');
    const bankInput = document.getElementById('txSplitBank');
    const totalInput = document.getElementById('txTotalAmount');

    function syncFromSplits() {
      const mode = document.getElementById('txPaymentMode')?.value;
      const type = document.getElementById('txType')?.value;
      if (mode === 'split' || type === 'expense_split') {
        const c = parseFloat(cashInput?.value) || 0;
        const b = parseFloat(bankInput?.value) || 0;
        if (totalInput) totalInput.value = (c + b).toFixed(2);
      }
    }

    if (cashInput) cashInput.addEventListener('input', syncFromSplits);
    if (bankInput) bankInput.addEventListener('input', syncFromSplits);
  }

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

    // Reset o mostrar bloque de deuda o tarjeta de crédito
    const instSelectBlock = document.getElementById('txInstallmentSelectBlock');

    if (type === 'server_recharge') {
      if (instSelectBlock) instSelectBlock.style.display = 'none';
      if (debtSelectBlock) debtSelectBlock.style.display = 'none';
      modeGroup.style.display = 'none';
      categoryGroup.style.display = 'block';
      splitBlock.style.display = 'none';
      simpleBlock.style.display = 'block';
      if (catSelect) catSelect.value = 'servidores';
      if (accLabel) accLabel.textContent = 'Cuenta de donde sale tu dinero personal para recargar el Servidor (-)';
      const conceptInput = document.getElementById('txConcept');
      if (conceptInput && !conceptInput.value) {
        conceptInput.value = 'Recarga de Saldo a Servidor GSM';
      }
    } else if (type === 'pay_credit') {
      if (instSelectBlock) instSelectBlock.style.display = 'block';
      if (debtSelectBlock) debtSelectBlock.style.display = 'none';
      modeGroup.style.display = 'block';
      categoryGroup.style.display = 'none';
      if (catSelect) catSelect.value = 'servicios';
      if (accLabel) accLabel.textContent = 'Cuenta de donde sale el dinero para pagar (-)';
      populateInstallmentSelectOptions(cachedInstallments);
      window.finTogglePaymentMode();
    } else if (type === 'debt_collect' || type === 'debt_pay') {
      if (instSelectBlock) instSelectBlock.style.display = 'none';
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
      if (instSelectBlock) instSelectBlock.style.display = 'none';
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
      if (instSelectBlock) instSelectBlock.style.display = 'none';
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

  // Abrir modal de movimiento preconfigurado para pagar cuota o liquidar plan
  window.finOpenInstallmentPayment = function(id, quotasCount = 1) {
    const inst = cachedInstallments.find(i => i.id === id);
    if (!inst) return;

    const txType = document.getElementById('txType');
    if (txType) {
      txType.value = 'pay_credit';
      window.finToggleTxFields();
    }

    const txInst = document.getElementById('txInstallmentId');
    if (txInst) {
      txInst.value = id;
      window.finOnSelectInstallmentOption();
    }

    const remainingQuotas = Math.max(1, (inst.totalQuotas || 0) - (inst.paidQuotas || 0));
    const isFullSettlement = quotasCount >= remainingQuotas;
    const totalAmt = parseFloat(inst.totalAmount) || 0;
    const quotaVal = parseFloat(inst.quotaAmount) || 0;
    const remainingAmount = (inst.paidQuotas || 0) === 0 ? totalAmt : Math.max(0, parseFloat((totalAmt - ((inst.paidQuotas || 0) * quotaVal)).toFixed(2)));

    const totalInput = document.getElementById('txTotalAmount');
    const conceptInput = document.getElementById('txConcept');

    if (isFullSettlement) {
      if (totalInput) totalInput.value = remainingAmount.toFixed(2);
      if (conceptInput) conceptInput.value = `Liquidación Total Plan: ${inst.title} (${inst.accountName || 'Nu'})`;
    } else {
      const qNum = (inst.paidQuotas || 0) + 1;
      if (totalInput) totalInput.value = quotaVal.toFixed(2);
      if (conceptInput) conceptInput.value = `Abono Mes #${qNum}: ${inst.title} (${inst.accountName || 'Nu'})`;
    }

    window.finOpenModal('modalManualTx');
  };

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

  // --- SECCIÓN: COMPENSACIÓN Y TABULACIÓN CRUZADA DE DEUDAS ---

  window.finOpenCrossOffsetDebtModal = function(preselectedId = null) {
    const payables = cachedDebts.filter(d => d.type === 'payable' && d.status !== 'settled');
    const receivables = cachedDebts.filter(d => d.type === 'receivable' && d.status !== 'settled');

    if (payables.length === 0 || receivables.length === 0) {
      alert('Para tabular y cruzar deudas necesitas tener al menos:\n• 1 deuda que TÚ DEBAS (Yo Debo)\n• 1 deuda que TE DEBAN A TI (Me Deben)');
      return;
    }

    const paySel = document.getElementById('offsetPayableId');
    const recSel = document.getElementById('offsetReceivableId');
    const form = document.getElementById('formCrossOffsetDebt');
    if (form) form.reset();

    if (paySel) {
      paySel.innerHTML = payables.map(p => {
        const rem = parseFloat(p.remainingAmount || p.totalAmount || 0);
        return `<option value="${p.id}" data-rem="${rem}" data-person="${escapeHtml(p.personName)}">
          Debo a ${escapeHtml(p.personName)}: ${formatMoney(rem)} (${escapeHtml(p.concept || 'Deuda')})
        </option>`;
      }).join('');
    }

    if (recSel) {
      recSel.innerHTML = receivables.map(r => {
        const rem = parseFloat(r.remainingAmount || r.totalAmount || 0);
        return `<option value="${r.id}" data-rem="${rem}" data-person="${escapeHtml(r.personName)}">
          Me debe ${escapeHtml(r.personName)}: ${formatMoney(rem)} (${escapeHtml(r.concept || 'Deuda')})
        </option>`;
      }).join('');
    }

    // Si viene de presionar el botón directo en una tarjeta de deuda
    if (preselectedId) {
      const target = cachedDebts.find(d => d.id === preselectedId);
      if (target) {
        if (target.type === 'payable' && paySel) {
          paySel.value = target.id;
          // Intentar coincidir por nombre de persona si esa misma persona tiene una deuda a favor
          const matchRec = receivables.find(r => r.personName.trim().toLowerCase() === target.personName.trim().toLowerCase());
          if (matchRec && recSel) recSel.value = matchRec.id;
        } else if (target.type === 'receivable' && recSel) {
          recSel.value = target.id;
          const matchPay = payables.find(p => p.personName.trim().toLowerCase() === target.personName.trim().toLowerCase());
          if (matchPay && paySel) paySel.value = matchPay.id;
        }
      }
    }

    window.finRecalcOffsetPreview();
    window.finOpenModal('modalCrossOffsetDebt');
  };

  window.finOpenCrossOffsetForDebt = function(debtId) {
    window.finOpenCrossOffsetDebtModal(debtId);
  };

  window.finRecalcOffsetPreview = function() {
    const paySel = document.getElementById('offsetPayableId');
    const recSel = document.getElementById('offsetReceivableId');
    const amtInput = document.getElementById('offsetAmount');
    const hint = document.getElementById('offsetMaxHint');
    const previewBox = document.getElementById('offsetPreviewBox');
    const previewText = document.getElementById('offsetPreviewText');
    if (!paySel || !recSel) return;

    const optPay = paySel.selectedOptions[0];
    const optRec = recSel.selectedOptions[0];
    if (!optPay || !optRec) return;

    const remPay = parseFloat(optPay.getAttribute('data-rem') || 0);
    const remRec = parseFloat(optRec.getAttribute('data-rem') || 0);
    const personPay = optPay.getAttribute('data-person') || 'Acreedor';
    const personRec = optRec.getAttribute('data-person') || 'Deudor';

    const maxCompensable = Math.min(remPay, remRec);

    if (amtInput && (!amtInput.value || parseFloat(amtInput.value) > maxCompensable)) {
      amtInput.value = maxCompensable.toFixed(2);
    }
    if (hint) {
      hint.textContent = `Monto máximo cruzable: ${formatMoney(maxCompensable)} (mínimo entre ambas deudas).`;
    }

    const currentAmt = parseFloat(amtInput?.value) || maxCompensable;
    const finalPayRem = Math.max(0, remPay - currentAmt);
    const finalRecRem = Math.max(0, remRec - currentAmt);

    if (previewText) {
      previewText.innerHTML = `
        <div style="margin-bottom:0.4rem;">
          • <strong>Lo que le debes a ${escapeHtml(personPay)}:</strong> de <span style="color:#f43f5e;">${formatMoney(remPay)}</span> se reduce a <strong style="color:${finalPayRem === 0 ? '#10b981' : '#f59e0b'};">${finalPayRem === 0 ? '✓ $0.00 (Liquidada)' : formatMoney(finalPayRem)}</strong>
        </div>
        <div>
          • <strong>Lo que te debe ${escapeHtml(personRec)}:</strong> de <span style="color:#38bdf8;">${formatMoney(remRec)}</span> se reduce a <strong style="color:${finalRecRem === 0 ? '#10b981' : '#38bdf8'};">${finalRecRem === 0 ? '✓ $0.00 (Liquidada)' : formatMoney(finalRecRem)}</strong>
        </div>
        <div style="margin-top:0.5rem; font-size:0.75rem; color:#10b981; font-weight:700;">
          ⚡ No sale ni entra dinero físico de tus cuentas bancarias; se amortiza internamente en tu balance.
        </div>
      `;
    }
  };

  // --- ACCIONES DE INVERSIÓN ---

  window.finOpenNewInvestmentLog = function() {
    const form = document.getElementById('formNewInvestmentLog');
    if (form) form.reset();
    populateInvestmentModalSelects(cachedAccounts);

    const dateInput = document.getElementById('invDate');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    // Si ya hay cortes previos, sugerir el capital acumulado
    const capInput = document.getElementById('invInvestedCapital');
    if (capInput && cachedInvestments.length > 0) {
      const last = cachedInvestments[cachedInvestments.length - 1];
      capInput.value = (parseFloat(last.investedCapital) || 0).toFixed(2);
    }

    const previewBox = document.getElementById('invPreviewBox');
    if (previewBox) previewBox.style.display = 'none';

    window.finOpenModal('modalNewInvestmentLog');
  };

  window.finDeleteInvestmentLog = async function(id) {
    if (!confirm('¿Eliminar este corte de valuación de inversión?')) return;
    const res = await fetchWithAuth(`/api/admin/finance/investments/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const d = await res.json();
    if (res.ok && d.success) {
      loadAllFinanceData();
    } else {
      alert(d.error || 'Error al eliminar registro');
    }
  };

  window.finOpenNewAccount = function() {
    document.getElementById('formNewAccount').reset();
    document.getElementById('accId').value = '';
    document.getElementById('accType').value = 'bank';
    document.getElementById('modalAccountTitle').textContent = 'Nueva Billetera / Cuenta';
    document.getElementById('btnSubmitAccount').textContent = 'Crear Cuenta';
    window.finOpenModal('modalNewAccount');
  };

  window.finOpenNewCajita = function() {
    document.getElementById('formNewAccount').reset();
    document.getElementById('accId').value = '';
    document.getElementById('modalAccountTitle').textContent = 'Nueva Cajita Nu / Apartado';
    document.getElementById('accName').value = 'Cajita Nu - ';
    document.getElementById('accType').value = 'savings';
    document.getElementById('accDesc').value = 'Dinero apartado en Cajita Nu (Generando rendimientos, no gastable con tarjeta)';
    document.getElementById('btnSubmitAccount').textContent = 'Crear Cajita';
    window.finOpenModal('modalNewAccount');
    setTimeout(() => {
      const nameInput = document.getElementById('accName');
      if (nameInput) {
        nameInput.focus();
        nameInput.setSelectionRange(nameInput.value.length, nameInput.value.length);
      }
    }, 150);
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

  // --- EXPORTACIÓN DE CONTEXTO FINANCIERO COMPLETO PARA IA ---

  window.finOpenAiContextModal = async function() {
    const txtArea = document.getElementById('txtAiContextJson');
    const hint = document.getElementById('aiCopySuccessHint');
    if (hint) hint.style.display = 'none';

    // Generar estructura completa consolidada
    let netWorth = 0;
    let usableCashBank = 0;
    let cajitasNu = 0;
    let totalInvestments = 0;
    let totalCreditDebt = 0;

    const accountsStructured = cachedAccounts.map(a => {
      const bal = parseFloat(a.balance !== undefined ? a.balance : (a.currentBalance || 0));
      const debt = parseFloat(a.currentDebt || 0);
      const isCard = a.type === 'card' || a.type === 'credit';
      const isSavings = a.type === 'savings' || a.name.toLowerCase().includes('cajita');
      const isInv = a.type === 'investment';

      if (isCard) {
        totalCreditDebt += debt;
      } else {
        netWorth += bal;
        if (isSavings) cajitasNu += bal;
        else if (isInv) totalInvestments += bal;
        else usableCashBank += bal;
      }

      return {
        id: a.id,
        nombre: a.name,
        tipo: a.type,
        saldo_actual: bal,
        deuda_actual: isCard ? debt : 0,
        limite_credito: parseFloat(a.creditLimit || 0),
        descripcion: a.description || ''
      };
    });

    // Deudas pendientes
    let totalMeDeben = 0;
    let totalYoDebo = 0;
    const deudasStructured = cachedDebts.map(d => {
      const rem = parseFloat(d.remainingAmount || d.totalAmount || 0);
      if (d.status !== 'settled') {
        if (d.type === 'receivable') totalMeDeben += rem;
        else totalYoDebo += rem;
      }
      return {
        id: d.id,
        tipo: d.type === 'receivable' ? 'Me deben a favor' : 'Yo debo a terceros',
        persona: d.personName,
        concepto: d.concept || '',
        monto_original: parseFloat(d.totalAmount || 0),
        monto_pagado: parseFloat(d.paidAmount || 0),
        saldo_pendiente: rem,
        estado: d.status
      };
    });

    // Planes a plazos
    let totalInstallmentsDebt = 0;
    const planesStructured = cachedInstallments.map(inst => {
      const totalAmt = parseFloat(inst.totalAmount || 0);
      const quota = parseFloat(inst.quotaAmount || 0);
      const paidQ = parseInt(inst.paidQuotas || 0);
      const totalQ = parseInt(inst.totalQuotas || 1);
      const remainingAmt = Math.max(0, parseFloat((totalAmt - (paidQ * quota)).toFixed(2)));
      if (inst.status !== 'completed') {
        totalInstallmentsDebt += remainingAmt;
      }
      return {
        id: inst.id,
        titulo: inst.title,
        tarjeta_origen: inst.accountName,
        total_a_pagar: totalAmt,
        cuota_mensual: quota,
        cuotas_cubiertas: `${paidQ}/${totalQ}`,
        restante_por_pagar: remainingAmt,
        dia_de_pago: inst.dueDay,
        estado: inst.status,
        notas: inst.notes || ''
      };
    });

    // Inversiones
    let capitalInvertidoTotal = 0;
    let valorPortafolioTotal = 0;
    let plusvaliaTotal = 0;
    if (cachedInvestments.length > 0) {
      const lastInv = cachedInvestments[cachedInvestments.length - 1];
      capitalInvertidoTotal = parseFloat(lastInv.investedCapital || 0);
      valorPortafolioTotal = parseFloat(lastInv.currentValue || 0);
      plusvaliaTotal = parseFloat(lastInv.netReturn || 0);
    }

    const aiContextObject = {
      _instrucciones_para_la_ia: "Este es el estado financiero integral de Ángel. Úsalo como contexto para darle recomendaciones, responder consultas sobre su liquidez, flujos, pagos y presupuestos.",
      fecha_extraccion: new Date().toISOString(),
      resumen_patrimonial_mxn: {
        patrimonio_neto_liquido_total: parseFloat(netWorth.toFixed(2)),
        efectivo_y_debito_usable: parseFloat(usableCashBank.toFixed(2)),
        apartado_cajitas_nu: parseFloat(cajitasNu.toFixed(2)),
        portafolio_inversiones_total: parseFloat(valorPortafolioTotal.toFixed(2)),
        deuda_tarjetas_credito: parseFloat(totalCreditDebt.toFixed(2)),
        deuda_planes_plazos_restante: parseFloat(totalInstallmentsDebt.toFixed(2)),
        deudas_que_debo_a_personas: parseFloat(totalYoDebo.toFixed(2)),
        deudas_a_mi_favor_por_cobrar: parseFloat(totalMeDeben.toFixed(2))
      },
      carteras_y_cuentas: accountsStructured,
      tarjetas_y_planes_a_meses: planesStructured,
      deudas_y_prestamos: deudasStructured,
      inversiones_y_rendimientos: {
        capital_acumulado_invertido: capitalInvertidoTotal,
        valor_actual_portafolio: valorPortafolioTotal,
        resultado_pl: plusvaliaTotal,
        es_plusvalia: plusvaliaTotal >= 0,
        porcentaje_rendimiento: capitalInvertidoTotal > 0 ? parseFloat(((plusvaliaTotal / capitalInvertidoTotal) * 100).toFixed(2)) : 0,
        historial_cortes: cachedInvestments.map(i => ({
          fecha: i.date,
          plataforma: i.platform,
          capital_invertido: parseFloat(i.investedCapital),
          valor_corte: parseFloat(i.currentValue),
          inyeccion: parseFloat(i.injectedAmount || 0),
          plusvalia_minusvalia: parseFloat(i.netReturn || 0),
          rendimiento_pct: parseFloat(i.returnPercentage || 0),
          notas: i.notes || ''
        }))
      }
    };

    const jsonString = JSON.stringify(aiContextObject, null, 2);
    if (txtArea) txtArea.value = jsonString;

    // Intentar copiar automáticamente al portapapeles de una vez
    try {
      await navigator.clipboard.writeText(jsonString);
      if (hint) {
        hint.style.display = 'inline';
        hint.textContent = '✅ ¡Copiado al portapapeles automáticamente!';
      }
    } catch (e) {
      if (hint) {
        hint.style.display = 'inline';
        hint.textContent = '💡 Presiona el botón azul para copiar.';
      }
    }

    window.finOpenModal('modalAiContext');
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
        let actualPayAmount = totalAmount;

        if (mode === 'split') {
          const cashAmount = parseFloat(document.getElementById('txSplitCash').value) || 0;
          const bankAmount = parseFloat(document.getElementById('txSplitBank').value) || 0;
          const splitAcc = document.getElementById('txSplitAccount').value;

          splits = [
            { account: 'Efectivo / Caja', amount: cashAmount },
            { account: splitAcc, amount: bankAmount }
          ];
          account = null;
          // El abono real a la deuda debe ser la suma exacta de lo que se dio
          actualPayAmount = cashAmount + bankAmount;
        }

        // Si hay una deuda seleccionada de la base de datos, liquidarla o abonar
        if (debtId) {
          const resDebt = await fetchWithAuth(`/api/admin/finance/debts/${encodeURIComponent(debtId)}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: actualPayAmount, account, splits })
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

      // 2.B: Si es Abono / Pago a Tarjeta de Crédito o Plan a Meses
      if (type === 'pay_credit') {
        const instVal = document.getElementById('txInstallmentId').value;
        const mode = document.getElementById('txPaymentMode')?.value || 'single';
        let account = document.getElementById('txAccount').value;
        let splits = null;
        let actualPayAmount = totalAmount;

        if (mode === 'split') {
          const cashAmount = parseFloat(document.getElementById('txSplitCash').value) || 0;
          const bankAmount = parseFloat(document.getElementById('txSplitBank').value) || 0;
          const splitAcc = document.getElementById('txSplitAccount').value;
          splits = [
            { account: 'Efectivo / Caja', amount: cashAmount },
            { account: splitAcc, amount: bankAmount }
          ];
          account = null;
          actualPayAmount = cashAmount + bankAmount;
        }

        // Si es un plan de cuotas existente
        if (instVal && !instVal.startsWith('card_')) {
          const matchedPlan = cachedInstallments.find(i => i.id === instVal);
          const totalAmt = matchedPlan ? parseFloat(matchedPlan.totalAmount) : 0;
          const quotaVal = matchedPlan ? (parseFloat(matchedPlan.quotaAmount) || 1) : 1;
          const remQuotas = matchedPlan ? Math.max(1, (matchedPlan.totalQuotas || 0) - (matchedPlan.paidQuotas || 0)) : 1;
          
          // Determinar cuántas cuotas cubre el monto ingresado
          let quotasToPay = 1;
          if (matchedPlan && actualPayAmount >= (quotaVal * 1.5)) {
            quotasToPay = Math.min(remQuotas, Math.max(1, Math.round(actualPayAmount / quotaVal)));
          }

          const payAcc = splits ? splits.map(s => `${s.account} ($${s.amount})`).join(' + ') : account;
          const resInst = await fetchWithAuth(`/api/admin/finance/installments/${encodeURIComponent(instVal)}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              quotas: quotasToPay, 
              amount: actualPayAmount,
              account: payAcc 
            })
          });
          const dInst = await resInst.json();
          if (resInst.ok && dInst.success) {
            window.finCloseModal('modalManualTx');
            formManualTx.reset();
            window.finToggleTxFields();
            loadAllFinanceData();
            return;
          } else {
            alert(dInst.error || 'Error al pagar cuota de tarjeta');
            return;
          }
        } else {
          // Abono directo a tarjeta de crédito para amortizar la deuda (traspaso o gasto que amortiza la tarjeta)
          const targetCard = instVal.startsWith('card_') ? instVal.replace('card_', '') : 'Nu';
          let payload = {};
          if (splits) {
            payload = {
              type: 'expense_manual',
              category: 'servicios',
              serviceName: concept || `Abono a Tarjeta de Crédito`,
              notes: concept || `Abono directo para reducir deuda de tarjeta de crédito`,
              splits
            };
          } else {
            // Transferencia de cuenta origen (débito/efectivo) hacia la tarjeta para amortizar su deuda
            payload = {
              type: 'transfer',
              costAmount: actualPayAmount,
              account: account,
              destAccount: targetCard,
              serviceName: concept || `Abono a Tarjeta de Crédito`,
              notes: concept || `Abono directo para reducir deuda de tarjeta de crédito`,
              category: 'servicios'
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
            alert(d.error || 'Error al registrar abono');
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
      } else if (type === 'server_recharge') {
        const account = document.getElementById('txAccount').value;
        payload = {
          type: 'transfer',
          category: 'servidores',
          serviceName: concept || 'Recarga de Saldo a Servidor GSM',
          notes: concept || `Recarga a Servidor GSM financiada con fondos de ${account}`,
          costAmount: totalAmount,
          account: account,
          destAccount: 'Server (DHRU / Fondos)'
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

      const cardSel = document.getElementById('instCard');
      const selectedCardOpt = cardSel?.selectedOptions[0];
      const accountId = selectedCardOpt?.getAttribute('data-id') || undefined;
      const depositAccount = document.getElementById('instDepositAccount')?.value || 'none';

      const payload = {
        title: document.getElementById('instTitle').value.trim(),
        totalAmount: total,
        netReceived: net,
        depositAccount: depositAccount,
        totalQuotas: quotas,
        accountId: accountId,
        accountName: cardSel ? cardSel.value : 'Nu Tarjeta / Crédito',
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

  // --- SECCIÓN: CAJA NEGRA AUDIT LOG ---
  window.finLoadAuditLogs = async function() {
    const tbody = document.getElementById('finAuditTbody');
    if (!tbody) return;

    try {
      const res = await fetchWithAuth('/api/admin/audit-logs?limit=50');
      const d = await res.json();
      if (!res.ok || !d.success) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:#f43f5e;">Error al consultar registros de la caja negra.</td></tr>';
        return;
      }

      const logs = d.logs || [];
      if (!logs.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--fin-text-muted);">No hay eventos registrados en la caja negra aún.</td></tr>';
        return;
      }

      tbody.innerHTML = logs.map(l => {
        const dateStr = l.timestamp ? new Date(l.timestamp).toLocaleDateString('es-MX', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' }) : '-';
        const isRevert = l.event && l.event.includes('REVERT');
        const isDelete = l.event && l.event.includes('DELETE');
        const badgeColor = isRevert ? '#f59e0b' : (isDelete ? '#f43f5e' : '#10b981');
        const badgeBg = isRevert ? 'rgba(245, 158, 11, 0.15)' : (isDelete ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)');

        // Formatear detalles en resumen legible
        let detailsHtml = '';
        if (l.details) {
          const dObj = l.details;
          const pieces = [];
          if (dObj.serviceName) pieces.push(`<strong>${escapeHtml(dObj.serviceName)}</strong>`);
          if (dObj.concept) pieces.push(`Concepto: <strong>${escapeHtml(dObj.concept)}</strong>`);
          if (dObj.title) pieces.push(`Plan: <strong>${escapeHtml(dObj.title)}</strong>`);
          if (dObj.personName) pieces.push(`Persona: <strong>${escapeHtml(dObj.personName)}</strong>`);
          if (dObj.account) pieces.push(`Cuenta: <code>${escapeHtml(dObj.account)}</code>`);
          if (dObj.accountName) pieces.push(`Tarjeta: <code>${escapeHtml(dObj.accountName)}</code>`);
          if (dObj.chargedAmount !== undefined && dObj.chargedAmount > 0) pieces.push(`Cobrado: <span style="color:#10b981;">${formatMoney(dObj.chargedAmount)}</span>`);
          if (dObj.costAmount !== undefined && dObj.costAmount > 0) pieces.push(`Costo/Gasto: <span style="color:#f43f5e;">${formatMoney(dObj.costAmount)}</span>`);
          if (dObj.appliedAmount !== undefined) pieces.push(`Abono: <span style="color:#10b981;">${formatMoney(dObj.appliedAmount)}</span>`);
          if (dObj.totalAmount !== undefined) pieces.push(`Total: <strong>${formatMoney(dObj.totalAmount)}</strong>`);
          if (dObj.notes) pieces.push(`<span style="color:var(--fin-text-sub);">${escapeHtml(dObj.notes)}</span>`);
          if (dObj.deletedTransaction) pieces.push(`<span style="color:#f43f5e;">Tx Revertida: ${escapeHtml(dObj.deletedTransaction.serviceName || dObj.deletedTransaction.id)}</span>`);
          if (dObj.deletedInstallment) pieces.push(`<span style="color:#f43f5e;">Plan Revertido: ${escapeHtml(dObj.deletedInstallment.title)} (${formatMoney(dObj.deletedInstallment.totalAmount)})</span>`);
          if (dObj.deletedDebt) pieces.push(`<span style="color:#f43f5e;">Deuda Eliminada: ${escapeHtml(dObj.deletedDebt.personName)} (${formatMoney(dObj.deletedDebt.totalAmount)})</span>`);
          
          detailsHtml = pieces.length ? pieces.join(' • ') : `<pre style="margin:0; font-size:0.75rem; color:#94a3b8;">${escapeHtml(JSON.stringify(dObj, null, 1))}</pre>`;
        }

        const shortHash = l.entryHash ? l.entryHash.substring(0, 8) + '...' : '-';

        return `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
            <td style="padding: 10px 12px; color:var(--fin-text-muted); font-size:0.78rem;">${dateStr}</td>
            <td style="padding: 10px 12px;">
              <span class="fin-badge" style="background:${badgeBg}; color:${badgeColor}; font-size:0.75rem;">
                ${escapeHtml(l.event || 'EVENT')}
              </span>
            </td>
            <td style="padding: 10px 12px; font-size:0.82rem; color:#f8fafc;">
              ${detailsHtml}
            </td>
            <td style="padding: 10px 12px; color:var(--fin-text-muted); font-size:0.8rem;">${escapeHtml(l.author || 'SYSTEM')}</td>
            <td style="padding: 10px 12px; text-align:right; font-family:monospace; font-size:0.75rem; color:#10b981;" title="${escapeHtml(l.entryHash || '')}">
              ${shortHash}
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('[LOAD AUDIT LOGS ERR]', err);
    }
  };

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
          if (targetId === 'tab-audit') {
            window.finLoadAuditLogs();
          }
        }
        if (window.lucide) lucide.createIcons();
      });
    });
  }

  // Inicializar al cargar
  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initSplitSyncListeners();
    loadAllFinanceData();

    const btnNewAcc = document.getElementById('btnFinNewAccount');
    if (btnNewAcc) {
      btnNewAcc.addEventListener('click', () => window.finOpenNewAccount());
    }
    const btnNewCajita = document.getElementById('btnFinNewCajita');
    if (btnNewCajita) {
      btnNewCajita.addEventListener('click', () => window.finOpenNewCajita());
    }

    // Modal de inversiones
    const btnNewInv = document.getElementById('btnFinNewInvestmentLog');
    if (btnNewInv) {
      btnNewInv.addEventListener('click', () => window.finOpenNewInvestmentLog());
    }

    // Preview de Plusvalía / Minusvalía al escribir en el modal de inversión
    const invCurInput = document.getElementById('invCurrentValue');
    const invCapInput = document.getElementById('invInvestedCapital');
    const invInjInput = document.getElementById('invInjectedAmount');
    const previewBox = document.getElementById('invPreviewBox');
    const previewRet = document.getElementById('invPreviewReturn');
    const previewPct = document.getElementById('invPreviewPct');

    function updateInvPreview() {
      if (!invCurInput || !previewBox) return;
      const cur = parseFloat(invCurInput.value) || 0;
      let cap = parseFloat(invCapInput?.value) || 0;
      const inj = parseFloat(invInjInput?.value) || 0;

      if (!cap && cachedInvestments.length > 0) {
        const last = cachedInvestments[cachedInvestments.length - 1];
        cap = (parseFloat(last.investedCapital) || 0) + inj;
      } else if (!cap && inj > 0) {
        cap = inj;
      }

      if (cur > 0 && cap > 0) {
        const diff = cur - cap;
        const pct = cap > 0 ? ((diff / cap) * 100).toFixed(2) : 0;
        previewBox.style.display = 'block';
        if (previewRet) {
          previewRet.textContent = `${diff >= 0 ? '+' : ''}${formatMoney(diff)}`;
          previewRet.style.color = diff >= 0 ? '#10b981' : '#f43f5e';
        }
        if (previewPct) {
          previewPct.textContent = `${diff >= 0 ? 'Plusvalía' : 'Minusvalía'}: ${diff >= 0 ? '+' : ''}${pct}%`;
          previewPct.style.color = diff >= 0 ? '#10b981' : '#f43f5e';
        }
      } else {
        previewBox.style.display = 'none';
      }
    }

    if (invCurInput) invCurInput.addEventListener('input', updateInvPreview);
    if (invCapInput) invCapInput.addEventListener('input', updateInvPreview);
    if (invInjInput) invInjInput.addEventListener('input', updateInvPreview);

    // Envío del formulario de inversión
    const formInv = document.getElementById('formNewInvestmentLog');
    if (formInv) {
      formInv.addEventListener('submit', async (e) => {
        e.preventDefault();
        const accSel = document.getElementById('invAccountId');
        const accId = accSel.value;
        const accName = accSel.selectedOptions[0]?.getAttribute('data-name') || 'Revolut Cuenta Inversión';
        const date = document.getElementById('invDate').value;
        const currentValue = parseFloat(document.getElementById('invCurrentValue').value) || 0;
        const investedCapitalVal = document.getElementById('invInvestedCapital').value;
        const investedCapital = investedCapitalVal ? parseFloat(investedCapitalVal) : null;
        const injectedAmount = parseFloat(document.getElementById('invInjectedAmount').value) || 0;
        const sourceAccount = document.getElementById('invSourceAccount').value;
        const notes = document.getElementById('invNotes').value.trim();

        const payload = {
          accountId: accId,
          accountName: accName,
          date,
          currentValue,
          investedCapital,
          injectedAmount,
          sourceAccount: sourceAccount || null,
          platform: accName.toLowerCase().includes('revolut') ? 'Revolut' : (accName.toLowerCase().includes('cetes') ? 'CetesDirecto' : 'Inversión'),
          notes
        };

        try {
          const res = await fetchWithAuth('/api/admin/finance/investments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const d = await res.json();
          if (res.ok && d.success) {
            window.finCloseModal('modalNewInvestmentLog');
            formInv.reset();
            loadAllFinanceData();
          } else {
            alert(d.error || 'Error al guardar corte de inversión');
          }
        } catch (err) {
          alert('Error de conexión al registrar inversión');
        }
      });
    }

    // Botón superior de Copiar Contexto IA
    const btnCopyAi = document.getElementById('btnFinCopyAiContext');
    if (btnCopyAi) {
      btnCopyAi.addEventListener('click', () => window.finOpenAiContextModal());
    }

    // Botón dentro del modal para copiar al portapapeles
    const btnConfirmCopy = document.getElementById('btnConfirmCopyAiJson');
    if (btnConfirmCopy) {
      btnConfirmCopy.addEventListener('click', async () => {
        const txtArea = document.getElementById('txtAiContextJson');
        const hint = document.getElementById('aiCopySuccessHint');
        if (txtArea) {
          try {
            await navigator.clipboard.writeText(txtArea.value);
            if (hint) {
              hint.style.display = 'inline';
              hint.textContent = '✅ ¡Copiado al portapapeles exitosamente!';
            }
          } catch (e) {
            txtArea.select();
            document.execCommand('copy');
            if (hint) {
              hint.style.display = 'inline';
              hint.textContent = '✅ ¡Copiado!';
            }
          }
        }
      });
    }
    // Botón para abrir modal de Cruce / Tabulación de Deudas
    const btnCrossOffset = document.getElementById('btnFinCrossOffsetDebt');
    if (btnCrossOffset) {
      btnCrossOffset.addEventListener('click', () => window.finOpenCrossOffsetDebtModal());
    }

    // Submit de Cruce / Compensación de Deudas
    const formCrossOffset = document.getElementById('formCrossOffsetDebt');
    if (formCrossOffset) {
      formCrossOffset.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payableId = document.getElementById('offsetPayableId').value;
        const receivableId = document.getElementById('offsetReceivableId').value;
        const amount = parseFloat(document.getElementById('offsetAmount').value) || 0;
        const notes = document.getElementById('offsetNotes').value.trim();

        if (amount <= 0) {
          alert('El monto a cruzar debe ser mayor a 0');
          return;
        }

        try {
          const res = await fetchWithAuth('/api/admin/finance/debts/cross-offset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payableId, receivableId, amount, notes })
          });
          const d = await res.json();
          if (res.ok && d.success) {
            alert(`✅ Compensación aplicada con éxito por ${formatMoney(d.offsetAmount)}.\nSe amortizaron ambas deudas sin requerir salida de efectivo.`);
            window.finCloseModal('modalCrossOffsetDebt');
            formCrossOffset.reset();
            loadAllFinanceData();
          } else {
            alert(d.error || 'Error al aplicar compensación de deudas');
          }
        } catch (err) {
          alert('Error de conexión al procesar compensación');
        }
      });
    }
    // Botón para refrescar servidores
    const btnRefServers = document.getElementById('btnFinRefreshServers');
    if (btnRefServers) {
      btnRefServers.addEventListener('click', async () => {
        btnRefServers.innerHTML = '<i data-lucide="loader" style="width:13px; height:13px; animation:spin 1s linear infinite;"></i> Consultando...';
        await loadAllFinanceData();
        btnRefServers.innerHTML = '<i data-lucide="refresh-cw" style="width:13px; height:13px;"></i> Actualizar Servidores';
        if (window.lucide) lucide.createIcons();
      });
    }
  });
})();
