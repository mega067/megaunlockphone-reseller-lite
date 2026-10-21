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
 * Registrar un movimiento contable (desde Ticket o manual)
 */
function recordTransaction(data) {
  const config = getFinanceConfig();
  const chargedAmount = Math.max(0, parseFloat(data.chargedAmount) || 0);
  const costAmount = Math.max(0, parseFloat(data.costAmount) || 0);
  const type = data.type || (data.orderId ? 'income_ticket' : 'income_manual');
  
  let grossProfit = 0;
  if (type === 'expense_manual') {
    grossProfit = -costAmount;
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
    // Si hubo pérdida o es gasto puro
    reinvestAmount = 0;
    netProfit = grossProfit;
  }

  const account = data.account ? String(data.account).trim() : 'General';
  const id = 'fin_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const createdAt = data.createdAt || new Date().toISOString();

  const stmt = sqliteDb.prepare(`
    INSERT INTO FinanceLedger (
      id, type, orderId, serviceName, chargedAmount, costAmount,
      grossProfit, reinvestPercent, reinvestAmount, netProfit,
      account, notes, recordedBy, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    data.notes || '',
    data.recordedBy || 'admin',
    createdAt
  );

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
    createdAt
  };
}

/**
 * Obtener estadísticas globales y balances por cuenta bancaria
 */
function getFinanceSummary(filterOptions = {}) {
  const config = getFinanceConfig();
  const orderId = filterOptions.orderId ? String(filterOptions.orderId).trim() : null;
  
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

  // Resumen por cuenta bancaria
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

  // Mapear cuentas asegurando que existan las configuradas (Nu, Revolut, etc.)
  const accountMap = {};
  config.accounts.forEach(acc => {
    accountMap[acc] = {
      account: acc,
      count: 0,
      balance: 0,
      charged: 0,
      cost: 0,
      grossProfit: 0,
      reinvestAmount: 0,
      netProfit: 0
    };
  });

  accountRows.forEach(row => {
    accountMap[row.account] = row;
  });

  // Movimientos recientes (o filtrados por ID de orden)
  let recent = [];
  if (orderId) {
    recent = sqliteDb.prepare(`
      SELECT * FROM FinanceLedger WHERE orderId = ? OR id = ? ORDER BY createdAt DESC
    `).all(orderId, orderId);
  } else {
    recent = sqliteDb.prepare(`
      SELECT * FROM FinanceLedger ORDER BY createdAt DESC LIMIT 150
    `).all();
  }

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
    accounts: Object.values(accountMap),
    recent
  };
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
      // Ganancia original registrada en la orden del servidor si aplica
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
  recordTransaction,
  getFinanceSummary,
  getOrderFinanceDetails,
  deleteTransaction
};
