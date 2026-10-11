// public/js/recharge.js
window.initRechargeModule = function({
  authToken, fetchUserData, currentServerId
}) {
  console.log(">>> initRechargeModule started");

  const btnRechargeBalance = document.getElementById("btnRechargeBalance");
  console.log(">>> btnRechargeBalance found:", !!btnRechargeBalance);

  const rechargeStep1 = document.getElementById('rechargeStep1');
  const rechargeStep2 = document.getElementById('rechargeStep2');
  const rechargeAmount = document.getElementById('rechargeAmount');
  const rechargeTracking = document.getElementById('rechargeTracking');
  const rechargeSection = document.getElementById('rechargeSection');
  const closeRechargeModal = document.getElementById('closeRechargeModal');
  const btnRechargeBack = document.getElementById('btnRechargeBack');
  const btnGenerarCuenta = document.getElementById('btnGenerarCuenta');
  const btnVerificarPago = document.getElementById('btnVerificarPago');
  const lblRechargeAmount = document.getElementById('lblRechargeAmount');
  
  const rechargeServerInput = document.getElementById('rechargeServer');
  const rechargeServerCards = document.querySelectorAll('#rechargeServerCards .server-card');
  const rechargeBankSelect = document.getElementById('rechargeBank');

  let currentRechargeData = null;

  async function fetchBanksForServer(serverId) {
    try {
      rechargeBankSelect.innerHTML = '<option value="">Cargando bancos...</option>';
      rechargeBankSelect.disabled = true;
      const res = await fetch(`/api/fund/banks/${serverId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('dhru_token')}` }
      });
      const json = await res.json();
      if (json.success && json.banks && json.banks.length > 0) {
        rechargeBankSelect.innerHTML = '';
        json.banks.forEach(b => {
          const opt = document.createElement('option');
          opt.value = b.code;
          opt.textContent = b.name;
          rechargeBankSelect.appendChild(opt);
        });
        rechargeBankSelect.disabled = false;
      } else {
        rechargeBankSelect.innerHTML = '<option value="">Error al cargar bancos</option>';
      }
    } catch (e) {
      console.error(e);
      rechargeBankSelect.innerHTML = '<option value="">Error de conexión</option>';
    }
  }

  rechargeServerCards.forEach(card => {
    card.addEventListener('click', () => {
      rechargeServerCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const serverId = card.getAttribute('data-id');
      rechargeServerInput.value = serverId;
      fetchBanksForServer(serverId);
    });
  });

  console.log(">>> Attaching click listener to btnRechargeBalance");
  btnRechargeBalance.addEventListener("click", () => {
    console.log(">>> btnRechargeBalance CLICKED");

    rechargeStep1.classList.remove('hidden');
    rechargeStep2.classList.add('hidden');
    rechargeAmount.value = '';
    rechargeTracking.value = '';
    currentRechargeData = null;
    
    rechargeSection.classList.remove('hidden');
    setTimeout(() => rechargeSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    // Hide other tabs
    const productsSection = document.getElementById('productsSection');
    const historySection = document.getElementById('historySection');
    const adminSection = document.getElementById('adminSection');
    const rechargesSection = document.getElementById('rechargesSection');
    const btnBulkSavePrices = document.getElementById('btnBulkSavePrices');
    
    if (productsSection) productsSection.classList.add('hidden');
    if (historySection) historySection.classList.add('hidden');
    if (adminSection) adminSection.classList.add('hidden');
    if (rechargesSection) rechargesSection.classList.add('hidden');
    if (btnBulkSavePrices) btnBulkSavePrices.classList.add('hidden');
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));

    
    // Set default server and fetch banks
    rechargeServerInput.value = '3';
    if (typeof fetchRecharges === 'function') fetchRecharges();
    rechargeServerCards.forEach(c => c.classList.remove('active'));
    document.querySelector('.server-card[data-id="3"]').classList.add('active');
    fetchBanksForServer('3');
  });

  
  closeRechargeModal.addEventListener('click', () => {
    rechargeSection.classList.add('hidden');
    const productsSection = document.getElementById('productsSection');
    if (productsSection) productsSection.classList.remove('hidden');
  });


  
  btnRechargeBack.addEventListener('click', () => {
    rechargeSection.classList.add('hidden');
    const productsSection = document.getElementById('productsSection');
    if (productsSection) productsSection.classList.remove('hidden');
  });


  btnGenerarCuenta.addEventListener('click', async () => {
    const amount = parseFloat(rechargeAmount.value);
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, ingresa un monto válido.');
      return;
    }
    const bankCode = rechargeBankSelect.value;
    const serverId = rechargeServerInput.value;
    
    const btnOriginalText = btnGenerarCuenta.innerHTML;
    btnGenerarCuenta.innerHTML = '<div class="loading-spinner"></div>';
    btnGenerarCuenta.disabled = true;

    try {
      const response = await fetch('/api/fund/route', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('dhru_token')
        },
        body: JSON.stringify({ amount, bankCode, serverId })
      });
      const data = await response.json();
      
      if (response.ok && data.accounts) {
        currentRechargeData = data;
        currentRechargeData.account = data.accounts[0];
        
        lblRechargeAmount.textContent = `$${amount.toFixed(2)}`;
        
        const container = document.getElementById('rechargeAccountsContainer');
        container.innerHTML = '';
        
        data.accounts.forEach((acc, index) => {
          const card = document.createElement('div');
          card.style.cssText = `
            flex: 1 1 calc(50% - 10px);
            min-width: 200px;
            background: rgba(0,0,0,0.3);
            border: 2px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            padding: 15px;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
            transform-origin: center top;
          `;
          
          card.innerHTML = `
            <div class="card-bank-name" style="font-weight: bold; color: #e2e8f0; margin-bottom: 5px; font-size: 1.1rem; transition: all 0.3s;">${acc.bankName}</div>
            <div class="card-owner-name" style="font-size: 1rem; color: #94a3b8; margin-bottom: 3px; transition: all 0.3s;">${acc.ownerName}</div>
            <div class="card-clabe" style="font-family: monospace; font-size: 1.2rem; color: #22d3ee; letter-spacing: 1px; transition: all 0.3s;">${acc.clabe}</div>
            <div class="selection-indicator" style="font-size: 0.85rem; margin-top: 10px; text-align: center; color: #94a3b8; background: rgba(255,255,255,0.05); padding: 5px; border-radius: 4px;">
              Haz clic para seleccionar esta cuenta
            </div>
            
            <div class="selected-actions hidden" style="margin-top: 20px; display: flex; gap: 10px; flex-direction: column;">
              <button type="button" class="btn-copy-name" style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; border-radius: 6px; padding: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 1rem; font-weight: bold; transition: all 0.2s;">
                <i data-lucide="copy" style="width:18px; height:18px;"></i> Copiar Nombre
              </button>
              <button type="button" class="btn-copy-clabe" style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #10b981; border-radius: 6px; padding: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 1rem; font-weight: bold; transition: all 0.2s;">
                <i data-lucide="copy" style="width:18px; height:18px;"></i> Copiar Cuenta / CLABE
              </button>
              <button type="button" class="btn-change-account" style="background: transparent; border: 1px dashed rgba(255,255,255,0.2); color: #cbd5e1; border-radius: 6px; padding: 8px; cursor: pointer; font-size: 0.9rem; margin-top: 5px; transition: all 0.2s;">
                <i data-lucide="refresh-cw" style="width:14px; height:14px; display:inline-block; vertical-align:middle;"></i> Elegir Otra Cuenta
              </button>
            </div>
          `;
          
          const setupCopyBtn = (btn, text, defaultHtml, color) => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(text).then(() => {
                btn.innerHTML = `<i data-lucide="check-circle" style="width:18px; height:18px;"></i> ¡Copiado!`;
                btn.style.background = color;
                btn.style.color = '#fff';
                if (window.lucide) window.lucide.createIcons({ root: btn });
                setTimeout(() => {
                  btn.innerHTML = defaultHtml;
                  btn.style.background = `rgba(${color === '#10b981' ? '16, 185, 129' : '56, 189, 248'}, 0.15)`;
                  btn.style.color = color;
                  if (window.lucide) window.lucide.createIcons({ root: btn });
                }, 2000);
              });
            });
          };

          const btnCopyName = card.querySelector('.btn-copy-name');
          const btnCopyClabe = card.querySelector('.btn-copy-clabe');
          
          setupCopyBtn(btnCopyName, acc.ownerName, '<i data-lucide="copy" style="width:18px; height:18px;"></i> Copiar Nombre', '#38bdf8');
          setupCopyBtn(btnCopyClabe, acc.clabe, '<i data-lucide="copy" style="width:18px; height:18px;"></i> Copiar Cuenta / CLABE', '#10b981');
          
          const btnChange = card.querySelector('.btn-change-account');
          btnChange.addEventListener('click', (e) => {
            e.stopPropagation();
            card.style.flex = '1 1 calc(50% - 10px)';
            card.style.transform = 'scale(1)';
            card.style.background = 'rgba(0,0,0,0.3)';
            card.querySelector('.card-bank-name').style.fontSize = '1.1rem';
            card.querySelector('.card-owner-name').style.fontSize = '1rem';
            card.querySelector('.card-clabe').style.fontSize = '1.2rem';
            
            Array.from(container.children).forEach(c => {
              c.style.display = 'block';
              c.style.borderColor = 'rgba(255,255,255,0.1)';
              c.querySelector('.card-bank-name').style.color = '#e2e8f0';
              c.querySelector('.selection-indicator').style.display = 'block';
              c.querySelector('.selected-actions').classList.add('hidden');
              c.querySelector('.selected-actions').style.display = 'none';
            });
          });
          
          card.addEventListener('click', () => {
            currentRechargeData.account = acc;
            Array.from(container.children).forEach(c => {
              if (c !== card) c.style.display = 'none';
            });
            
            card.style.flex = '1 1 100%'; 
            card.style.transform = 'scale(1.02)';
            card.style.borderColor = '#10b981';
            card.style.background = 'rgba(16, 185, 129, 0.05)';
            
            card.querySelector('.card-bank-name').style.color = '#10b981';
            card.querySelector('.card-bank-name').style.fontSize = '1.3rem';
            card.querySelector('.card-owner-name').style.fontSize = '1.1rem';
            card.querySelector('.card-clabe').style.fontSize = '1.5rem';
            card.querySelector('.selection-indicator').style.display = 'none';
            
            const actions = card.querySelector('.selected-actions');
            actions.classList.remove('hidden');
            actions.style.display = 'flex';
            
            if (window.lucide) window.lucide.createIcons({ root: card });
          });
          
          container.appendChild(card);
        });
        
        if (window.lucide) window.lucide.createIcons({ root: container });
        
        rechargeStep1.classList.add('hidden');
        rechargeStep2.classList.remove('hidden');
      } else {
        alert(data.error || 'Error al obtener cuenta de depósito.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al contactar al servidor.');
    } finally {
      btnGenerarCuenta.innerHTML = btnOriginalText;
      btnGenerarCuenta.disabled = false;
    }
  });

  btnVerificarPago.addEventListener('click', async () => {
    const amount = parseFloat(rechargeAmount.value);
    const trackingNumber = rechargeTracking.value.trim();
    const bankCode = rechargeBankSelect.value;
    const serverId = rechargeServerInput.value;
    
    if (!trackingNumber || trackingNumber.length < 5) {
      alert('Por favor, ingresa una Clave de Rastreo o Folio válido.');
      return;
    }

    if (!currentRechargeData || !currentRechargeData.account) return;

    const btnOriginalText = btnVerificarPago.innerHTML;
    btnVerificarPago.innerHTML = '<div class="loading-spinner" style="margin: 0 auto;"></div> Verificando...';
    btnVerificarPago.disabled = true;

    try {
      const response = await fetch('/api/fund/verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('dhru_token')
        },
        body: JSON.stringify({ 
          amount, 
          bankCode, 
          trackingNumber,
          serverId: serverId,
          accountId: currentRechargeData.account.id,
          providerKey: currentRechargeData.account.providerKey
        })
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        alert(data.message);
        rechargeSection.classList.add('hidden');
        const productsSection = document.getElementById('productsSection');
        if (productsSection) productsSection.classList.remove('hidden');
        if(typeof fetchUserData === 'function') fetchUserData();
      } else {
        alert(data.error || 'Error al verificar la recarga.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de red. Por favor intenta verificar nuevamente en un minuto.');
    } finally {
      btnVerificarPago.innerHTML = btnOriginalText;
      btnVerificarPago.disabled = false;
    }
  });
};
