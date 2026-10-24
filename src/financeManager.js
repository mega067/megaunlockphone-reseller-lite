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
  const initialBalance = parseFloat(accData.initialBalance) || 0;
  const currentBalance = accData.currentBalance !== undefined ? parseFloat(accData.currentBalance) : initialBalance;
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

  // Resumen de Gastos Personales por Categoría (Comida, Pasajes, Gustos, Servidores, etc.)
  const categoryRows = sqliteDb.prepare(`
    SELECT 
      COALESCE(category, 'otros') as category,
      COUNT(*) as count,
      COALESCE(SUM(costAmount), 0) as totalExpense,
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
 * Eliminar una entrada del ledger
 */
function deleteTransaction(id) {
  const stmt = sqliteDb.prepare(`DELETE FROM FinanceLedger WHERE id = ?`);
  const res = stmt.run(id);
  return res.changes > 0;
}

module.exports = {
  getFinanceConfig,
  updateFinanceConfig,
  getAllAccounts,
  saveAccount,
  deleteAccount,
  recordTransaction,
  getFinanceSummary,
  performWeeklyAudit,
  getOrderFinanceDetails,
  deleteTransaction
};
