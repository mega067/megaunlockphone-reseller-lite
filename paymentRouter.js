const config = require('./bankConfig');

/**
 * Determina qué cuenta bancaria proporcionar al usuario para forzar una transferencia SPEI
 * basada en la liquidez actual del administrador y el banco emisor del usuario.
 * 
 * @param {number} requestedAmount - El monto que el usuario quiere depositar (en MXN)
 * @param {string} userBankCode - El código CEP (Banxico) del banco del usuario
 * @param {number} adminLiquidity - Liquidez total del admin (suma de los saldos en servidores Dhru)
 * @param {string} overrideMode - 'FORCE_SERVER', 'FORCE_ADMIN', o 'INTELLIGENT'
 * @returns {object} - La cuenta a la cual el usuario debe depositar y un flag indicando si es cuenta de proveedor
 */
async function getDepositAccount(requestedAmount, userBankCode, serverLiquidity, overrideMode = 'INTELLIGENT', targetProviderKey = null) {
  let isProviderAccount = false;
  let selectedAccount = null;

  // 0. Restricciones de monto mínimo
  let providerMin = 0;
  if (targetProviderKey === 'latamgsm') providerMin = 50;
  else if (targetProviderKey === 'unlockerfast') providerMin = 100;

  // Si el monto es menor al mínimo del proveedor, estamos OBLIGADOS a usar una cuenta del Admin
  // Pero ANTES de forzarla, debemos verificar si el Admin tiene liquidez suficiente en ESE servidor
  if (requestedAmount < providerMin) {
    if (serverLiquidity < (requestedAmount + config.MIN_LIQUIDITY_THRESHOLD) && overrideMode !== 'FORCE_ADMIN') {
      // El admin NO tiene saldo cedible. El usuario no puede hacer esta recarga.
      return { error: `El proveedor requiere un mínimo de $${providerMin} y por el momento no contamos con saldo cedible suficiente. Por favor recarga al menos $${providerMin}.` };
    }
  }

  // 1. Evaluar Liquidez (o si está forzado)
  // Usamos cuenta admin si: 1) monto es menor al mínimo del proveedor y ya pasamos la validación de liquidez
  // 2) si está forzado a ADMIN
  // 3) si hay liquidez y NO está forzado a SERVIDOR
  if (requestedAmount < providerMin || overrideMode === 'FORCE_ADMIN' || (overrideMode !== 'FORCE_SERVER' && serverLiquidity >= (requestedAmount + config.MIN_LIQUIDITY_THRESHOLD))) {
    // Buscar una cuenta del ADMIN que NO sea del mismo banco que el usuario (para forzar SPEI)
    selectedAccount = config.ADMIN_ACCOUNTS.find(acc => acc.bankCode !== userBankCode);
  }

  // 2. Si no hay liquidez O si todas las cuentas del admin son del mismo banco que el usuario (raro, pero posible)
  if (!selectedAccount) {
    // Necesitamos que el cliente fondee directo al proveedor seleccionado
    isProviderAccount = true;
    
    if (targetProviderKey && config.PROVIDER_ACCOUNTS[targetProviderKey]) {
      const provider = config.PROVIDER_ACCOUNTS[targetProviderKey];
      
      // Intentar obtener las cuentas en tiempo real (evita problemas si cambian la CLABE)
      const axios = require('axios');
      try {
        let liveAccounts = [];
        let scrapeUrl = provider.apiUrl.replace('/api/comprobarpago/transferencia/', '/autopay.php');
        if (targetProviderKey === 'unlockerfast') {
          scrapeUrl = 'https://www.unlockerfast.com.mx/autopayv2.php';
        }
        const { data } = await axios.get(scrapeUrl);
        
        let bankNames = {};
        try { bankNames = require('cep-banxico/src/banks').BANKS || {}; } catch(e){}

        if (targetProviderKey === 'latamgsm') {
          const matches = [...data.matchAll(/seleccionarTarjetaDestino\((\d+),\s*'([^']+)',\s*'([^']+)',\s*\d+,\s*\d+,\s*'([^']+)'/g)];
          liveAccounts = matches.map(m => {
            const bCode = m[4];
            return { id: 'latam_' + m[1], bankName: bankNames[bCode] || 'Banco', bankCode: bCode, clabe: m[3], ownerName: m[2], tarjetaId: m[1] };
          });
        } else {
          const matches = [...data.matchAll(/<h5 class="card-title">([^<]+)<\/h5>\s*<p class="card-text">(\d+)<\/p>[\s\S]*?abrirModalePagos\((\d+)\)/g)];
          liveAccounts = matches.map(m => {
            const clabe = m[2];
            let bankName = 'Banco';
            let bankCode = '40000';
            
            if (clabe.startsWith('062') || clabe === '4130980402935421') {
              bankName = 'Afirme';
              bankCode = '40062';
            } else if (clabe.startsWith('058') || clabe === '4741742955302941') {
              bankName = 'Banregio';
              bankCode = '40058';
            }
            
            return { id: 'unlocker_' + m[3], bankName, bankCode, clabe, ownerName: m[1].trim(), tarjetaId: m[3] };
          });
        }
        if (liveAccounts.length > 0) provider.accounts = liveAccounts;
      } catch (e) {
        console.error('Error fetching live accounts for ' + targetProviderKey, e.message);
      }

      const validAccounts = provider.accounts.filter(acc => acc.bankCode !== userBankCode);
      if (validAccounts.length > 0) {
        selectedAccount = validAccounts[0];
        
        // Asignar keys a TODAS las cuentas válidas
        validAccounts.forEach(acc => {
          acc.providerKey = targetProviderKey;
          acc.providerApiKey = provider.apiKey;
          acc.providerApiUrl = provider.apiUrl;
        });
        
        isProviderAccount = true;
        // Retornamos todas para la web
        return {
          account: selectedAccount,
          accounts: validAccounts,
          isProvider: true
        };
      }
    }
  }

  // 3. Fallback absoluto (si de pura casualidad el usuario tiene cuenta en TODOS los bancos que configuramos)
  // En la práctica casi imposible, pero devolvemos la primera cuenta del admin
  if (!selectedAccount) {
    selectedAccount = config.ADMIN_ACCOUNTS[0];
    isProviderAccount = false;
  }

  return {
    account: selectedAccount,
    accounts: [selectedAccount],
    isProvider: isProviderAccount
  };
}

module.exports = {
  getDepositAccount
};
