const sqliteDb = require('./database');
const { readDB, writeDB } = require('./db');
const { logAuditTrail, createAutoBackup } = require('./backupEngine');

/**
 * Obtener configuración de finanzas (cuentas disponibles, % reinversión por defecto, etc.)
 */
function getFinanceConfig() {
  const settings = readDB('settings.json') || {};
  return {
    reinvestPercent: parseFloat(settings.financeReinvestPercent !== undefined ? settings.financeReinvestPercent : 50),
    accounts: Array.isArray(settings.financeAccounts) && settings.financeAccounts.length > 0 
      ? settings.financeAccounts 
      : ['Nu', 'Revolut', 'Mercado Pago', 'BBVA', 'Efectivo', 'General'],
    targetGoals: settings.financeGoals || { monthlyTarget: 10000, emergencyFund: 5000 }
  };
}

/**
 * Actualizar configuración de finanzas
 */
function updateFinanceConfig(config) {
  const settings = readDB('settings.json') || {};
  if (config.reinvestPercent !== undefined) {
    settings.financeReinvestPercent = Math.max(0, Math.min(100, parseFloat(config.reinvestPercent) || 50));
  }
  if (Array.isArray(config.accounts)) {
    settings.financeAccounts = config.accounts.map(a => String(a).trim()).filter(Boolean);
  }
  if (config.targetGoals) {
    settings.financeGoals = { ...config.targetGoals };
  }
  writeDB('settings.json', settings);
  return getFinanceConfig();
}



/**
 * Obtener estadísticas globales y balances por cuenta bancaria
 */
/**
 * Inicializar cuentas por defecto si la tabla está vacía
 */
function initDefaultAccounts() {
  const count = sqliteDb.prepare('SELECT COUNT(*) as count FROM FinanceAccounts').get().count;
  if (count === 0) {
    const defaults = [
      { id: 'acc_nu', name: 'Nu Crédito / Débito', type: 'card', currency: 'MXN', color: '#820ad1', icon: 'credit-card', description: 'Tarjeta Nu y Cuenta de Ahorro' },
      { id: 'acc_revolut', name: 'Revolut', type: 'bank', currency: 'USD', color: '#0075eb', icon: 'globe', description: 'Cuenta Internacional Revolut' },
      { id: 'acc_bbva', name: 'BBVA', type: 'bank', currency: 'MXN', color: '#004481', icon: 'landmark', description: 'Banca BBVA Nómina / Débito' },
      { id: 'acc_mp', name: 'Mercado Pago', type: 'bank', currency: 'MXN', color: '#009ee3', icon: 'smartphone', description: 'Billetera Mercado Pago' },
      { id: 'acc_emergency', name: 'Fondo de Emergencia', type: 'emergency', currency: 'MXN', color: '#ef4444', icon: 'shield-alert', description: 'Tarjeta / Cuenta intocable para emergencias' },
      { id: 'acc_investment', name: 'Cuenta Inversión', type: 'investment', currency: 'MXN', color: '#10b981', icon: 'trending-up', description: 'Cetes / Fondos de Inversión y Ganancias' },
      { id: 'acc_cash', name: 'Efectivo / Caja', type: 'cash', currency: 'MXN', color: '#f59e0b', icon: 'banknote', description: 'Efectivo en mano y caja chica' },
      { id: 'acc_server', name: 'Server (DHRU / Fondos)', type: 'bank', currency: 'MXN', color: '#6366f1', icon: 'server', description: 'Saldo en servidores para pedidos' }
    ];
    const insertStmt = sqliteDb.prepare(`
      INSERT INTO FinanceAccounts (id, name, type, currency, initialBalance, currentBalance, color, icon, description, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    const insertTx = sqliteDb.transaction((accs) => {
      for (const a of accs) {
        insertStmt.run(a.id, a.name, a.type, a.currency, 0, 0, a.color, a.icon, a.description);
      }
    });
    insertTx(defaults);
  }
}
initDefaultAccounts();

/**
 * Obtener todas las cuentas financieras
 */
function getAllAccounts() {
  initDefaultAccounts();
  return sqliteDb.prepare(`
    SELECT * FROM FinanceAccounts WHERE isArchived = 0 ORDER BY 
      CASE type 
        WHEN 'bank' THEN 1 
        WHEN 'savings' THEN 2
        WHEN 'card' THEN 3 
        WHEN 'emergency' THEN 4 
        WHEN 'investment' THEN 5 
        WHEN 'cash' THEN 6 
        ELSE 7 
      END, name ASC
  `).all();
}

/**
 * Crear o editar una cuenta bancaria / tarjeta / inversión
 */
function saveAccount(accData) {
  initDefaultAccounts();
  const id = accData.id || ('acc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
  const name = String(accData.name || '').trim();
  if (!name) throw new Error('El nombre de la cuenta o tarjeta es obligatorio');

  const type = accData.type || 'bank';
  const currency = accData.currency || 'MXN';
  const rawBalance = accData.currentBalance !== undefined 
    ? parseFloat(accData.currentBalance) 
    : (accData.balance !== undefined ? parseFloat(accData.balance) : parseFloat(accData.initialBalance) || 0);
  const initialBalance = parseFloat(accData.initialBalance) || rawBalance || 0;
  const currentBalance = rawBalance || 0;
  const color = accData.color || (type === 'credit' ? '#8218fc' : (type === 'savings' ? '#ec4899' : '#38bdf8'));
  const icon = accData.icon || (type === 'credit' ? 'credit-card' : (type === 'savings' ? 'archive' : 'wallet'));
  const description = accData.description || '';

  // Credit Card fields
  const creditLimit = Math.max(0, parseFloat(accData.creditLimit) || 0);
  const cutoffDay = Math.max(0, Math.min(31, parseInt(accData.cutoffDay) || 0));
  const paymentDueDay = Math.max(0, Math.min(31, parseInt(accData.paymentDueDay) || 0));
  const currentDebt = Math.max(0, parseFloat(accData.currentDebt !== undefined ? accData.currentDebt : accData.debt) || 0);
  const minPayment = Math.max(0, parseFloat(accData.minPayment) || 0);

  // Comprobar si existe por ID o por Nombre (incluso si estaba archivada)
  const existingById = sqliteDb.prepare('SELECT * FROM FinanceAccounts WHERE id = ?').get(id);
  const existingByName = sqliteDb.prepare('SELECT * FROM FinanceAccounts WHERE LOWER(name) = LOWER(?)').get(name);
  const target = existingById || existingByName;

  let savedAccount = null;
  if (target) {
    sqliteDb.prepare(`
      UPDATE FinanceAccounts 
      SET name = ?, type = ?, currency = ?, currentBalance = ?, color = ?, icon = ?, description = ?,
          creditLimit = ?, cutoffDay = ?, paymentDueDay = ?, currentDebt = ?, minPayment = ?,
          isArchived = 0, updatedAt = datetime('now')
      WHERE id = ?
    `).run(name, type, currency, currentBalance, color, icon, description, creditLimit, cutoffDay, paymentDueDay, currentDebt, minPayment, target.id);
    savedAccount = sqliteDb.prepare('SELECT * FROM FinanceAccounts WHERE id = ?').get(target.id);
    logAuditTrail('FINANCE_ACCOUNT_UPDATED', { id: target.id, name, type, currentBalance, creditLimit, previous: target }, 'Admin');
  } else {
    sqliteDb.prepare(`
      INSERT INTO FinanceAccounts (id, name, type, currency, initialBalance, currentBalance, color, icon, description, creditLimit, cutoffDay, paymentDueDay, currentDebt, minPayment, isArchived, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
    `).run(id, name, type, currency, initialBalance, currentBalance, color, icon, description, creditLimit, cutoffDay, paymentDueDay, currentDebt, minPayment);
    savedAccount = sqliteDb.prepare('SELECT * FROM FinanceAccounts WHERE id = ?').get(id);
    logAuditTrail('FINANCE_ACCOUNT_CREATED', { id, name, type, initialBalance, creditLimit }, 'Admin');
  }
  return savedAccount;
}

/**
 * Eliminar / archivar cuenta
 */
function deleteAccount(id) {
  const existing = sqliteDb.prepare('SELECT * FROM FinanceAccounts WHERE id = ?').get(id);
  const stmt = sqliteDb.prepare("UPDATE FinanceAccounts SET isArchived = 1, updatedAt = datetime('now') WHERE id = ?");
  const res = stmt.run(id);
  if (res.changes > 0) {
    logAuditTrail('FINANCE_ACCOUNT_ARCHIVED', { id, name: existing?.name, balance: existing?.currentBalance }, 'Admin');
  }
  return res.changes > 0;
}

/**
 * Registrar un movimiento contable (Gastos personales, comida, pasajes, gustos, o ventas)
 */
function recordTransaction(data) {
  initDefaultAccounts();
  const config = getFinanceConfig();
  const chargedAmount = Math.max(0, parseFloat(data.chargedAmount) || 0);
  const costAmount = Math.max(0, parseFloat(data.costAmount) || 0);
  const type = data.type || (data.orderId ? 'income_ticket' : (costAmount > 0 && chargedAmount === 0 ? 'expense_manual' : 'income_manual'));
  
  let grossProfit = 0;
  if (type === 'expense_manual') {
    grossProfit = -costAmount;
  } else if (type === 'transfer') {
    grossProfit = 0; // Traspaso entre cuentas propias
  } else {
    grossProfit = chargedAmount - costAmount;
  }

  // Idempotencia: evitar registrar dos veces el mismo cobro de un ticket/orden si ya existe en el ledger
  if (data.orderId && type === 'income_ticket') {
    const existingTicketTx = sqliteDb.prepare(`
      SELECT * FROM FinanceLedger WHERE orderId = ? AND type = 'income_ticket' LIMIT 1
    `).get(String(data.orderId));
    if (existingTicketTx) {
      return existingTicketTx; // Ya registrado previamente, no duplicar saldo
    }
  }

  // Soporte de Pagos Divididos / Conexión de Gastos Multi-Cuenta (Ej: parte en efectivo y parte en transferencia o tarjeta)
  if (Array.isArray(data.splits) && data.splits.length > 0) {
    const parentNotes = data.notes || data.serviceName || 'Gasto Dividido';
    const recordedEntries = [];
    data.splits.forEach((split, index) => {
      const splitAmount = Math.max(0, parseFloat(split.amount) || 0);
      if (splitAmount > 0) {
        const splitAcc = split.account || data.account || 'Efectivo / Caja';
        const entry = recordTransaction({
          ...data,
          splits: null, // Evitar recursión
          costAmount: data.type === 'expense_manual' || (data.costAmount > 0 && !data.chargedAmount) ? splitAmount : 0,
          chargedAmount: data.type === 'income_manual' || (data.chargedAmount > 0 && !data.costAmount) ? splitAmount : 0,
          account: splitAcc,
          notes: `${parentNotes} [División ${index + 1}/${data.splits.length}: $${splitAmount.toFixed(2)} vía ${splitAcc}]`,
          serviceName: data.serviceName ? `${data.serviceName} (Parte ${index + 1})` : parentNotes
        });
        recordedEntries.push(entry);
      }
    });
    return { success: true, count: recordedEntries.length, entries: recordedEntries };
  }

  const isBusinessSale = (type === 'income_ticket' || category === 'servidores' || category === 'ventas');
  const reinvestPercent = isBusinessSale 
    ? (data.reinvestPercent !== undefined ? Math.max(0, Math.min(100, parseFloat(data.reinvestPercent))) : config.reinvestPercent)
    : 0;

  let reinvestAmount = 0;
  let netProfit = 0;

  if (grossProfit > 0) {
    reinvestAmount = isBusinessSale ? Math.round((grossProfit * (reinvestPercent / 100)) * 100) / 100 : 0;
    netProfit = Math.round((grossProfit - reinvestAmount) * 100) / 100;
  } else {
    reinvestAmount = 0;
    netProfit = grossProfit;
  }

  const account = data.account ? String(data.account).trim() : 'General';
  const destAccount = data.destAccount ? String(data.destAccount).trim() : null;
  const category = data.category ? String(data.category).toLowerCase().trim() : 'servicios';
  const id = 'fin_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const createdAt = data.createdAt || new Date().toISOString();

  const stmt = sqliteDb.prepare(`
    INSERT INTO FinanceLedger (
      id, type, orderId, serviceName, chargedAmount, costAmount,
      grossProfit, reinvestPercent, reinvestAmount, netProfit,
      account, destAccount, category, notes, recordedBy, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    type,
    data.orderId ? String(data.orderId) : null,
    data.serviceName ? String(data.serviceName).trim() : (data.notes || 'Operación'),
    chargedAmount,
    costAmount,
    grossProfit,
    reinvestPercent,
    reinvestAmount,
    netProfit,
    account,
    destAccount,
    category,
    data.notes || '',
    data.recordedBy || 'admin',
    createdAt
  );

  // Actualizar saldo dinámico de la cuenta en FinanceAccounts si existe
  try {
    const findAcc = (accName) => {
      if (!accName) return null;
      const clean = String(accName).trim();
      // 1. Coincidencia exacta por ID o Nombre exacto (no archivada)
      let found = sqliteDb.prepare(`
        SELECT id, name, type, isArchived FROM FinanceAccounts 
        WHERE (id = ? OR LOWER(name) = LOWER(?)) AND isArchived = 0
        LIMIT 1
      `).get(clean, clean);
      if (found) return found;

      // 2. Si el usuario pide débito / cuenta o tarjeta específicamente
      const lower = clean.toLowerCase();
      if (lower.includes('débito') || lower.includes('debito') || lower.includes('cuenta')) {
        found = sqliteDb.prepare(`
          SELECT id, name, type, isArchived FROM FinanceAccounts 
          WHERE (LOWER(name) LIKE '%débito%' OR LOWER(name) LIKE '%debito%' OR (LOWER(name) LIKE '%nu%' AND type = 'bank'))
            AND isArchived = 0
          LIMIT 1
        `).get();
        if (found) return found;
      }
      if (lower.includes('tarjeta') || lower.includes('crédito') || lower.includes('credito')) {
        found = sqliteDb.prepare(`
          SELECT id, name, type, isArchived FROM FinanceAccounts 
          WHERE (LOWER(name) LIKE '%crédito%' OR LOWER(name) LIKE '%credito%' OR (LOWER(name) LIKE '%nu%' AND type = 'card'))
            AND isArchived = 0
          LIMIT 1
        `).get();
        if (found) return found;
      }

      // 3. Coincidencia parcial general en cuentas no archivadas (priorizando cuentas bancarias de depósito si es un ingreso)
      found = sqliteDb.prepare(`
        SELECT id, name, type, isArchived FROM FinanceAccounts 
        WHERE isArchived = 0 AND (name LIKE ? OR ? LIKE ('%' || name || '%'))
        ORDER BY CASE WHEN type = 'bank' THEN 1 WHEN type = 'cash' THEN 2 ELSE 3 END
        LIMIT 1
      `).get(`%${clean}%`, clean);
      if (found) return found;

      // 4. Fallback si estuviera archivada
      return sqliteDb.prepare(`
        SELECT id, name, type, isArchived FROM FinanceAccounts 
        WHERE id = ? OR name = ? OR name LIKE ? OR ? LIKE ('%' || name || '%')
        LIMIT 1
      `).get(clean, clean, `%${clean}%`, clean);
    };

    const targetOrigin = findAcc(account);
    const targetDest = destAccount ? findAcc(destAccount) : null;

    if (type === 'expense_manual') {
      if (targetOrigin) {
        // Si es tarjeta de crédito, un gasto aumenta la deuda
        sqliteDb.prepare(`
          UPDATE FinanceAccounts 
          SET currentBalance = currentBalance - ?,
              currentDebt = CASE WHEN type IN ('card', 'credit') THEN currentDebt + ? ELSE currentDebt END,
              updatedAt = datetime('now') 
          WHERE id = ?
        `).run(costAmount, costAmount, targetOrigin.id);
      }
    } else if (type === 'income_ticket' || type === 'income_manual') {
      if (targetOrigin) {
        // Si entra dinero a una tarjeta de crédito, amortiza la deuda
        sqliteDb.prepare(`
          UPDATE FinanceAccounts 
          SET currentBalance = currentBalance + ?,
              currentDebt = CASE WHEN type IN ('card', 'credit') THEN MAX(0, currentDebt - ?) ELSE currentDebt END,
              updatedAt = datetime('now') 
          WHERE id = ?
        `).run(chargedAmount, chargedAmount, targetOrigin.id);
      }
    } else if (type === 'adjustment') {
      if (targetOrigin) {
        // En un ajuste/reembolso, chargedAmount es negativo o el monto reembolsado; descontar de la cuenta
        const refundAmt = Math.abs(parseFloat(data.chargedAmount) || 0);
        sqliteDb.prepare(`
          UPDATE FinanceAccounts 
          SET currentBalance = currentBalance - ?,
              currentDebt = CASE WHEN type IN ('card', 'credit') THEN currentDebt + ? ELSE currentDebt END,
              updatedAt = datetime('now') 
          WHERE id = ?
        `).run(refundAmt, refundAmt, targetOrigin.id);
      }
    } else if (type === 'transfer' && targetDest) {
      if (targetOrigin) {
        sqliteDb.prepare(`
          UPDATE FinanceAccounts 
          SET currentBalance = currentBalance - ?,
              currentDebt = CASE WHEN type IN ('card', 'credit') THEN currentDebt + ? ELSE currentDebt END,
              updatedAt = datetime('now') 
          WHERE id = ?
        `).run(costAmount, costAmount, targetOrigin.id);
      }
      sqliteDb.prepare(`
        UPDATE FinanceAccounts 
        SET currentBalance = currentBalance + ?,
            currentDebt = CASE WHEN type IN ('card', 'credit') THEN MAX(0, currentDebt - ?) ELSE currentDebt END,
            updatedAt = datetime('now') 
        WHERE id = ?
      `).run(costAmount, costAmount, targetDest.id);
    }

    // Registrar en caja negra inalterable y respaldar automáticamente
    try {
      logAuditTrail('FINANCE_TRANSACTION_RECORDED', {
        id,
        type,
        serviceName: data.serviceName,
        chargedAmount,
        costAmount,
        grossProfit,
        netProfit,
        account,
        destAccount,
        category,
        orderId: data.orderId || null,
        splits: data.splits || null,
        notes: data.notes || ''
      }, data.recordedBy || 'Admin');
      createAutoBackup(`Movimiento_Financiero_${type}_${category}`);
    } catch(bErr) {}
  } catch (syncErr) {
    console.warn('[BALANCE SYNC ERR]', syncErr.message);
  }

  return {
    id,
    type,
    orderId: data.orderId,
    serviceName: data.serviceName,
    chargedAmount,
    costAmount,
    grossProfit,
    reinvestPercent,
    reinvestAmount,
    netProfit,
    account,
    destAccount,
    category,
    createdAt
  };
}

/**
 * Obtener estadísticas globales, balances por cuenta bancaria y métricas personales
 */
async function getFinanceSummary(filterOptions = {}) {
  initDefaultAccounts();
  const config = getFinanceConfig();
  const orderId = filterOptions.orderId ? String(filterOptions.orderId).trim() : null;
  const category = filterOptions.category ? String(filterOptions.category).trim() : null;
  const accountFilter = filterOptions.account ? String(filterOptions.account).trim() : null;
  
  // Resumen general acumulado
  const totalRow = sqliteDb.prepare(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(chargedAmount), 0) as totalCharged,
      COALESCE(SUM(costAmount), 0) as totalCost,
      COALESCE(SUM(grossProfit), 0) as totalGrossProfit,
      COALESCE(SUM(reinvestAmount), 0) as totalReinvest,
      COALESCE(SUM(netProfit), 0) as totalNetProfit,
      COALESCE(SUM(CASE WHEN type = 'income_ticket' THEN costAmount ELSE 0 END), 0) as totalTicketServerCost
    FROM FinanceLedger
  `).get();

  // Resumen de Gastos Personales por Categoría (Comida, Pasajes, Gustos, etc.)
  const categoryRows = sqliteDb.prepare(`
    SELECT 
      COALESCE(category, 'otros') as category,
      COUNT(*) as count,
      COALESCE(SUM(CASE WHEN type IN ('expense_manual', 'transfer') THEN costAmount ELSE 0 END), 0) as totalExpense,
      COALESCE(SUM(CASE WHEN type IN ('expense_manual', 'transfer') THEN costAmount ELSE 0 END), 0) as totalCost,
      COALESCE(SUM(chargedAmount), 0) as totalIncome
    FROM FinanceLedger
    GROUP BY category
    ORDER BY totalExpense DESC
  `).all();

  // Cuentas desde la tabla estructurada FinanceAccounts
  const allAccounts = getAllAccounts();
  const accountRows = sqliteDb.prepare(`
    SELECT 
      account,
      COUNT(*) as count,
      COALESCE(SUM(CASE WHEN type = 'expense_manual' THEN -costAmount ELSE chargedAmount END), 0) as balance,
      COALESCE(SUM(chargedAmount), 0) as charged,
      COALESCE(SUM(costAmount), 0) as cost,
      COALESCE(SUM(grossProfit), 0) as grossProfit,
      COALESCE(SUM(reinvestAmount), 0) as reinvestAmount,
      COALESCE(SUM(netProfit), 0) as netProfit
    FROM FinanceLedger
    GROUP BY account
  `).all();

  const accountStatsMap = {};
  accountRows.forEach(row => {
    accountStatsMap[row.account.toLowerCase()] = row;
  });

  const enrichedAccounts = allAccounts.map(acc => {
    const stats = accountStatsMap[acc.name.toLowerCase()] || accountStatsMap[acc.id.toLowerCase()] || {
      count: 0,
      balance: 0,
      charged: 0,
      cost: 0,
      grossProfit: 0,
      reinvestAmount: 0,
      netProfit: 0
    };
    return {
      ...acc,
      balance: acc.currentBalance !== undefined ? acc.currentBalance : acc.initialBalance,
      opsCount: stats.count,
      totalCharged: stats.charged,
      totalCost: stats.cost,
      totalProfit: stats.netProfit,
      // Saldo acumulado en el ledger sumado al saldo base
      computedBalance: parseFloat((acc.initialBalance + stats.balance).toFixed(2))
    };
  });

  // Movimientos recientes (con filtros flexibles)
  let query = 'SELECT * FROM FinanceLedger WHERE 1=1';
  const queryParams = [];

  if (orderId) {
    query += ' AND (orderId = ? OR id = ?)';
    queryParams.push(orderId, orderId);
  }
  if (category) {
    query += ' AND category = ?';
    queryParams.push(category);
  }
  if (accountFilter) {
    query += ' AND (account = ? OR destAccount = ?)';
    queryParams.push(accountFilter, accountFilter);
  }

  query += ' ORDER BY createdAt DESC LIMIT 150';
  const recent = sqliteDb.prepare(query).all(...queryParams);

  // Recuentos semanales recientes
  const weeklyAudits = sqliteDb.prepare(`
    SELECT * FROM FinanceWeeklyAudits ORDER BY weekEnd DESC LIMIT 10
  `).all();

  // Series temporales de los últimos 30 días para gráficas comparativas
  const dailyTrends = sqliteDb.prepare(`
    SELECT 
      substr(createdAt, 1, 10) as date,
      COUNT(*) as transactionsCount,
      COALESCE(SUM(chargedAmount), 0) as income,
      COALESCE(SUM(costAmount), 0) as expense,
      COALESCE(SUM(CASE WHEN netProfit > 0 THEN netProfit ELSE 0 END), 0) as profit,
      COALESCE(SUM(CASE WHEN netProfit < 0 THEN ABS(netProfit) ELSE 0 END), 0) as loss
    FROM FinanceLedger
    WHERE createdAt >= date('now', '-30 days')
    GROUP BY substr(createdAt, 1, 10)
    ORDER BY date ASC
  `).all();

  // Resumen de saldos reales en servidores GSM externos
  const serverBalances = await queryAllServerCredits();

  // Obtener saldo real depositado actualmente en cajitas Nu / cuentas de ahorro
  const cajitaAccounts = sqliteDb.prepare(`
    SELECT COALESCE(SUM(currentBalance), 0) as totalInSavings
    FROM FinanceAccounts
    WHERE isArchived = 0 AND (type = 'savings' OR LOWER(name) LIKE '%cajita%')
  `).get();
  const cajitaActualBalance = parseFloat(cajitaAccounts?.totalInSavings || 0);

  const totalTicketServerCost = parseFloat(totalRow.totalTicketServerCost || 0);
  const totalReinvest = parseFloat(totalRow.totalReinvest || 0);
  
  // Total inyectado/fondeado directamente a los servidores GSM desde cuentas propias
  const serverInjectionsRow = sqliteDb.prepare(`
    SELECT COALESCE(SUM(costAmount), 0) as totalInjected
    FROM FinanceLedger
    WHERE type = 'transfer' AND (destAccount = 'acc_server' OR LOWER(serviceName) LIKE '%fondeo%' OR LOWER(serviceName) LIKE '%servidor%')
  `).get();
  const totalInjectedToServer = parseFloat(serverInjectionsRow?.totalInjected || 0);

  // Fondo meta total que las ventas exigen apartar (costo consumido + utilidades de reinversión)
  // MENOS lo que ya inyectaste directamente al servidor o lo que ya tienes apartado en Cajitas
  const cajitaTargetFund = parseFloat((totalTicketServerCost + totalReinvest).toFixed(2));
  
  // Si ya inyectaste saldo por adelantado al servidor (ej: $100 MXN a Omega), ese saldo cubre con creces el fondo meta requerido
  const totalCoveredForServers = cajitaActualBalance + totalInjectedToServer;
  const cajitaPendingToMove = Math.max(0, parseFloat((cajitaTargetFund - totalCoveredForServers).toFixed(2)));
  const serverFundSurplus = Math.max(0, parseFloat((totalCoveredForServers - cajitaTargetFund).toFixed(2)));

  return {
    config,
    summary: {
      count: totalRow.count,
      totalCharged: totalRow.totalCharged,
      totalCost: totalRow.totalCost,
      totalGrossProfit: totalRow.totalGrossProfit,
      totalReinvest: totalRow.totalReinvest,
      totalNetProfit: totalRow.totalNetProfit,
      totalTicketServerCost: totalTicketServerCost,
      totalCajitaServerFund: cajitaTargetFund,
      cajitaActualBalance: cajitaActualBalance,
      totalInjectedToServer: totalInjectedToServer,
      serverFundSurplus: serverFundSurplus,
      cajitaTargetFund: cajitaTargetFund,
      cajitaPendingToMove: cajitaPendingToMove
    },
    categories: categoryRows,
    accounts: enrichedAccounts,
    serverBalances,
    weeklyAudits,
    dailyTrends,
    recent
  };
}

/**
 * Consulta asíncrona de saldo en cada uno de los servidores GSM configurados
 */
async function queryAllServerCredits() {
  const settingsDb = readDB('settings.json') || {};
  const { getServerSettings, buildTargetUrl } = require('./helpers');
  const axios = require('axios');
  const https = require('https');
  const ipv4Agent = new https.Agent({ family: 4, keepAlive: true });

  const servers = [];
  const serverIds = ['1', '2', '3'];

  for (const sId of serverIds) {
    const s = getServerSettings(settingsDb, sId);
    if (!s) continue;
    
    const isEnabled = s.enabled !== false;
    const targetUrl = buildTargetUrl(s.endpoint);
    const serverObj = {
      id: sId,
      name: s.name || ('Servidor ' + sId),
      enabled: isEnabled,
      endpoint: s.endpoint || '',
      creditRaw: 0,
      creditMxn: 0,
      assigned: 0,
      available: 0,
      currency: sId === '3' ? 'MXN' : 'USD',
      status: 'offline',
      statusMsg: 'Desactivado'
    };

    if (!isEnabled) {
      servers.push(serverObj);
      continue;
    }

    try {
      const params = new URLSearchParams();
      params.append('username', s.username || '');
      params.append('apiaccesskey', s.apiaccesskey || '');
      params.append('action', 'accountinfo');
      params.append('requestformat', 'JSON');

      const res = await axios.post(targetUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Dhru-Fusion-Web-Client/1.0'
        },
        httpsAgent: ipv4Agent,
        timeout: 5000
      });

      if (res.data?.SUCCESS?.[0]?.AccountInfo) {
        const accInfo = res.data.SUCCESS[0].AccountInfo;
        const raw = parseFloat(accInfo.creditraw !== undefined ? accInfo.creditraw : (accInfo.credit || 0));
        const exchangeRate = parseFloat(settingsDb.exchangeRate || 17.60);
        const rate = sId === '3' ? 1 : exchangeRate;
        const creditMxn = raw * rate;

        // Calcular créditos cedidos a resellers en este servidor
        const users = readDB('users.json') || [];
        const { getUserCredit } = require('./helpers');
        let assigned = 0;
        users.forEach(u => {
          if (u.role !== 'admin') {
            assigned += getUserCredit(u, sId);
          }
        });

        serverObj.creditRaw = raw;
        serverObj.creditMxn = parseFloat(creditMxn.toFixed(2));
        serverObj.assigned = parseFloat(assigned.toFixed(2));
        serverObj.available = parseFloat((creditMxn - assigned).toFixed(2));
        serverObj.currency = accInfo.currency || (sId === '3' ? 'MXN' : 'USD');
        serverObj.status = 'online';
        serverObj.statusMsg = 'Conectado';
      } else if (res.data?.ERROR?.[0]?.MESSAGE) {
        serverObj.status = 'error';
        serverObj.statusMsg = res.data.ERROR[0].MESSAGE;
      } else {
        serverObj.status = 'error';
        serverObj.statusMsg = 'Respuesta no reconocida del servidor';
      }
    } catch (err) {
      serverObj.status = 'error';
      serverObj.statusMsg = err.message || 'Error de conexión';
    }

    servers.push(serverObj);
  }

  return servers;
}

/**
 * Realizar corte y verificación semanal de cuentas (Cierre de fin de semana)
 */
function performWeeklyAudit(data = {}) {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 es Domingo
  const weekEnd = data.weekEnd || now.toISOString().split('T')[0];
  
  // Calcular 7 días antes
  const pastDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  const weekStart = data.weekStart || pastDate.toISOString().split('T')[0];

  // Totales de la semana
  const weeklyStats = sqliteDb.prepare(`
    SELECT 
      COALESCE(SUM(chargedAmount), 0) as totalIncome,
      COALESCE(SUM(costAmount), 0) as totalExpenses,
      COALESCE(SUM(grossProfit), 0) as netSavings
    FROM FinanceLedger
    WHERE createdAt >= ? AND createdAt <= ?
  `).get(weekStart + 'T00:00:00.000Z', weekEnd + 'T23:59:59.999Z');

  // Snapshot de saldos actuales de cada cuenta
  const accounts = getAllAccounts();
  const snapshot = accounts.map(a => ({
    id: a.id,
    name: a.name,
    type: a.type,
    balance: a.currentBalance
  }));

  const id = 'audit_week_' + weekStart.replace(/-/g, '') + '_' + weekEnd.replace(/-/g, '');
  const notes = data.notes || `Cierre semanal verificado (${weekStart} al ${weekEnd})`;
  const totalAssets = snapshot.reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0);

  sqliteDb.prepare(`
    INSERT OR REPLACE INTO FinanceWeeklyAudits (
      id, weekStart, weekEnd, totalIncome, totalExpenses, netSavings, accountsSnapshot, notes, verifiedBy, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    id,
    weekStart,
    weekEnd,
    weeklyStats.totalIncome,
    weeklyStats.totalExpenses,
    weeklyStats.netSavings,
    JSON.stringify(snapshot),
    notes,
    data.verifiedBy || 'Admin'
  );

  const saved = sqliteDb.prepare('SELECT * FROM FinanceWeeklyAudits WHERE id = ?').get(id);

  // Generar respaldo inmutable automático de finanzas y sincronizar a Google Drive
  try {
    const { createAutoBackup } = require('./backupEngine');
    createAutoBackup(`Cierre_Semanal_${weekStart}_${weekEnd}`);
  } catch(bErr) {}

  return { ...saved, totalAssets };
}

/**
 * Buscar todos los datos contables y de ganancia asociados a una orden específica
 */
function getOrderFinanceDetails(orderId) {
  if (!orderId) return null;
  const oId = String(orderId).trim();

  // 1. Buscar transacciones en el FinanceLedger
  const ledgerEntries = sqliteDb.prepare(`
    SELECT * FROM FinanceLedger WHERE orderId = ? ORDER BY createdAt DESC
  `).all(oId);

  // 2. Buscar en historial de órdenes (history.json)
  const history = readDB('history.json') || [];
  const orderRecord = history.find(h => String(h.orderId || h.id) === oId) || null;

  // Calcular totales contables para esta orden
  let totalCharged = 0;
  let totalCost = 0;
  let totalGrossProfit = 0;
  let totalReinvest = 0;
  let totalNetProfit = 0;

  ledgerEntries.forEach(entry => {
    totalCharged += parseFloat(entry.chargedAmount || 0);
    totalCost += parseFloat(entry.costAmount || 0);
    totalGrossProfit += parseFloat(entry.grossProfit || 0);
    totalReinvest += parseFloat(entry.reinvestAmount || 0);
    totalNetProfit += parseFloat(entry.netProfit || 0);
  });

  return {
    orderId: oId,
    order: orderRecord,
    ledgerEntries,
    financialSummary: {
      hasLedgerRecord: ledgerEntries.length > 0,
      totalCharged,
      totalCost,
      totalGrossProfit,
      totalReinvest,
      totalNetProfit,
      serverOrderProfit: orderRecord ? parseFloat(orderRecord.profit || 0) : 0,
      serverOrderCostCharged: orderRecord ? parseFloat(orderRecord.costCharged || 0) : 0,
      serverOrderRealCost: orderRecord ? parseFloat(orderRecord.realCost || 0) : 0
    }
  };
}

/**
 * Eliminar una entrada del ledger y revertir atómicamente el saldo en las cuentas asociadas
 */
function deleteTransaction(id) {
  const tx = sqliteDb.prepare('SELECT * FROM FinanceLedger WHERE id = ?').get(id);
  if (!tx) return false;

  const findAcc = (accName) => {
    if (!accName) return null;
    const clean = String(accName).trim();
    let found = sqliteDb.prepare(`
      SELECT id, name, type, isArchived FROM FinanceAccounts 
      WHERE (id = ? OR LOWER(name) = LOWER(?)) AND isArchived = 0
      LIMIT 1
    `).get(clean, clean);
    if (found) return found;

    const lower = clean.toLowerCase();
    if (lower.includes('débito') || lower.includes('debito') || lower.includes('cuenta')) {
      found = sqliteDb.prepare(`
        SELECT id, name, type, isArchived FROM FinanceAccounts 
        WHERE (LOWER(name) LIKE '%débito%' OR LOWER(name) LIKE '%debito%' OR (LOWER(name) LIKE '%nu%' AND type = 'bank'))
          AND isArchived = 0
        LIMIT 1
      `).get();
      if (found) return found;
    }
    if (lower.includes('tarjeta') || lower.includes('crédito') || lower.includes('credito')) {
      found = sqliteDb.prepare(`
        SELECT id, name, type, isArchived FROM FinanceAccounts 
        WHERE (LOWER(name) LIKE '%crédito%' OR LOWER(name) LIKE '%credito%' OR (LOWER(name) LIKE '%nu%' AND type = 'card'))
          AND isArchived = 0
        LIMIT 1
      `).get();
      if (found) return found;
    }

    found = sqliteDb.prepare(`
      SELECT id, name, type, isArchived FROM FinanceAccounts 
      WHERE isArchived = 0 AND (name LIKE ? OR ? LIKE ('%' || name || '%'))
      ORDER BY CASE WHEN type = 'bank' THEN 1 WHEN type = 'cash' THEN 2 ELSE 3 END
      LIMIT 1
    `).get(`%${clean}%`, clean);
    if (found) return found;

    return sqliteDb.prepare(`
      SELECT id, name, type, isArchived FROM FinanceAccounts 
      WHERE id = ? OR name = ? OR name LIKE ? OR ? LIKE ('%' || name || '%')
      LIMIT 1
    `).get(clean, clean, `%${clean}%`, clean);
  };

  const targetOrigin = findAcc(tx.account);
  const targetDest = tx.destAccount ? findAcc(tx.destAccount) : null;
  const costAmount = parseFloat(tx.costAmount) || 0;
  const chargedAmount = parseFloat(tx.chargedAmount) || 0;

  // Revertir impacto monetario en cuentas según el tipo
  if (tx.type === 'expense_manual' && targetOrigin) {
    // Al eliminar un gasto, se restituye el dinero
    sqliteDb.prepare(`
      UPDATE FinanceAccounts 
      SET currentBalance = currentBalance + ?,
          currentDebt = CASE WHEN type IN ('card', 'credit') THEN MAX(0, currentDebt - ?) ELSE currentDebt END,
          updatedAt = datetime('now')
      WHERE id = ?
    `).run(costAmount, costAmount, targetOrigin.id);
  } else if ((tx.type === 'income_ticket' || tx.type === 'income_manual') && targetOrigin) {
    // Al eliminar un ingreso, se descuenta el dinero que había entrado
    sqliteDb.prepare(`
      UPDATE FinanceAccounts 
      SET currentBalance = currentBalance - ?,
          currentDebt = CASE WHEN type IN ('card', 'credit') THEN currentDebt + ? ELSE currentDebt END,
          updatedAt = datetime('now')
      WHERE id = ?
    `).run(chargedAmount, chargedAmount, targetOrigin.id);
  } else if (tx.type === 'transfer') {
    // Revertir transferencia: origen vuelve a sumar, destino vuelve a restar
    if (targetOrigin) {
      sqliteDb.prepare(`
        UPDATE FinanceAccounts 
        SET currentBalance = currentBalance + ?,
            currentDebt = CASE WHEN type IN ('card', 'credit') THEN MAX(0, currentDebt - ?) ELSE currentDebt END,
            updatedAt = datetime('now')
        WHERE id = ?
      `).run(costAmount, costAmount, targetOrigin.id);
    }
    if (targetDest) {
      sqliteDb.prepare(`
        UPDATE FinanceAccounts 
        SET currentBalance = currentBalance - ?,
            currentDebt = CASE WHEN type IN ('card', 'credit') THEN currentDebt + ? ELSE currentDebt END,
            updatedAt = datetime('now')
        WHERE id = ?
      `).run(costAmount, costAmount, targetDest.id);
    }
  }

  // Si la transacción estaba vinculada a una deuda (FinanceDebts), revertir el abono en la deuda
  try {
    let targetDebtId = tx.orderId && tx.orderId.startsWith('debt_') ? tx.orderId : null;
    if (!targetDebtId && tx.serviceName) {
      // Buscar coincidencia si serviceName menciona el nombre de la persona
      const debts = sqliteDb.prepare('SELECT id, personName FROM FinanceDebts').all();
      const match = debts.find(d => tx.serviceName.includes(d.personName) || (tx.notes && tx.notes.includes(d.personName)));
      if (match) targetDebtId = match.id;
    }

    if (targetDebtId) {
      const dRecord = sqliteDb.prepare('SELECT * FROM FinanceDebts WHERE id = ?').get(targetDebtId);
      if (dRecord) {
        const revertAmt = (costAmount > 0 ? costAmount : chargedAmount);
        const newPaid = Math.max(0, (parseFloat(dRecord.paidAmount) || 0) - revertAmt);
        const newRem = Math.max(0, (parseFloat(dRecord.totalAmount) || 0) - newPaid);
        const newStatus = newPaid <= 0 ? 'pending' : (newRem <= 0.009 ? 'settled' : 'partial');

        sqliteDb.prepare(`
          UPDATE FinanceDebts 
          SET paidAmount = ?, remainingAmount = ?, status = ?, updatedAt = datetime('now')
          WHERE id = ?
        `).run(newPaid, newRem, newStatus, targetDebtId);
      }
    }
  } catch (dErr) {
    console.warn('[DEBT REVERT ERR]', dErr.message);
  }

  // Eliminar el registro del libro contable
  const res = sqliteDb.prepare(`DELETE FROM FinanceLedger WHERE id = ?`).run(id);

  // Registrar reversión en caja negra inalterable y respaldar
  try {
    logAuditTrail('FINANCE_TRANSACTION_DELETED_REVERTED', {
      id,
      deletedTransaction: tx,
      revertedImpact: {
        originAccount: tx.account,
        destAccount: tx.destAccount,
        costAmount,
        chargedAmount
      }
    }, 'Admin');
    createAutoBackup(`DeleteTx_Revert_${id}`);
  } catch (e) {}

  return res.changes > 0;
}

/**
 * --- GESTIÓN DE DEUDORES (ME DEBEN) Y ACREEDORES (YO DEBO) ---
 */

function getAllDebts(filterType) {
  try {
    let sql = 'SELECT * FROM FinanceDebts';
    const params = [];
    if (filterType && (filterType === 'receivable' || filterType === 'payable')) {
      sql += ' WHERE type = ?';
      params.push(filterType);
    }
    sql += " ORDER BY CASE WHEN status = 'settled' THEN 1 ELSE 0 END, createdAt DESC";
    const debts = sqliteDb.prepare(sql).all(...params);

    // Totales calculados
    let totalReceivable = 0;
    let pendingReceivable = 0;
    let totalPayable = 0;
    let pendingPayable = 0;

    debts.forEach(d => {
      const remaining = parseFloat(d.remainingAmount || 0);
      const total = parseFloat(d.totalAmount || 0);
      if (d.type === 'receivable') {
        totalReceivable += total;
        if (d.status !== 'settled') pendingReceivable += remaining;
      } else {
        totalPayable += total;
        if (d.status !== 'settled') pendingPayable += remaining;
      }
    });

    return {
      debts,
      summary: {
        totalReceivable,
        pendingReceivable,
        totalPayable,
        pendingPayable,
        netBalance: pendingReceivable - pendingPayable
      }
    };
  } catch (err) {
    console.error('[GET ALL DEBTS ERR]', err);
    return { debts: [], summary: { totalReceivable: 0, pendingReceivable: 0, totalPayable: 0, pendingPayable: 0, netBalance: 0 } };
  }
}

function saveDebt(data) {
  const isUpdate = !!data.id;
  const id = data.id || `debt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const personName = String(data.personName || '').trim();
  if (!personName) throw new Error('El nombre de la persona o entidad es requerido.');

  const type = data.type === 'payable' ? 'payable' : 'receivable';
  const totalAmount = Math.max(0, parseFloat(data.totalAmount) || 0);
  const paidAmount = Math.max(0, parseFloat(data.paidAmount) || 0);
  const remainingAmount = Math.max(0, totalAmount - paidAmount);

  let status = 'pending';
  if (remainingAmount <= 0.009) {
    status = 'settled';
  } else if (paidAmount > 0) {
    status = 'partial';
  }

  const concept = data.concept ? String(data.concept).trim() : '';
  const dueDate = data.dueDate ? String(data.dueDate).trim() : null;
  const phone = data.phone ? String(data.phone).trim() : null;
  const notes = data.notes ? String(data.notes).trim() : '';

  if (isUpdate) {
    const prevDebt = sqliteDb.prepare('SELECT * FROM FinanceDebts WHERE id = ?').get(id);
    const stmt = sqliteDb.prepare(`
      UPDATE FinanceDebts 
      SET personName = ?, type = ?, totalAmount = ?, paidAmount = ?, remainingAmount = ?,
          concept = ?, dueDate = ?, phone = ?, notes = ?, status = ?, updatedAt = datetime('now')
      WHERE id = ?
    `);
    stmt.run(personName, type, totalAmount, paidAmount, remainingAmount, concept, dueDate, phone, notes, status, id);
    logAuditTrail('FINANCE_DEBT_UPDATED', { id, personName, type, totalAmount, paidAmount, previous: prevDebt }, 'Admin');
  } else {
    const stmt = sqliteDb.prepare(`
      INSERT INTO FinanceDebts (id, personName, type, totalAmount, paidAmount, remainingAmount, concept, dueDate, phone, notes, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    stmt.run(id, personName, type, totalAmount, paidAmount, remainingAmount, concept, dueDate, phone, notes, status);
    logAuditTrail('FINANCE_DEBT_CREATED', { id, personName, type, totalAmount, concept }, 'Admin');
  }

  return sqliteDb.prepare('SELECT * FROM FinanceDebts WHERE id = ?').get(id);
}

/**
 * Registrar un abono o liquidación a una deuda y opcionalmente mover el dinero a una cuenta bancaria/caja
 */
function recordDebtPayment(debtId, paymentAmount, accountName, splits = null) {
  const debt = sqliteDb.prepare('SELECT * FROM FinanceDebts WHERE id = ?').get(debtId);
  if (!debt) throw new Error('Registro de deuda no encontrado.');

  const payment = parseFloat(paymentAmount) || 0;
  if (payment <= 0) throw new Error('El monto de abono debe ser mayor a 0.');

  const currentPaid = parseFloat(debt.paidAmount || 0);
  const currentTotal = parseFloat(debt.totalAmount || 0);
  const newPaid = Math.min(currentTotal, currentPaid + payment);
  const newRemaining = Math.max(0, currentTotal - newPaid);

  let newStatus = 'partial';
  if (newRemaining <= 0.009) {
    newStatus = 'settled';
  }

  sqliteDb.prepare(`
    UPDATE FinanceDebts 
    SET paidAmount = ?, remainingAmount = ?, status = ?, updatedAt = datetime('now')
    WHERE id = ?
  `).run(newPaid, newRemaining, newStatus, debtId);

  logAuditTrail('FINANCE_DEBT_PAYMENT_APPLIED', {
    debtId,
    personName: debt.personName,
    type: debt.type,
    appliedAmount: payment,
    previousPaid: currentPaid,
    newPaid,
    newRemaining,
    newStatus,
    account: accountName,
    splits
  }, 'Admin');

  const isReceivable = debt.type === 'receivable';
  const ledgerType = isReceivable ? 'income_manual' : 'expense_manual';
  const noteText = isReceivable 
    ? `Abono de ${debt.personName} a deuda: ${debt.concept || 'Deuda'}`
    : `Pago a ${debt.personName} por deuda: ${debt.concept || 'Deuda'}`;

  // Si se proporcionó pago dividido (splits)
  if (Array.isArray(splits) && splits.length > 0) {
    recordTransaction({
      type: ledgerType,
      category: isReceivable ? 'otros' : 'servicios',
      serviceName: noteText,
      orderId: debtId,
      notes: noteText,
      costAmount: isReceivable ? 0 : payment,
      chargedAmount: isReceivable ? payment : 0,
      splits: splits,
      recordedBy: 'Admin'
    });
  } else if (accountName) {
    // Pago con una cuenta simple
    recordTransaction({
      type: ledgerType,
      category: isReceivable ? 'otros' : 'servicios',
      serviceName: noteText,
      orderId: debtId,
      chargedAmount: isReceivable ? payment : 0,
      costAmount: isReceivable ? 0 : payment,
      account: accountName,
      notes: noteText,
      recordedBy: 'Admin'
    });
  }

  return sqliteDb.prepare('SELECT * FROM FinanceDebts WHERE id = ?').get(debtId);
}

function deleteDebt(id) {
  const existingDebt = sqliteDb.prepare('SELECT * FROM FinanceDebts WHERE id = ?').get(id);
  if (!existingDebt) return false;

  // Revertir y limpiar cualquier transacción del ledger vinculada a esta deuda para que no queden huérfanas
  try {
    const linkedTxs = sqliteDb.prepare('SELECT * FROM FinanceLedger WHERE orderId = ?').all(id);
    linkedTxs.forEach(tx => {
      deleteTransaction(tx.id);
    });
  } catch (err) {
    console.warn('[DELETE DEBT LINKED TX REVERT ERR]', err.message);
  }

  const stmt = sqliteDb.prepare('DELETE FROM FinanceDebts WHERE id = ?');
  const res = stmt.run(id);

  if (res.changes > 0) {
    logAuditTrail('FINANCE_DEBT_DELETED_REVERTED', {
      id,
      deletedDebt: existingDebt
    }, 'Admin');
    try {
      createAutoBackup(`DeleteDebt_Revert_${id}`);
    } catch (e) {}
  }

  return res.changes > 0;
}

/**
 * Compensar / Tabular cruce de deudas entre dos partes
 * Ejemplo: Le debo a Rick $1,000 (payable), pero él me debe $300 (receivable).
 * Se amortizan $300 en ambas deudas:
 * - La deuda que me debe Rick se salda o reduce en $300.
 * - La deuda que le debo a Rick se reduce en $300 (quedando solo $700 por pagar).
 * Cero salida de efectivo o bancos requerida.
 */
function crossOffsetDebts(debtPayableId, debtReceivableId, offsetAmount = null, notes = '') {
  const payable = sqliteDb.prepare('SELECT * FROM FinanceDebts WHERE id = ?').get(debtPayableId);
  const receivable = sqliteDb.prepare('SELECT * FROM FinanceDebts WHERE id = ?').get(debtReceivableId);

  if (!payable) throw new Error('Deuda a pagar (que tú debes) no encontrada.');
  if (!receivable) throw new Error('Deuda a cobrar (que te deben) no encontrada.');

  const remPayable = parseFloat(payable.remainingAmount || payable.totalAmount || 0);
  const remReceivable = parseFloat(receivable.remainingAmount || receivable.totalAmount || 0);

  if (remPayable <= 0) throw new Error(`La deuda que le debes a ${payable.personName} ya está liquidada.`);
  if (remReceivable <= 0) throw new Error(`La deuda que te debe ${receivable.personName} ya está liquidada.`);

  // El monto máximo que se puede cruzar es el mínimo entre lo que debes y lo que te deben
  const maxPossible = Math.min(remPayable, remReceivable);
  const amountToOffset = offsetAmount !== null && !isNaN(parseFloat(offsetAmount)) && parseFloat(offsetAmount) > 0
    ? Math.min(maxPossible, parseFloat(offsetAmount))
    : maxPossible;

  if (amountToOffset <= 0) throw new Error('El monto de compensación debe ser mayor a 0.');

  // 1. Amortizar deuda por pagar (payable)
  const newPayablePaid = parseFloat(((payable.paidAmount || 0) + amountToOffset).toFixed(2));
  const newPayableRem = Math.max(0, parseFloat((payable.totalAmount - newPayablePaid).toFixed(2)));
  const newPayableStatus = newPayableRem <= 0.009 ? 'settled' : 'partial';

  sqliteDb.prepare(`
    UPDATE FinanceDebts 
    SET paidAmount = ?, remainingAmount = ?, status = ?, updatedAt = datetime('now')
    WHERE id = ?
  `).run(newPayablePaid, newPayableRem, newPayableStatus, payable.id);

  // 2. Amortizar deuda por cobrar (receivable)
  const newReceivablePaid = parseFloat(((receivable.paidAmount || 0) + amountToOffset).toFixed(2));
  const newReceivableRem = Math.max(0, parseFloat((receivable.totalAmount - newReceivablePaid).toFixed(2)));
  const newReceivableStatus = newReceivableRem <= 0.009 ? 'settled' : 'partial';

  sqliteDb.prepare(`
    UPDATE FinanceDebts 
    SET paidAmount = ?, remainingAmount = ?, status = ?, updatedAt = datetime('now')
    WHERE id = ?
  `).run(newReceivablePaid, newReceivableRem, newReceivableStatus, receivable.id);

  // 3. Registrar en libro contable como compensación sin movimiento bancario
  const logConcept = `Cruce / Compensación de deudas: ${payable.personName} [Restan $${newPayableRem}] vs [Abono $${amountToOffset}] de ${receivable.personName}`;
  recordTransaction({
    type: 'transfer',
    category: 'deudas',
    serviceName: `Compensación de Deudas: ${payable.personName} ↔ ${receivable.personName}`,
    orderId: `${payable.id}|${receivable.id}`,
    chargedAmount: 0,
    costAmount: 0,
    grossProfit: 0,
    netProfit: 0,
    account: 'Compensación Cruzada',
    destAccount: 'Compensación Cruzada',
    notes: `${logConcept}. ${notes || ''}`.trim(),
    recordedBy: 'Admin'
  });

  logAuditTrail('FINANCE_DEBTS_CROSS_OFFSET', {
    payableId: payable.id,
    payablePerson: payable.personName,
    payableBefore: remPayable,
    payableAfter: newPayableRem,
    receivableId: receivable.id,
    receivablePerson: receivable.personName,
    receivableBefore: remReceivable,
    receivableAfter: newReceivableRem,
    offsetAmount: amountToOffset,
    notes
  }, 'Admin');

  return {
    success: true,
    offsetAmount: amountToOffset,
    payable: sqliteDb.prepare('SELECT * FROM FinanceDebts WHERE id = ?').get(payable.id),
    receivable: sqliteDb.prepare('SELECT * FROM FinanceDebts WHERE id = ?').get(receivable.id)
  };
}

/**
 * --- PLANES DE COMPRAS Y PAGOS A MESES (NU, BANCOS, CUOTAS) ---
 */
function getAllInstallments() {
  try {
    const installments = sqliteDb.prepare(`
      SELECT * FROM FinanceInstallments 
      ORDER BY status ASC, dueDay ASC, createdAt DESC
    `).all();

    let totalFinanced = 0;
    let totalPending = 0;
    let totalPaid = 0;
    let monthlyCommitment = 0;

    installments.forEach(item => {
      const remainingQuotas = Math.max(0, item.totalQuotas - item.paidQuotas);
      const remainingAmount = Math.max(0, parseFloat((remainingQuotas * item.quotaAmount).toFixed(2)));
      item.remainingQuotas = remainingQuotas;
      item.remainingAmount = remainingAmount;
      item.progressPercent = item.totalQuotas > 0 ? Math.min(100, Math.round((item.paidQuotas / item.totalQuotas) * 100)) : 0;

      totalFinanced += parseFloat(item.totalAmount || 0);
      if (item.status === 'active' && remainingQuotas > 0) {
        totalPending += remainingAmount;
        totalPaid += (item.paidQuotas * item.quotaAmount);
        monthlyCommitment += parseFloat(item.quotaAmount || 0);
      } else {
        totalPaid += parseFloat(item.totalAmount || 0);
      }
    });

    return {
      installments,
      summary: {
        totalFinanced: parseFloat(totalFinanced.toFixed(2)),
        totalPending: parseFloat(totalPending.toFixed(2)),
        totalPaid: parseFloat(totalPaid.toFixed(2)),
        monthlyCommitment: parseFloat(monthlyCommitment.toFixed(2)),
        activeCount: installments.filter(i => i.status === 'active' && i.remainingQuotas > 0).length
      }
    };
  } catch (err) {
    console.error('[GET ALL INSTALLMENTS ERR]', err);
    return { installments: [], summary: { totalFinanced: 0, totalPending: 0, totalPaid: 0, monthlyCommitment: 0, activeCount: 0 } };
  }
}

function saveInstallment(data) {
  const isUpdate = !!data.id;
  const id = data.id || `inst_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const title = String(data.title || '').trim();
  if (!title) throw new Error('El título o concepto de la compra a meses es requerido.');

  const accountId = data.accountId ? String(data.accountId).trim() : 'acc_nu';
  const accountName = data.accountName ? String(data.accountName).trim() : 'Nu Crédito';
  const totalAmount = Math.max(0, parseFloat(data.totalAmount) || 0);
  const totalQuotas = Math.max(1, parseInt(data.totalQuotas) || 1);
  const paidQuotas = Math.max(0, Math.min(totalQuotas, parseInt(data.paidQuotas) || 0));

  // Cálculo automático del monto por mes: total / cuotas (con redondeo a 2 decimales)
  let quotaAmount = parseFloat(data.quotaAmount);
  if (!quotaAmount || isNaN(quotaAmount) || quotaAmount <= 0) {
    quotaAmount = parseFloat((totalAmount / totalQuotas).toFixed(2));
  }

  // Fecha del primer pago o inicio
  const rawFirstDate = data.firstPaymentDate || data.startDate || new Date().toISOString().slice(0, 10);
  const parsedDate = new Date(rawFirstDate);
  const detectedDueDay = !isNaN(parsedDate.getDate()) ? parsedDate.getDate() : 13;
  const dueDay = Math.max(1, Math.min(31, parseInt(data.dueDay) || detectedDueDay));

  const interestRate = parseFloat(data.interestRate) || 0;
  const referenceNumber = data.referenceNumber ? String(data.referenceNumber).trim() : '';
  const status = paidQuotas >= totalQuotas ? 'completed' : 'active';
  const startDate = rawFirstDate;
  const notes = data.notes ? String(data.notes).trim() : '';

  if (isUpdate) {
    sqliteDb.prepare(`
      UPDATE FinanceInstallments 
      SET accountId = ?, accountName = ?, title = ?, totalAmount = ?, totalQuotas = ?, paidQuotas = ?,
          quotaAmount = ?, dueDay = ?, interestRate = ?, referenceNumber = ?, status = ?, startDate = ?,
          notes = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(accountId, accountName, title, totalAmount, totalQuotas, paidQuotas, quotaAmount, dueDay, interestRate, referenceNumber, status, startDate, notes, id);
  } else {
    sqliteDb.prepare(`
      INSERT INTO FinanceInstallments (
        id, accountId, accountName, title, totalAmount, totalQuotas, paidQuotas,
        quotaAmount, dueDay, interestRate, referenceNumber, status, startDate, notes, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(id, accountId, accountName, title, totalAmount, totalQuotas, paidQuotas, quotaAmount, dueDay, interestRate, referenceNumber, status, startDate, notes);

    // Si es un nuevo financiamiento / disposición, reflejar en saldos
    try {
      // 1. Reducir disponible de la tarjeta y registrar la deuda
      const findCard = sqliteDb.prepare(`
        SELECT * FROM FinanceAccounts 
        WHERE id = ? OR name = ? OR name LIKE ? OR ? LIKE ('%' || name || '%')
        LIMIT 1
      `).get(accountId, accountName, `%${accountName}%`, accountName);

      if (findCard) {
        sqliteDb.prepare(`
          UPDATE FinanceAccounts 
          SET currentBalance = MAX(0, currentBalance - ?),
              currentDebt = currentDebt + ?,
              updatedAt = datetime('now')
          WHERE id = ?
        `).run(totalAmount, totalAmount, findCard.id);
      }

      // 2. Si se retiró dinero (disposición de efectivo o transferencia) e ingresa a una cuenta receptora
      const depositAcc = data.depositAccount && data.depositAccount !== 'none' ? String(data.depositAccount).trim() : null;
      const netReceived = parseFloat(data.netReceived) || 0;

      if (depositAcc && netReceived > 0) {
        const findDest = sqliteDb.prepare(`
          SELECT * FROM FinanceAccounts 
          WHERE id = ? OR name = ? OR name LIKE ? OR ? LIKE ('%' || name || '%')
          LIMIT 1
        `).get(depositAcc, depositAcc, `%${depositAcc}%`, depositAcc);

        if (findDest) {
          // Registrar en FinanceLedger la disposición de fondos hacia la cuenta receptora (recordTransaction actualiza el saldo automáticamente)
          recordTransaction({
            type: 'transfer',
            category: 'otros',
            serviceName: `Disposición de saldo: ${title}`,
            orderId: id,
            chargedAmount: 0,
            costAmount: netReceived,
            account: findCard ? findCard.name : accountName,
            destAccount: findDest.name,
            notes: `Disposición financiada con ${accountName}. Recibido en ${findDest.name}: $${netReceived.toFixed(2)}, Deuda diferida: $${totalAmount.toFixed(2)} en ${totalQuotas} meses.`,
            recordedBy: 'Admin'
          });
        }
      }
    } catch (syncErr) {
      console.warn('[INSTALLMENT BALANCE SYNC ERR]', syncErr.message);
    }
  }

  const savedRecord = sqliteDb.prepare('SELECT * FROM FinanceInstallments WHERE id = ?').get(id);
  logAuditTrail(isUpdate ? 'FINANCE_INSTALLMENT_UPDATED' : 'FINANCE_INSTALLMENT_CREATED', {
    id,
    title,
    accountName,
    totalAmount,
    totalQuotas,
    paidQuotas,
    quotaAmount,
    dueDay
  }, 'Admin');

  return savedRecord;
}

function payInstallmentQuota(installmentId, quotaCount = 1, paymentAccount = 'Efectivo / Caja', customAmount = null, recordLedger = true) {
  const item = sqliteDb.prepare('SELECT * FROM FinanceInstallments WHERE id = ?').get(installmentId);
  if (!item) throw new Error('Plan de cuotas no encontrado.');

  const count = Math.max(1, parseInt(quotaCount) || 1);
  const newPaid = Math.min(item.totalQuotas, (item.paidQuotas || 0) + count);
  const newStatus = newPaid >= item.totalQuotas ? 'completed' : 'active';
  
  // Si se provee customAmount (ej: abono exacto o liquidación), usarlo; de lo contrario cuota * count
  const paidAmount = customAmount !== null && !isNaN(parseFloat(customAmount)) && parseFloat(customAmount) > 0
    ? parseFloat(parseFloat(customAmount).toFixed(2))
    : parseFloat((item.quotaAmount * count).toFixed(2));

  sqliteDb.prepare(`
    UPDATE FinanceInstallments 
    SET paidQuotas = ?, status = ?, updatedAt = datetime('now') 
    WHERE id = ?
  `).run(newPaid, newStatus, installmentId);

  logAuditTrail('FINANCE_INSTALLMENT_QUOTA_PAID', {
    installmentId,
    title: item.title,
    previousPaid: item.paidQuotas,
    newPaid,
    totalQuotas: item.totalQuotas,
    paidAmount,
    paymentAccount
  }, 'Admin');

  // 1. Reducir la deuda en la tarjeta de crédito emisora (solo si recordLedger es true)
  if (recordLedger) {
    try {
      const cardId = item.accountId;
      const cardName = item.accountName;
      const targetCard = sqliteDb.prepare(`
        SELECT * FROM FinanceAccounts 
        WHERE (id = ? OR name = ? OR name LIKE ? OR ? LIKE ('%' || name || '%')) 
          AND type IN ('card', 'credit') AND isArchived = 0
        LIMIT 1
      `).get(cardId, cardName, `%${cardName}%`, cardName);

      if (targetCard) {
        sqliteDb.prepare(`
          UPDATE FinanceAccounts 
          SET currentDebt = MAX(0, currentDebt - ?),
              currentBalance = currentBalance + ?,
              updatedAt = datetime('now')
          WHERE id = ?
        `).run(paidAmount, paidAmount, targetCard.id);
      }
    } catch (cardPayErr) {
      console.warn('[INSTALLMENT CARD AMORTIZE ERR]', cardPayErr.message);
    }

    // 2. Registrar el gasto contable en FinanceLedger y descontar de la cuenta origen
    if (paymentAccount) {
      recordTransaction({
        type: 'expense_manual',
        category: 'servicios',
        serviceName: `Pago Mensualidad (${newPaid}/${item.totalQuotas}): ${item.title}`,
        orderId: installmentId,
        chargedAmount: 0,
        costAmount: paidAmount,
        account: paymentAccount,
        notes: `Cuota ${newPaid}/${item.totalQuotas} de ${item.title} (${item.accountName || 'Nu'}). Ref: ${item.referenceNumber || 'N/A'}`,
        recordedBy: 'Admin'
      });
    }
  }

  return sqliteDb.prepare('SELECT * FROM FinanceInstallments WHERE id = ?').get(installmentId);
}

function deleteInstallment(id) {
  const existing = sqliteDb.prepare('SELECT * FROM FinanceInstallments WHERE id = ?').get(id);
  if (!existing) return false;

  // 1. Revertir saldo/crédito en la tarjeta emisora
  try {
    const findCard = sqliteDb.prepare(`
      SELECT * FROM FinanceAccounts 
      WHERE id = ? OR name = ? OR name LIKE ? OR ? LIKE ('%' || name || '%')
      LIMIT 1
    `).get(existing.accountId, existing.accountName, `%${existing.accountName}%`, existing.accountName);

    if (findCard) {
      const totalAmount = parseFloat(existing.totalAmount) || 0;
      sqliteDb.prepare(`
        UPDATE FinanceAccounts 
        SET currentBalance = currentBalance + ?,
            currentDebt = MAX(0, currentDebt - ?),
            updatedAt = datetime('now')
        WHERE id = ?
      `).run(totalAmount, totalAmount, findCard.id);
    }
  } catch (cardErr) {
    console.warn('[REVERT INSTALLMENT CARD ERR]', cardErr.message);
  }

  // 2. Revertir y limpiar movimientos del ledger asociados a este plan (tanto la disposición inicial como los pagos de cuotas)
  try {
    const linkedTxs = sqliteDb.prepare('SELECT * FROM FinanceLedger WHERE orderId = ? OR serviceName LIKE ? OR notes LIKE ?')
      .all(id, `%${existing.title}%`, `%${id}%`);

    linkedTxs.forEach(tx => {
      deleteTransaction(tx.id);
    });
  } catch (txErr) {
    console.warn('[REVERT INSTALLMENT LEDGER TX ERR]', txErr.message);
  }

  // 3. Eliminar el registro del plan de cuotas
  const stmt = sqliteDb.prepare('DELETE FROM FinanceInstallments WHERE id = ?');
  const res = stmt.run(id);

  if (res.changes > 0) {
    logAuditTrail('FINANCE_INSTALLMENT_DELETED_REVERTED', {
      id,
      deletedInstallment: existing
    }, 'Admin');
    try {
      createAutoBackup(`DeleteInstallment_Revert_${id}`);
    } catch (e) {}
  }

  return res.changes > 0;
}

/**
 * --- INGRESO SEMANAL DE PASAJE & COMIDA EN LA UNIVERSIDAD ---
 * Inyecta directamente saldo positivo en efectivo/caja y lo categoriza como apoyo semanal
 */
function recordCollegeAllowance(amount, notes = 'Pasaje y comida semanal uni', targetAccount = 'Efectivo / Caja') {
  const numAmount = Math.max(0, parseFloat(amount) || 0);
  if (numAmount <= 0) throw new Error('El monto de la semana debe ser mayor a 0');

  return recordTransaction({
    type: 'income_manual',
    category: 'pasaje',
    serviceName: `Apoyo Semanal Uni (Pasaje & Comida)`,
    chargedAmount: numAmount,
    costAmount: 0,
    account: targetAccount,
    notes: String(notes || 'Dinero en efectivo otorgado para la semana (transporte y comida en la universidad)'),
    recordedBy: 'Admin'
  });
}

/**
 * --- CONTROL Y PREVISIÓN DE RECARGAS TELEFÓNICAS ---
 */
function getAllMobilePlans() {
  const plans = sqliteDb.prepare(`
    SELECT * FROM FinanceMobilePlans 
    ORDER BY CASE status WHEN 'active' THEN 1 ELSE 2 END, nextRenewalDate ASC
  `).all();

  const todayStr = new Date().toISOString().slice(0, 10);
  let totalMonthlyEstimated = 0;
  let renewalsDueSoon = 0;

  const enriched = plans.map(p => {
    // Calcular días restantes hasta la siguiente renovación
    let daysRemaining = null;
    let isExpired = false;
    let isDueSoon = false;

    if (p.nextRenewalDate) {
      const diffMs = new Date(p.nextRenewalDate + 'T00:00:00') - new Date(todayStr + 'T00:00:00');
      daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (daysRemaining <= 0) isExpired = true;
      else if (daysRemaining <= 3) isDueSoon = true;
    }

    if (p.status === 'active') {
      renewalsDueSoon += (isExpired || isDueSoon) ? 1 : 0;
      // Proyección mensual normalizada (30 días)
      const duration = Math.max(1, p.durationDays || 30);
      totalMonthlyEstimated += (p.amount / duration) * 30;
    }

    return {
      ...p,
      daysRemaining,
      isExpired,
      isDueSoon
    };
  });

  return {
    plans: enriched,
    summary: {
      totalPlans: plans.length,
      activePlans: plans.filter(p => p.status === 'active').length,
      renewalsDueSoon,
      totalMonthlyEstimated: parseFloat(totalMonthlyEstimated.toFixed(2))
    }
  };
}

function saveMobilePlan(data) {
  const id = data.id || ('mplan_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
  const carrier = String(data.carrier || 'Telcel').trim();
  const phoneNumber = data.phoneNumber ? String(data.phoneNumber).trim() : '';
  const planName = data.planName ? String(data.planName).trim() : 'Recarga Móvil';
  const amount = Math.max(0, parseFloat(data.amount) || 0);
  const durationDays = Math.max(1, parseInt(data.durationDays) || 30);
  const preferredAccount = data.preferredAccount || 'acc_cash';
  const autoRemind = data.autoRemind !== undefined ? (data.autoRemind ? 1 : 0) : 1;
  const notes = data.notes ? String(data.notes).trim() : '';
  const status = data.status || 'active';

  let lastRechargeDate = data.lastRechargeDate ? String(data.lastRechargeDate).slice(0, 10) : new Date().toISOString().slice(0, 10);
  
  // Calcular próxima fecha de renovación sumando durationDays
  let nextRenewalDate = data.nextRenewalDate ? String(data.nextRenewalDate).slice(0, 10) : null;
  if (!nextRenewalDate && lastRechargeDate) {
    const d = new Date(lastRechargeDate + 'T12:00:00');
    d.setDate(d.getDate() + durationDays);
    nextRenewalDate = d.toISOString().slice(0, 10);
  }

  const existing = sqliteDb.prepare('SELECT id FROM FinanceMobilePlans WHERE id = ?').get(id);
  if (existing) {
    sqliteDb.prepare(`
      UPDATE FinanceMobilePlans 
      SET carrier = ?, phoneNumber = ?, planName = ?, amount = ?, durationDays = ?,
          lastRechargeDate = ?, nextRenewalDate = ?, preferredAccount = ?, autoRemind = ?,
          notes = ?, status = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(carrier, phoneNumber, planName, amount, durationDays, lastRechargeDate, nextRenewalDate, preferredAccount, autoRemind, notes, status, id);
  } else {
    sqliteDb.prepare(`
      INSERT INTO FinanceMobilePlans (
        id, carrier, phoneNumber, planName, amount, durationDays,
        lastRechargeDate, nextRenewalDate, preferredAccount, autoRemind,
        notes, status, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(id, carrier, phoneNumber, planName, amount, durationDays, lastRechargeDate, nextRenewalDate, preferredAccount, autoRemind, notes, status);
  }

  const savedPlan = sqliteDb.prepare('SELECT * FROM FinanceMobilePlans WHERE id = ?').get(id);
  logAuditTrail('FINANCE_MOBILE_PLAN_SAVED', {
    id,
    carrier,
    phoneNumber,
    planName,
    amount,
    durationDays
  }, 'Admin');

  return savedPlan;
}

function executeMobileRecharge(planId, accountUsed, customAmount) {
  const plan = sqliteDb.prepare('SELECT * FROM FinanceMobilePlans WHERE id = ?').get(planId);
  if (!plan) throw new Error('Plan de recarga no encontrado');

  const payAccount = accountUsed || plan.preferredAccount || 'acc_cash';
  const rechargeAmount = customAmount !== undefined ? Math.max(0, parseFloat(customAmount) || 0) : plan.amount;
  if (rechargeAmount <= 0) throw new Error('El monto de la recarga debe ser mayor a 0');

  const todayStr = new Date().toISOString().slice(0, 10);
  const nextD = new Date(todayStr + 'T12:00:00');
  nextD.setDate(nextD.getDate() + (plan.durationDays || 30));
  const newRenewalDate = nextD.toISOString().slice(0, 10);

  // 1. Actualizar fechas del plan
  sqliteDb.prepare(`
    UPDATE FinanceMobilePlans 
    SET lastRechargeDate = ?, nextRenewalDate = ?, updatedAt = datetime('now')
    WHERE id = ?
  `).run(todayStr, newRenewalDate, planId);

  logAuditTrail('FINANCE_MOBILE_RECHARGE_EXECUTED', {
    planId,
    carrier: plan.carrier,
    phoneNumber: plan.phoneNumber,
    rechargeAmount,
    payAccount,
    newRenewalDate
  }, 'Admin');

  // 2. Registrar el gasto contable en FinanceLedger
  recordTransaction({
    type: 'expense_manual',
    category: 'telefonia',
    serviceName: `Recarga Móvil: ${plan.carrier} ${plan.planName || ''} (${plan.phoneNumber || 'Línea'})`,
    orderId: plan.id,
    chargedAmount: 0,
    costAmount: rechargeAmount,
    account: payAccount,
    notes: `Recarga de $${rechargeAmount} válida por ${plan.durationDays} días. Próxima renovación: ${newRenewalDate}. Ref: ${plan.id}`,
    recordedBy: 'Admin'
  });

  return sqliteDb.prepare('SELECT * FROM FinanceMobilePlans WHERE id = ?').get(planId);
}

function deleteMobilePlan(id) {
  const existing = sqliteDb.prepare('SELECT * FROM FinanceMobilePlans WHERE id = ?').get(id);
  if (!existing) return false;

  const stmt = sqliteDb.prepare('DELETE FROM FinanceMobilePlans WHERE id = ?');
  const res = stmt.run(id);

  if (res.changes > 0) {
    logAuditTrail('FINANCE_MOBILE_PLAN_DELETED', {
      id,
      deletedPlan: existing
    }, 'Admin');
  }

  return res.changes > 0;
}

// ========================================================
// SECCIÓN: REGISTROS Y SEGUIMIENTO DE CUENTAS DE INVERSIÓN
// ========================================================

/**
 * Obtener todos los registros y snapshots de inversiones ordenados cronológicamente
 */
function getAllInvestmentLogs(accountId = null) {
  let query = 'SELECT * FROM FinanceInvestmentLogs';
  const params = [];
  if (accountId) {
    query += ' WHERE accountId = ? OR accountName = ?';
    params.push(accountId, accountId);
  }
  query += ' ORDER BY date ASC, createdAt ASC';
  const logs = sqliteDb.prepare(query).all(...params);

  // Calcular métricas consolidadas
  let totalInvested = 0;
  let latestValue = 0;
  let totalNetReturn = 0;
  let returnPercentage = 0;

  if (logs.length > 0) {
    const latest = logs[logs.length - 1];
    totalInvested = parseFloat(latest.investedCapital) || 0;
    latestValue = parseFloat(latest.currentValue) || 0;
    totalNetReturn = parseFloat(latest.netReturn) || (latestValue - totalInvested);
    returnPercentage = totalInvested > 0 ? parseFloat(((totalNetReturn / totalInvested) * 100).toFixed(2)) : 0;
  }

  return {
    logs,
    summary: {
      totalInvested,
      currentValue: latestValue,
      netReturn: parseFloat(totalNetReturn.toFixed(2)),
      returnPercentage,
      isProfit: totalNetReturn >= 0
    }
  };
}

/**
 * Guardar o registrar un corte de valuación / inyección de capital en inversión
 */
function saveInvestmentLog(data) {
  const id = data.id || `inv_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const accountId = data.accountId || 'acc_investment';
  const accountName = data.accountName || 'Revolut Cuenta Inversión';
  const date = data.date || new Date().toISOString().split('T')[0];
  const injectedAmount = parseFloat(data.injectedAmount) || 0;
  const withdrawnAmount = parseFloat(data.withdrawnAmount) || 0;
  const platform = data.platform || 'Revolut';
  const notes = data.notes || '';

  // Obtener el registro previo más reciente para arrastrar el capital acumulado
  const lastLog = sqliteDb.prepare(`
    SELECT * FROM FinanceInvestmentLogs 
    WHERE accountId = ? AND id != ?
    ORDER BY date DESC, createdAt DESC 
    LIMIT 1
  `).get(accountId, id);

  // Capital invertido base
  let previousInvested = lastLog ? parseFloat(lastLog.investedCapital || 0) : 0;
  let investedCapital = data.investedCapital !== undefined && data.investedCapital !== null && data.investedCapital !== ''
    ? parseFloat(data.investedCapital)
    : (previousInvested + injectedAmount - withdrawnAmount);

  // Si no se proporcionó investedCapital explícito y no había previo, usar injectedAmount o currentValue
  if (investedCapital <= 0 && injectedAmount > 0) {
    investedCapital = injectedAmount;
  }

  // Valor actual registrado en la plataforma
  const currentValue = parseFloat(data.currentValue) || 0;
  if (investedCapital <= 0 && currentValue > 0 && !previousInvested) {
    investedCapital = currentValue;
  }

  // Plusvalía (+) o Minusvalía (-) = Valor actual - Capital invertido
  const netReturn = parseFloat((currentValue - investedCapital).toFixed(2));
  const returnPercentage = investedCapital > 0 
    ? parseFloat(((netReturn / investedCapital) * 100).toFixed(2)) 
    : 0;

  const existing = sqliteDb.prepare('SELECT id FROM FinanceInvestmentLogs WHERE id = ?').get(id);

  if (existing) {
    sqliteDb.prepare(`
      UPDATE FinanceInvestmentLogs 
      SET accountId = ?, accountName = ?, date = ?, investedCapital = ?, currentValue = ?,
          netReturn = ?, returnPercentage = ?, injectedAmount = ?, withdrawnAmount = ?,
          platform = ?, notes = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(
      accountId, accountName, date, investedCapital, currentValue,
      netReturn, returnPercentage, injectedAmount, withdrawnAmount,
      platform, notes, id
    );
  } else {
    sqliteDb.prepare(`
      INSERT INTO FinanceInvestmentLogs (
        id, accountId, accountName, date, investedCapital, currentValue,
        netReturn, returnPercentage, injectedAmount, withdrawnAmount,
        platform, notes, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      id, accountId, accountName, date, investedCapital, currentValue,
      netReturn, returnPercentage, injectedAmount, withdrawnAmount,
      platform, notes
    );
  }

  // Sincronizar el saldo de la cuenta de inversión en FinanceAccounts
  try {
    sqliteDb.prepare(`
      UPDATE FinanceAccounts 
      SET currentBalance = ?, updatedAt = datetime('now') 
      WHERE id = ? OR name = ? OR type = 'investment'
    `).run(currentValue, accountId, accountName);
  } catch (syncErr) {
    console.warn('[INVESTMENT ACC BALANCE SYNC ERR]', syncErr.message);
  }

  // Si hubo inyección de dinero y se indicó registrar movimiento contable
  if (data.sourceAccount && injectedAmount > 0) {
    recordTransaction({
      type: 'transfer',
      serviceName: `Aporte a Inversión (${platform}): ${accountName}`,
      chargedAmount: 0,
      costAmount: injectedAmount,
      account: data.sourceAccount,
      destAccount: accountName,
      category: 'inversiones',
      notes: `Inyección de capital para portafolio de inversión. Fecha de corte: ${date}. ${notes}`,
      recordedBy: 'Admin'
    });
  }

  logAuditTrail(existing ? 'FINANCE_INVESTMENT_LOG_UPDATED' : 'FINANCE_INVESTMENT_LOG_CREATED', {
    id,
    date,
    platform,
    investedCapital,
    currentValue,
    netReturn,
    returnPercentage,
    injectedAmount
  }, 'Admin');

  return sqliteDb.prepare('SELECT * FROM FinanceInvestmentLogs WHERE id = ?').get(id);
}

/**
 * Eliminar un registro de inversión
 */
function deleteInvestmentLog(id) {
  const existing = sqliteDb.prepare('SELECT * FROM FinanceInvestmentLogs WHERE id = ?').get(id);
  if (!existing) return false;

  const res = sqliteDb.prepare('DELETE FROM FinanceInvestmentLogs WHERE id = ?').run(id);

  if (res.changes > 0) {
    // Restaurar el balance de la cuenta al último registro disponible
    try {
      const remaining = sqliteDb.prepare(`
        SELECT currentValue FROM FinanceInvestmentLogs 
        WHERE accountId = ? 
        ORDER BY date DESC, createdAt DESC 
        LIMIT 1
      `).get(existing.accountId);

      const newBal = remaining ? parseFloat(remaining.currentValue) : 0;
      sqliteDb.prepare(`
        UPDATE FinanceAccounts 
        SET currentBalance = ?, updatedAt = datetime('now') 
        WHERE id = ?
      `).run(newBal, existing.accountId);
    } catch (e) {}

    logAuditTrail('FINANCE_INVESTMENT_LOG_DELETED', {
      id,
      deletedRecord: existing
    }, 'Admin');
  }

  return res.changes > 0;
}

module.exports = {
  getFinanceConfig,
  updateFinanceConfig,
  getAllAccounts,
  saveAccount,
  deleteAccount,
  recordTransaction,
  recordManualTransaction: recordTransaction,
  getFinanceSummary,
  performWeeklyAudit,
  getOrderFinanceDetails,
  deleteTransaction,
  getAllDebts,
  saveDebt,
  recordDebtPayment,
  crossOffsetDebts,
  deleteDebt,
  getAllInstallments,
  saveInstallment,
  payInstallmentQuota,
  deleteInstallment,
  recordCollegeAllowance,
  getAllMobilePlans,
  saveMobilePlan,
  executeMobileRecharge,
  deleteMobilePlan,
  getAllInvestmentLogs,
  saveInvestmentLog,
  deleteInvestmentLog
};

