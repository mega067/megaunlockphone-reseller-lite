const financeManager = require('../financeManager');
const sqliteDb = require('../database');
const path = require('path');
const { readDB } = require('../db');
const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

/**
 * Obtener lista de cuentas activas en FinanceAccounts
 */
function getActiveAccounts() {
    try {
        const rows = sqliteDb.prepare(`
            SELECT id, name, type, currentBalance, color, icon 
            FROM FinanceAccounts 
            WHERE isArchived = 0 
            ORDER BY id ASC
        `).all();
        if (rows && rows.length > 0) return rows;
    } catch (e) {}

    return [
        { id: 'acc_cash', name: 'Efectivo / Caja', type: 'cash' },
        { id: 'acc_nu', name: 'Nu Crédito / Débito', type: 'card' },
        { id: 'acc_bbva', name: 'BBVA', type: 'bank' },
        { id: 'acc_revolut', name: 'Revolut', type: 'bank' },
        { id: 'acc_mp', name: 'Mercado Pago', type: 'bank' }
    ];
}

/**
 * Mapeo de categorías con iconos amigables
 */
const CATEGORIES_EXPENSE = [
    { key: 'pasaje', label: '🚌 Pasaje / Transporte / Gasolina', desc: 'Pasaje' },
    { key: 'comida', label: '🍔 Comida / Almuerzo / Super', desc: 'Comida' },
    { key: 'servidores', label: '🖥️ Servidores / Recarga DHRU', desc: 'Servidores' },
    { key: 'gustos', label: '🎉 Gustos / Salidas / Personal', desc: 'Personal' },
    { key: 'emergencia', label: '🚨 Emergencia / Imprevisto', desc: 'Emergencia' },
    { key: 'servicios', label: '⚡ Servicios (Luz, Internet, VPS)', desc: 'Servicios' },
    { key: 'otros', label: '📦 Otros / General', desc: 'Gasto' }
];

const CATEGORIES_INCOME = [
    { key: 'mesada', label: '🎁 Mesada / Apoyo Familiar', desc: 'Mesada' },
    { key: 'pasaje_apoyo', label: '🚌 Dinero para Pasaje / Transporte', desc: 'Para Pasaje' },
    { key: 'comida_apoyo', label: '🍔 Dinero para Comida', desc: 'Para Comida' },
    { key: 'venta_servicio', label: '📱 Cobro por Desbloqueo / Servicio', desc: 'Cobro Cliente' },
    { key: 'otros', label: '🟢 Ingreso General / Otro', desc: 'Ingreso' }
];

/**
 * Manejador principal de comandos de finanzas en el bot:
 * - pago / gastar / gasto
 * - recibido / ingreso / mesada
 */
async function financeBotCommands(context) {
    const { sock, remoteJid, firstWord, args, text, sessionManager, wusers } = context;
    const linkedUserId = wusers[remoteJid];
    const users = readDB(USERS_FILE) || [];
    const user = users.find(u => u.id === linkedUserId);

    // Solo accesible por el administrador (dueño del negocio y finanzas)
    if (!user || user.role !== 'admin') return false;

    const cmd = (firstWord || '').toLowerCase();
    const isPagoCmd = ['/pago', '!pago', 'pago', '/gasto', '!gasto', 'gasto', '/pagar', '!pagar', 'pagar'].includes(cmd);
    const isRecibidoCmd = ['/recibido', '!recibido', 'recibido', '/recibi', '!recibi', 'recibi', '/mesada', '!mesada', 'mesada', '/ingreso', '!ingreso', 'ingreso'].includes(cmd);
    const isDebtsListCmd = ['/deudores', '!deudores', 'deudores', '/deudas', '!deudas', 'deudas'].includes(cmd);
    const isNewDebtCmd = ['/deudor', '!deudor', 'deudor', '/medeben', '!medeben', 'medeben', '/debo', '!debo', 'debo', '/prestamo', '!prestamo', 'prestamo'].includes(cmd);
    const isAbonoCmd = ['/abono', '!abono', 'abono', '/abonar', '!abonar', 'abonar'].includes(cmd);

    // 0. LISTAR DEUDAS Y DEUDORES: /deudores o /deudas
    if (isDebtsListCmd) {
        const data = financeManager.getAllDebts();
        const debts = data.debts || [];
        const s = data.summary || {};

        if (debts.length === 0) {
            await sock.sendMessage(remoteJid, {
                text: `📋 *CONTROL DE DEUDAS Y DEUDORES*\n━━━━━━━━━━━━━━━━━━━━━━\n🎉 ¡No tienes deudas activas ni deudores registrados!\n\n_Para registrar un deudor escribe:_\n*deudor <Nombre> <Monto> [Concepto]*\n_Para registrar a quién le debes:_\n*debo <Nombre> <Monto> [Concepto]*`
            });
            return true;
        }

        let report = `📋 *CONTROL DE DEUDAS & DEUDORES* 📋\n` +
                     `━━━━━━━━━━━━━━━━━━━━━━\n` +
                     `🟢 *Me Deben:* $${parseFloat(s.pendingReceivable || 0).toFixed(2)} MXN\n` +
                     `🔴 *Yo Debo:* $${parseFloat(s.pendingPayable || 0).toFixed(2)} MXN\n` +
                     `📊 *Balance Neto:* ${s.netBalance >= 0 ? '+' : ''}$${parseFloat(s.netBalance || 0).toFixed(2)} MXN\n` +
                     `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        const receivables = debts.filter(d => d.type === 'receivable' && d.status !== 'settled');
        const payables = debts.filter(d => d.type === 'payable' && d.status !== 'settled');
        const settled = debts.filter(d => d.status === 'settled');

        if (receivables.length > 0) {
            report += `🟢 *PERSONAS QUE ME DEBEN:*\n`;
            receivables.forEach((d, idx) => {
                const rem = parseFloat(d.remainingAmount || 0);
                const tot = parseFloat(d.totalAmount || 0);
                report += `${idx + 1}. *${d.personName}:* Resta *$${rem.toFixed(2)}* (de $${tot.toFixed(2)})\n   _Concepto: ${d.concept || 'Préstamo'}_${d.dueDate ? ` | Vence: ${d.dueDate}` : ''}\n`;
            });
            report += `\n`;
        }

        if (payables.length > 0) {
            report += `🔴 *DEUDAS QUE YO DEBO:*\n`;
            payables.forEach((d, idx) => {
                const rem = parseFloat(d.remainingAmount || 0);
                const tot = parseFloat(d.totalAmount || 0);
                report += `${idx + 1}. *${d.personName}:* Debo *$${rem.toFixed(2)}* (de $${tot.toFixed(2)})\n   _Concepto: ${d.concept || 'Deuda'}_${d.dueDate ? ` | Vence: ${d.dueDate}` : ''}\n`;
            });
            report += `\n`;
        }

        report += `━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `💡 *Comandos rápidos:*\n` +
                  `• *deudor <Nombre> <Monto>* ➔ Registrar alguien que te debe\n` +
                  `• *debo <Nombre> <Monto>* ➔ Registrar a quién le debes\n` +
                  `• *abono <Nombre> <Monto>* ➔ Registrar abono o pago recibido`;

        await sock.sendMessage(remoteJid, { text: report });
        return true;
    }

    // REGISTRAR NUEVA DEUDA DIRECTA: /deudor <Nombre> <Monto> [Concepto] o /debo <Nombre> <Monto> [Concepto]
    if (isNewDebtCmd) {
        const isReceivable = !cmd.includes('debo');
        if (args.length >= 3) {
            const personName = args[1].trim();
            const rawAmount = parseFloat(args[2].replace('$', '').trim());
            const concept = args.slice(3).join(' ').trim() || (isReceivable ? 'Préstamo / Deuda' : 'Deuda pendiente');

            if (isNaN(rawAmount) || rawAmount <= 0) {
                await sock.sendMessage(remoteJid, { text: '❌ Monto inválido. Ejemplo: *deudor Juan 350 Desbloqueo*' });
                return true;
            }

            try {
                const newDebt = financeManager.saveDebt({
                    personName,
                    type: isReceivable ? 'receivable' : 'payable',
                    totalAmount: rawAmount,
                    paidAmount: 0,
                    concept
                });

                const icon = isReceivable ? '🟢' : '🔴';
                await sock.sendMessage(remoteJid, {
                    text: `✅ *DEUDA REGISTRADA CON ÉXITO*\n` +
                          `━━━━━━━━━━━━━━━━━━━━━━\n` +
                          `${icon} *Tipo:* ${isReceivable ? 'Me deben dinero (Deudor)' : 'Yo le debo dinero (Acreedor)'}\n` +
                          `👤 *Persona / Entidad:* ${personName}\n` +
                          `💵 *Monto Total:* $${rawAmount.toFixed(2)} MXN\n` +
                          `🏷️ *Concepto:* ${concept}\n` +
                          `━━━━━━━━━━━━━━━━━━━━━━\n` +
                          `_Registrado y visible en tu panel web en Deudores & Deudas._`
                });
                return true;
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: `❌ Error al registrar deuda: ${err.message}` });
                return true;
            }
        } else {
            await sock.sendMessage(remoteJid, {
                text: `📝 *REGISTRO RÁPIDO DE DEUDAS*\n━━━━━━━━━━━━━━━━━━━━━━\n` +
                      `Usa este formato:\n` +
                      `• *deudor <Nombre> <Monto> [Concepto]*\n` +
                      `  _Ejemplo: deudor Pedro 450 pantalla_\n\n` +
                      `• *debo <Nombre> <Monto> [Concepto]*\n` +
                      `  _Ejemplo: debo Taller 600 refacción_\n\n` +
                      `• Escribe *deudores* para ver la lista completa.`
            });
            return true;
        }
    }

    // REGISTRAR ABONO: /abono <Nombre> <Monto>
    if (isAbonoCmd) {
        if (args.length >= 3) {
            const searchName = args[1].toLowerCase().trim();
            const payAmt = parseFloat(args[2].replace('$', '').trim());
            if (isNaN(payAmt) || payAmt <= 0) {
                await sock.sendMessage(remoteJid, { text: '❌ Monto de abono inválido. Ejemplo: *abono Juan 150*' });
                return true;
            }

            const data = financeManager.getAllDebts();
            const match = (data.debts || []).find(d => 
                d.status !== 'settled' && 
                (d.personName.toLowerCase().includes(searchName) || searchName.includes(d.personName.toLowerCase()))
            );

            if (!match) {
                await sock.sendMessage(remoteJid, {
                    text: `❌ No se encontró ninguna deuda activa para "${args[1]}". Escribe *deudores* para ver los nombres exactos.`
                });
                return true;
            }

            try {
                const updated = financeManager.recordDebtPayment(match.id, payAmt, 'Efectivo / Caja');
                const isSettled = updated.status === 'settled';

                await sock.sendMessage(remoteJid, {
                    text: `✅ *ABONO REGISTRADO CON ÉXITO*\n` +
                          `━━━━━━━━━━━━━━━━━━━━━━\n` +
                          `👤 *Persona:* ${updated.personName}\n` +
                          `💵 *Abono aplicado:* $${payAmt.toFixed(2)} MXN\n` +
                          `📊 *Resta por liquidar:* $${parseFloat(updated.remainingAmount || 0).toFixed(2)} MXN\n` +
                          `📌 *Estado:* ${isSettled ? '🎉 ¡TOTALMENTE LIQUIDADO!' : '⏳ Pendiente saldo restante'}\n` +
                          `━━━━━━━━━━━━━━━━━━━━━━\n` +
                          `_Registrado automáticamente en tus ingresos y reflejado en la web._`
                });
                return true;
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: `❌ Error al registrar abono: ${err.message}` });
                return true;
            }
        } else {
            await sock.sendMessage(remoteJid, {
                text: `💵 *REGISTRAR ABONO O PAGO*\n━━━━━━━━━━━━━━━━━━━━━━\nFormato:\n*abono <Nombre> <Monto>*\n\n_Ejemplo: abono Juan 200_\n_Escribe *deudores* para ver la lista de pendientes._`
            });
            return true;
        }
    }

    // 1. INICIAR COMANDO: /pago o /recibido
    if (isPagoCmd || isRecibidoCmd) {
        const isExpense = isPagoCmd;
        const opType = isExpense ? 'expense_manual' : 'income_manual';
        const accounts = getActiveAccounts();

        // Ver si el usuario pasó argumentos directos: ej "pago 50 comida" o "recibido 100 mesada"
        let initialAmount = 0;
        let initialNote = '';
        if (args.length >= 2) {
            const parsed = parseFloat(args[1].replace('$', '').trim());
            if (!isNaN(parsed) && parsed > 0) {
                initialAmount = parsed;
                if (args.length >= 3) {
                    initialNote = args.slice(2).join(' ').trim();
                }
            }
        }

        // Si se usó específicamente "mesada" sin argumentos, precargar concepto
        if (cmd.includes('mesada') && !initialNote) {
            initialNote = 'Mesada / Apoyo';
        }

        sessionManager.financeSessions = sessionManager.financeSessions || {};
        sessionManager.financeSessions[remoteJid] = {
            step: initialAmount > 0 ? 'CHOOSE_ACCOUNT' : 'ENTER_AMOUNT',
            type: opType,
            amount: initialAmount,
            notes: initialNote,
            category: initialNote.toLowerCase().includes('mesada') ? 'mesada' : (initialNote.toLowerCase().includes('pasaje') ? 'pasaje' : (initialNote.toLowerCase().includes('comida') ? 'comida' : 'otros')),
            accounts
        };

        const session = sessionManager.financeSessions[remoteJid];

        if (session.step === 'ENTER_AMOUNT') {
            const title = isExpense ? '💸 *REGISTRAR PAGO / GASTO*' : '💰 *REGISTRAR DINERO RECIBIDO / MESADA*';
            await sock.sendMessage(remoteJid, {
                text: `${title}\n━━━━━━━━━━━━━━━━━━━━━━\n¿Cuánto dinero fue? Escribe el monto en pesos (MXN):\n\n_Ejemplo: 45, 120.50 o 500_\n_(Escribe *cancelar* para salir)_`
            });
            return true;
        }

        // Si ya nos dio el monto, pasar a seleccionar cuenta
        await promptSelectAccount(sock, remoteJid, session);
        return true;
    }

    // 2. CONTINUAR SESIÓN ACTIVA DE FINANZAS
    if (sessionManager.financeSessions && sessionManager.financeSessions[remoteJid]) {
        const session = sessionManager.financeSessions[remoteJid];
        const trimmed = text.trim();

        if (trimmed.toLowerCase() === 'cancelar') {
            delete sessionManager.financeSessions[remoteJid];
            await sock.sendMessage(remoteJid, { text: '🚫 Operación financiera cancelada.' });
            return true;
        }

        // PASO 1: Ingresar Monto
        if (session.step === 'ENTER_AMOUNT') {
            const cleanNum = trimmed.replace('$', '').replace(',', '').trim();
            const amt = parseFloat(cleanNum);
            if (isNaN(amt) || amt <= 0) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Por favor ingresa un monto numérico válido mayor a 0.\n\n_Ejemplo: 65 o 150.00 (o escribe *cancelar*)_'
                });
                return true;
            }
            session.amount = amt;
            session.step = 'CHOOSE_ACCOUNT';
            await promptSelectAccount(sock, remoteJid, session);
            return true;
        }

        // PASO 2: Elegir Cuenta / Tarjeta
        if (session.step === 'CHOOSE_ACCOUNT') {
            let selectedAcc = null;
            const numIdx = parseInt(trimmed);

            if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= session.accounts.length) {
                selectedAcc = session.accounts[numIdx - 1];
            } else {
                // Búsqueda por nombre (ej: "efectivo", "nu", "bbva", etc.)
                const match = session.accounts.find(a => 
                    a.name.toLowerCase().includes(trimmed.toLowerCase()) || 
                    a.id.toLowerCase().includes(trimmed.toLowerCase())
                );
                if (match) selectedAcc = match;
            }

            if (!selectedAcc) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Opción inválida. Responde con el número de la cuenta o su nombre (ej: 1, 2, efectivo, nu).'
                });
                return true;
            }

            session.account = selectedAcc;

            // Si ya tenemos nota/concepto, saltar directo a confirmación
            if (session.notes) {
                session.step = 'CONFIRM';
                await promptConfirmation(sock, remoteJid, session);
                return true;
            }

            session.step = 'CHOOSE_CATEGORY';
            await promptSelectCategory(sock, remoteJid, session);
            return true;
        }

        // PASO 3: Elegir Categoría o Concepto
        if (session.step === 'CHOOSE_CATEGORY') {
            const isExpense = session.type === 'expense_manual';
            const catList = isExpense ? CATEGORIES_EXPENSE : CATEGORIES_INCOME;
            let chosenCat = null;
            let customNote = '';

            const numIdx = parseInt(trimmed);
            if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= catList.length) {
                chosenCat = catList[numIdx - 1];
                customNote = chosenCat.desc;
            } else {
                // Si escribió texto libre (ej: "tacos de la esquina", "pasaje a la uni", "mesada de papá")
                customNote = trimmed;
                const low = trimmed.toLowerCase();
                if (low.includes('pasaje') || low.includes('camion') || low.includes('uber') || low.includes('gasolina')) {
                    chosenCat = { key: 'pasaje' };
                } else if (low.includes('comida') || low.includes('tacos') || low.includes('almuerzo') || low.includes('cena')) {
                    chosenCat = { key: 'comida' };
                } else if (low.includes('mesada')) {
                    chosenCat = { key: 'mesada' };
                } else if (low.includes('server') || low.includes('dhru') || low.includes('proveedor')) {
                    chosenCat = { key: 'servidores' };
                } else {
                    chosenCat = { key: 'otros' };
                }
            }

            session.category = chosenCat ? chosenCat.key : 'otros';
            session.notes = customNote || (isExpense ? 'Gasto' : 'Ingreso');
            session.step = 'CONFIRM';

            await promptConfirmation(sock, remoteJid, session);
            return true;
        }

        // PASO 4: Confirmación Final
        if (session.step === 'CONFIRM') {
            const ans = trimmed.toLowerCase();
            const isConfirm = ans === 'si' || ans === 'sí' || ans.includes('si') || ans.includes('proceder') || ans.includes('✅') || ans === '1';

            if (isConfirm) {
                try {
                    const isExpense = session.type === 'expense_manual';
                    const payload = {
                        type: session.type,
                        category: session.category || 'otros',
                        serviceName: session.notes || (isExpense ? 'Gasto' : 'Ingreso'),
                        chargedAmount: isExpense ? 0 : session.amount,
                        costAmount: isExpense ? session.amount : 0,
                        account: session.account.name,
                        notes: `Registrado vía WhatsApp Bot (${user.username || 'admin'})`,
                        recordedBy: user.username || 'admin'
                    };

                    const entry = financeManager.recordManualTransaction(payload);

                    // Consultar saldo actualizado de la cuenta
                    let updatedBalance = 0;
                    try {
                        const row = sqliteDb.prepare('SELECT currentBalance FROM FinanceAccounts WHERE id = ?').get(session.account.id);
                        if (row) updatedBalance = parseFloat(row.currentBalance || 0);
                    } catch (e) {}

                    const iconEmoji = isExpense ? '🔴' : '🟢';
                    const successText = `✅ *OPERACIÓN REGISTRADA EXITOSAMENTE*\n` +
                                        `━━━━━━━━━━━━━━━━━━━━━━\n` +
                                        `${iconEmoji} *Tipo:* ${isExpense ? 'Pago / Gasto' : 'Dinero Recibido / Ingreso'}\n` +
                                        `💵 *Monto:* $${session.amount.toFixed(2)} MXN\n` +
                                        `🏷️ *Concepto:* ${session.notes}\n` +
                                        `🏦 *Cuenta / Tarjeta:* ${session.account.name}\n` +
                                        `📊 *Nuevo Saldo en Cuenta:* $${updatedBalance.toFixed(2)} MXN\n` +
                                        `━━━━━━━━━━━━━━━━━━━━━━\n` +
                                        `_Registrado en el Gestor de Finanzas y reflejado en tiempo real en tu panel web._`;

                    delete sessionManager.financeSessions[remoteJid];
                    await sock.sendMessage(remoteJid, { text: successText });
                    return true;
                } catch (saveErr) {
                    delete sessionManager.financeSessions[remoteJid];
                    await sock.sendMessage(remoteJid, { text: `❌ Error al guardar en finanzas: ${saveErr.message}` });
                    return true;
                }
            } else {
                delete sessionManager.financeSessions[remoteJid];
                await sock.sendMessage(remoteJid, { text: '🚫 Operación cancelada. No se realizó ningún movimiento.' });
                return true;
            }
        }
    }

    return false;
}

/**
 * Pregunta de qué cuenta saldrá o entrará el dinero
 */
async function promptSelectAccount(sock, remoteJid, session) {
    const isExpense = session.type === 'expense_manual';
    const actionWord = isExpense ? '¿De qué cuenta o tarjeta salió el dinero?' : '¿A qué cuenta o billetera entró el dinero?';

    let msg = `💳 *SELECCIONA LA CUENTA O TARJETA*\n` +
              `Monto: *$${session.amount.toFixed(2)} MXN*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n` +
              `${actionWord}\n\n`;

    const pollOptions = [];
    session.accounts.forEach((acc, idx) => {
        const bal = parseFloat(acc.currentBalance || 0);
        msg += `${idx + 1}️⃣ *${acc.name}* (Saldo: $${bal.toFixed(2)})\n`;
        pollOptions.push(`${idx + 1}️⃣ ${acc.name}`);
    });

    msg += `\n_Responde con el número de la cuenta o selecciónalo abajo:_`;

    await sock.sendMessage(remoteJid, { text: msg });

    if (pollOptions.length > 0 && pollOptions.length <= 12) {
        try {
            await sock.sendMessage(remoteJid, {
                poll: {
                    name: actionWord,
                    values: pollOptions,
                    selectableCount: 1
                }
            });
        } catch (e) {}
    }
}

/**
 * Pregunta en qué se gastó o de qué fue el dinero
 */
async function promptSelectCategory(sock, remoteJid, session) {
    const isExpense = session.type === 'expense_manual';
    const catList = isExpense ? CATEGORIES_EXPENSE : CATEGORIES_INCOME;
    const title = isExpense ? '¿En qué se gastó el dinero?' : '¿Cuál es el motivo o concepto del ingreso?';

    let msg = `🏷️ *CONCEPTO / CATEGORÍA*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n` +
              `${title}\n\n`;

    const pollValues = [];
    catList.forEach((c, idx) => {
        msg += `${idx + 1}️⃣ ${c.label}\n`;
        pollValues.push(`${idx + 1}️⃣ ${c.desc}`);
    });

    msg += `\n_Responde con el número de la opción o escribe tu propio concepto personalizado (ej: "tacos de bistec", "uber a la casa", "mesada abuelo")._`;

    await sock.sendMessage(remoteJid, { text: msg });

    if (pollValues.length > 0 && pollValues.length <= 12) {
        try {
            await sock.sendMessage(remoteJid, {
                poll: {
                    name: title,
                    values: pollValues,
                    selectableCount: 1
                }
            });
        } catch (e) {}
    }
}

/**
 * Resumen final antes de guardar
 */
async function promptConfirmation(sock, remoteJid, session) {
    const isExpense = session.type === 'expense_manual';
    const emoji = isExpense ? '💸' : '💰';

    let summary = `⚠️ *CONFIRMAR MOVIMIENTO FINANCIERO* ⚠️\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `${emoji} *Operación:* ${isExpense ? 'PAGO / GASTO' : 'DINERO RECIBIDO / INGRESO'}\n` +
                  `💵 *Monto:* $${session.amount.toFixed(2)} MXN\n` +
                  `🏦 *Cuenta:* ${session.account.name}\n` +
                  `🏷️ *Concepto:* ${session.notes}\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `¿Deseas registrar este movimiento en tus finanzas ahora?`;

    await sock.sendMessage(remoteJid, { text: summary });

    try {
        await sock.sendMessage(remoteJid, {
            poll: {
                name: '¿Confirmar registro?',
                values: ['✅ SÍ, REGISTRAR', '❌ CANCELAR'],
                selectableCount: 1
            }
        });
    } catch (e) {
        await sock.sendMessage(remoteJid, { text: 'Responde *SI* para registrar o *CANCELAR*.' });
    }
}

module.exports = financeBotCommands;
