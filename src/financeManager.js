const sqliteDb = require('./database');
const { readDB, writeDB } = require('./db');

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
        WHEN 'card' THEN 2 
        WHEN 'emergency' THEN 3 
        WHEN 'investment' THEN 4 
        WHEN 'cash' THEN 5 
        ELSE 6 
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
  const color = accData.color || (type === 'credit' ? '#ec4899' : '#38bdf8');
  const icon = accData.icon || (type === 'credit' ? 'credit-card' : 'wallet');
  const description = accData.description || '';

  // Credit Card fields
  const creditLimit = Math.max(0, parseFloat(accData.creditLimit) || 0);
  const cutoffDay = Math.max(0, Math.min(31, parseInt(accData.cutoffDay) || 0));
  const paymentDueDay = Math.max(0, Math.min(31, parseInt(accData.paymentDueDay) || 0));
  const currentDebt = Math.max(0, parseFloat(accData.currentDebt !== undefined ? accData.currentDebt : accData.debt) || 0);
  const minPayment = Math.max(0, parseFloat(accData.minPayment) || 0);

  const existing = sqliteDb.prepare('SELECT id FROM FinanceAccounts WHERE id = ?').get(id);
  if (existing) {
    sqliteDb.prepare(`
      UPDATE FinanceAccounts 
      SET name = ?, type = ?, currency = ?, currentBalance = ?, color = ?, icon = ?, description = ?,
          creditLimit = ?, cutoffDay = ?, paymentDueDay = ?, currentDebt = ?, minPayment = ?,
          updatedAt = datetime('now')
      WHERE id = ?
    `).run(name, type, currency, currentBalance, color, icon, description, creditLimit, cutoffDay, paymentDueDay, currentDebt, minPayment, id);
  } else {
    sqliteDb.prepare(`
      INSERT INTO FinanceAccounts (id, name, type, currency, initialBalance, currentBalance, color, icon, description, creditLimit, cutoffDay, paymentDueDay, currentDebt, minPayment, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(id, name, type, currency, initialBalance, currentBalance, color, icon, description, creditLimit, cutoffDay, paymentDueDay, currentDebt, minPayment);
  }

  return sqliteDb.prepare('SELECT * FROM FinanceAccounts WHERE id = ?').get(id);
}

/**
 * Eliminar / archivar cuenta
 */
function deleteAccount(id) {
  const stmt = sqliteDb.prepare("UPDATE FinanceAccounts SET isArchived = 1, updatedAt = datetime('now') WHERE id = ?");
  return stmt.run(id).changes > 0;
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

  const reinvestPercent = data.reinvestPercent !== undefined 
    ? Math.max(0, Math.min(100, parseFloat(data.reinvestPercent))) 
    : config.reinvestPercent;

  let reinvestAmount = 0;
  let netProfit = 0;

  if (grossProfit > 0) {
    reinvestAmount = Math.round((grossProfit * (reinvestPercent / 100)) * 100) / 100;
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
      return sqliteDb.prepare(`
        SELECT id FROM FinanceAccounts 
        WHERE id = ? OR name = ? OR name LIKE ? OR ? LIKE ('%' || name || '%')
        LIMIT 1
      `).get(accName, accName, `%${accName}%`, accName);
    };

    const targetOrigin = findAcc(account);
    const targetDest = destAccount ? findAcc(destAccount) : null;

    if (type === 'expense_manual') {
      if (targetOrigin) {
        // Si es tarjeta de crédito, un gasto aumenta la deuda
        sqliteDb.prepare(`
          UPDATE FinanceAccounts 
          SET currentBalance = currentBalance - ?,
              currentDebt = CASE WHEN type = 'credit' THEN currentDebt + ? ELSE currentDebt END,
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
              currentDebt = CASE WHEN type = 'credit' THEN MAX(0, currentDebt - ?) ELSE currentDebt END,
              updatedAt = datetime('now') 
          WHERE id = ?
        `).run(chargedAmount, chargedAmount, targetOrigin.id);
      }
    } else if (type === 'transfer' && targetDest) {
      if (targetOrigin) {
        sqliteDb.prepare(`
          UPDATE FinanceAccounts 
          SET currentBalance = currentBalance - ?,
              currentDebt = CASE WHEN type = 'credit' THEN currentDebt + ? ELSE currentDebt END,
              updatedAt = datetime('now') 
          WHERE id = ?
        `).run(costAmount, costAmount, targetOrigin.id);
      }
      sqliteDb.prepare(`
        UPDATE FinanceAccounts 
        SET currentBalance = currentBalance + ?,
            currentDebt = CASE WHEN type = 'credit' THEN MAX(0, currentDebt - ?) ELSE currentDebt END,
            updatedAt = datetime('now') 
        WHERE id = ?
      `).run(costAmount, costAmount, targetDest.id);
    }

    // Respaldar automáticamente ante movimientos financieros
    try {
      const { createAutoBackup } = require('./backupEngine');
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
      COALESCE(SUM(netProfit), 0) as totalNetProfit
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

  return {
    config,
    summary: {
      count: totalRow.count,
      totalCharged: totalRow.totalCharged,
      totalCost: totalRow.totalCost,
      totalGrossProfit: totalRow.totalGrossProfit,
      totalReinvest: totalRow.totalReinvest,
      totalNetProfit: totalRow.totalNetProfit
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
    return sqliteDb.prepare(`
      SELECT id FROM FinanceAccounts 
      WHERE id = ? OR name = ? OR name LIKE ? OR ? LIKE ('%' || name || '%')
      LIMIT 1
    `).get(accName, accName, `%${accName}%`, accName);
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
          currentDebt = CASE WHEN type = 'credit' THEN MAX(0, currentDebt - ?) ELSE currentDebt END,
          updatedAt = datetime('now')
      WHERE id = ?
    `).run(costAmount, costAmount, targetOrigin.id);
  } else if ((tx.type === 'income_ticket' || tx.type === 'income_manual') && targetOrigin) {
    // Al eliminar un ingreso, se descuenta el dinero que había entrado
    sqliteDb.prepare(`
      UPDATE FinanceAccounts 
      SET currentBalance = currentBalance - ?,
          currentDebt = CASE WHEN type = 'credit' THEN currentDebt + ? ELSE currentDebt END,
          updatedAt = datetime('now')
      WHERE id = ?
    `).run(chargedAmount, chargedAmount, targetOrigin.id);
  } else if (tx.type === 'transfer') {
    // Revertir transferencia: origen vuelve a sumar, destino vuelve a restar
    if (targetOrigin) {
      sqliteDb.prepare(`
        UPDATE FinanceAccounts 
        SET currentBalance = currentBalance + ?,
            currentDebt = CASE WHEN type = 'credit' THEN MAX(0, currentDebt - ?) ELSE currentDebt END,
            updatedAt = datetime('now')
        WHERE id = ?
      `).run(costAmount, costAmount, targetOrigin.id);
    }
    if (targetDest) {
      sqliteDb.prepare(`
        UPDATE FinanceAccounts 
        SET currentBalance = currentBalance - ?,
            currentDebt = CASE WHEN type = 'credit' THEN currentDebt + ? ELSE currentDebt END,
            updatedAt = datetime('now')
        WHERE id = ?
      `).run(costAmount, costAmount, targetDest.id);
    }
  }

  // Eliminar el registro del libro contable
  const res = sqliteDb.prepare(`DELETE FROM FinanceLedger WHERE id = ?`).run(id);

  // Auto-backup de seguridad tras reversión
  try {
    const { createAutoBackup } = require('./backupEngine');
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
    sql += ' ORDER BY CASE WHEN status = "settled" THEN 1 ELSE 0 END, createdAt DESC';
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
    const stmt = sqliteDb.prepare(`
      UPDATE FinanceDebts 
      SET personName = ?, type = ?, totalAmount = ?, paidAmount = ?, remainingAmount = ?,
          concept = ?, dueDate = ?, phone = ?, notes = ?, status = ?, updatedAt = datetime('now')
      WHERE id = ?
    `);
    stmt.run(personName, type, totalAmount, paidAmount, remainingAmount, concept, dueDate, phone, notes, status, id);
  } else {
    const stmt = sqliteDb.prepare(`
      INSERT INTO FinanceDebts (id, personName, type, totalAmount, paidAmount, remainingAmount, concept, dueDate, phone, notes, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    stmt.run(id, personName, type, totalAmount, paidAmount, remainingAmount, concept, dueDate, phone, notes, status);
  }

  return sqliteDb.prepare('SELECT * FROM FinanceDebts WHERE id = ?').get(id);
}

/**
 * Registrar un abono o liquidación a una deuda y opcionalmente mover el dinero a una cuenta bancaria/caja
 */
function recordDebtPayment(debtId, paymentAmount, accountName) {
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

  // Si se especificó una cuenta, registrar el movimiento en FinanceLedger y FinanceAccounts
  if (accountName) {
    const isReceivable = debt.type === 'receivable';
    // Si me deben y me pagan: es un ingreso a mi cuenta (income_manual)
    // Si yo debo y pago: es un gasto de mi cuenta (expense_manual)
    const ledgerType = isReceivable ? 'income_manual' : 'expense_manual';
    const noteText = isReceivable 
      ? `Abono de ${debt.personName} a deuda #${debt.id.slice(-6)}: ${debt.concept || 'Deuda'}`
      : `Pago realizado a ${debt.personName} por deuda #${debt.id.slice(-6)}: ${debt.concept || 'Deuda'}`;

    recordTransaction({
      type: ledgerType,
      category: isReceivable ? 'otros' : 'servicios',
      serviceName: noteText,
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
  const stmt = sqliteDb.prepare('DELETE FROM FinanceDebts WHERE id = ?');
  const res = stmt.run(id);
  return res.changes > 0;
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
  }

  return sqliteDb.prepare('SELECT * FROM FinanceInstallments WHERE id = ?').get(id);
}

function payInstallmentQuota(installmentId, quotaCount = 1, paymentAccount = 'Efectivo / Caja') {
  const item = sqliteDb.prepare('SELECT * FROM FinanceInstallments WHERE id = ?').get(installmentId);
  if (!item) throw new Error('Plan de cuotas no encontrado.');

  const count = Math.max(1, parseInt(quotaCount) || 1);
  const newPaid = Math.min(item.totalQuotas, (item.paidQuotas || 0) + count);
  const newStatus = newPaid >= item.totalQuotas ? 'completed' : 'active';
  const paidAmount = parseFloat((item.quotaAmount * count).toFixed(2));

  sqliteDb.prepare(`
    UPDATE FinanceInstallments 
    SET paidQuotas = ?, status = ?, updatedAt = datetime('now') 
    WHERE id = ?
  `).run(newPaid, newStatus, installmentId);

  // Registrar el gasto contable en FinanceLedger y descontar de la cuenta con la que se pagó la mensualidad
  if (paymentAccount) {
    recordTransaction({
      type: 'expense_manual',
      category: 'servicios',
      serviceName: `Pago Mensualidad (${newPaid}/${item.totalQuotas}): ${item.title}`,
      chargedAmount: 0,
      costAmount: paidAmount,
      account: paymentAccount,
      notes: `Cuota ${newPaid}/${item.totalQuotas} de ${item.title} (${item.accountName || 'Nu'}). Ref: ${item.referenceNumber || 'N/A'}`,
      recordedBy: 'Admin'
    });
  }

  return sqliteDb.prepare('SELECT * FROM FinanceInstallments WHERE id = ?').get(installmentId);
}

function deleteInstallment(id) {
  const stmt = sqliteDb.prepare('DELETE FROM FinanceInstallments WHERE id = ?');
  return stmt.run(id).changes > 0;
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
  deleteDebt,
  getAllInstallments,
  saveInstallment,
  payInstallmentQuota,
  deleteInstallment,
  recordCollegeAllowance
};

