document.addEventListener('DOMContentLoaded', () => {
  let localCatalogVersion = 1;

  // Initialize Lucide icons
  lucide.createIcons();

  // DOM Elements - Views
  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');

  // DOM Elements - Auth & Header
  const credentialsForm = document.getElementById('credentialsForm');
  const usernameInput = document.getElementById('usernameInput');
  const passwordInput = document.getElementById('passwordInput');
  const btnTogglePass = document.getElementById('btnTogglePass');
  const connectionStatus = document.getElementById('connectionStatus');
  const btnUserProfile = document.getElementById('btnUserProfile');
  const btnLogout = document.getElementById('btnLogout');
  const btnAdminManage = document.getElementById('btnAdminManage');
  const btnAdminCoupons = document.getElementById('btnAdminCoupons');
  const btnRechargeBalance = document.getElementById('btnRechargeBalance');
  const btnWhatsappBot = document.getElementById('btnWhatsappBot');
  const whatsappBotModal = document.getElementById('whatsappBotModal');
  const btnCloseWhatsappBotModal = document.getElementById('btnCloseWhatsappBotModal');
  const creditsBadgeContainer = document.getElementById('creditsBadgeContainer');
  const creditsBalanceText = document.getElementById('creditsBalanceText');
  const filterTypeSelect = document.getElementById('filterTypeSelect');
  const filterGroupSelect = document.getElementById('filterGroupSelect');
  const filterServiceSelect = document.getElementById('filterServiceSelect');
  const btnAdvancedSearch = document.getElementById('btnAdvancedSearch');
  const categoriesGrid = document.getElementById('categoriesGrid');
  const btnBackToCategories = document.getElementById('btnBackToCategories');
  const catalogTitle = document.getElementById('catalogTitle');
  const tabCatalog = document.getElementById('tabCatalog');
  const tabHistory = document.getElementById('tabHistory');
  const tabAdmin = document.getElementById('tabAdmin');
  const productsSection = document.getElementById('productsSection');
  const historySection = document.getElementById('historySection');
  const adminSection = document.getElementById('adminSection');
  
  const productCount = document.getElementById('productCount');
  const feedbackArea = document.getElementById('feedbackArea');
  const productsBody = document.getElementById('productsBody');
  const globalProductSearch = document.getElementById('globalProductSearch');
  // DOM Elements - History Reseller Panel
  const historyCount = document.getElementById('historyCount');
  const historyBody = document.getElementById('historyBody');
  const btnClearHistory = document.getElementById('btnClearHistory');
  const btnSyncHistory = document.getElementById('btnSyncHistory');
  const btnImportOrder = document.getElementById('btnImportOrder');
  const historyLimitFilter = document.getElementById('historyLimitFilter');
  const historySearchInput = document.getElementById('historySearchInput');

  // DOM Elements - Debug Console
  const consoleCount = document.getElementById('consoleCount');
  const consoleEmpty = document.getElementById('consoleEmpty');
  const consoleList = document.getElementById('consoleList');
  const btnClearConsole = document.getElementById('btnClearConsole');
  const btnBulkSavePrices = document.getElementById('btnBulkSavePrices');

  // DOM Elements - Modal
  const purchaseModal = document.getElementById('purchaseModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnCancelOrder = document.getElementById('btnCancelOrder');
  const orderForm = document.getElementById('orderForm');
  const imeiInput = document.getElementById('imeiInput');

  // Recharge Modal Elements
  const modalRecharge = document.getElementById('modalRecharge');
  const closeRechargeModal = document.getElementById('closeRechargeModal');
  const btnRechargeBack = document.getElementById('btnRechargeBack');
  const btnGenerarCuenta = document.getElementById('btnGenerarCuenta');
  const btnVerificarPago = document.getElementById('btnVerificarPago');
  const rechargeStep1 = document.getElementById('rechargeStep1');
  const rechargeStep2 = document.getElementById('rechargeStep2');
  const rechargeAmount = document.getElementById('rechargeAmount');
  const rechargeBank = document.getElementById('rechargeBank');
  const lblRechargeAmount = document.getElementById('lblRechargeAmount');
  const lblRechargeDestBank = document.getElementById('lblRechargeDestBank');
  const lblRechargeDestName = document.getElementById('lblRechargeDestName');
  const lblRechargeDestClabe = document.getElementById('lblRechargeDestClabe');
  const rechargeTracking = document.getElementById('rechargeTracking');
  let currentRechargeData = null;

  // State Variables
  let apiaccesskey = '';
  let currentCategory = null; 
  let g_rawServicesList = [];
  let g_categorizedGroups = {}; 
  let g_currentHistory = [];

  // Add click handlers for Server Tabs
  document.querySelectorAll('.server-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.server-tab').forEach(t => t.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const newServerId = e.currentTarget.dataset.server;
      
      if (newServerId !== currentServerId) {
        currentServerId = newServerId;
        g_currentHistory = [];
        historyCount.textContent = '0';
        historyBody.innerHTML = '';
        consoleList.innerHTML = '';
        consoleCount.textContent = '0';
        consoleEmpty.classList.remove('hidden');
        
        // Hide advanced filter dropdown instantly when switching servers
        if (filterServiceSelect) {
           filterServiceSelect.innerHTML = '<option value="">Selecciona un grupo primero...</option>';
           filterServiceSelect.value = '';
        }
        
        tabCatalog.click(); // Always go back to catalog when switching servers
        syncProducts(false);
      }
    });
  });

  

  

  const btnResetSearch = document.getElementById('btnResetSearch');
  if (btnResetSearch) {
    btnResetSearch.addEventListener('click', () => {
      if (filterTypeSelect) filterTypeSelect.value = '';
      if (filterGroupSelect) filterGroupSelect.value = '';
      if (filterServiceSelect) {
         filterServiceSelect.innerHTML = '<option value="">Selecciona una opción</option>';
         filterServiceSelect.value = '';
      }
      showCategoriesView();
    });
  }

  // Setup Tabs
  const modalServiceId = document.getElementById('modalServiceId');
  const modalServiceName = document.getElementById('modalServiceName');
  const modalServiceGroup = document.getElementById('modalServiceGroup');
  const modalServicePrice = document.getElementById('modalServicePrice');
  const customFieldsContainer = document.getElementById('customFieldsContainer');
  const imeiInputGroup = document.getElementById('imeiInputGroup');
  const imeiAutoGenerate = document.getElementById('imeiAutoGenerate');
  const imeiInputWrapper = document.getElementById('imeiInputWrapper');
  const imeiHint = document.getElementById('imeiHint');
  const imeiLabel = document.getElementById('imeiLabel');
  
  const quantityInputGroup = document.getElementById('quantityInputGroup');
  const quantityInput = document.getElementById('quantityInput');
  const quantityHint = document.getElementById('quantityHint');
  
  const modalBalanceWarning = document.getElementById('modalBalanceWarning');
  const modalServiceInfoBlock = document.getElementById('modalServiceInfoBlock');
  const modalServiceTime = document.getElementById('modalServiceTime');
  const modalServiceInfoText = document.getElementById('modalServiceInfoText');
  const btnConfirmOrder = document.getElementById('btnConfirmOrder');

  // DOM Elements - Ticket Generator
  const ticketModal = document.getElementById('ticketModal');
  const btnTicketClose = document.getElementById('btnTicketClose');
  const btnCancelTicket = document.getElementById('btnCancelTicket');
  const btnGenerateTicketFinal = document.getElementById('btnGenerateTicketFinal');
  const ticketClientPrice = document.getElementById('ticketClientPrice');
  
  const ticketTemplateContainer = document.getElementById('ticketTemplateContainer');
  const ticketTemplate = document.getElementById('ticketTemplate');
  const ticketTitle = document.getElementById('ticketTitle');
  const ticketUserVal = document.getElementById('ticketUserVal');
  const ticketPassVal = document.getElementById('ticketPassVal');
  const ticketPricePill = document.getElementById('ticketPricePill');
  const ticketPriceVal = document.getElementById('ticketPriceVal');
  
  // New ticket template elements
  const ticketFormatType = document.getElementById('ticketFormatType');
  const ticketParsedBox = document.getElementById('ticketParsedBox');
  const ticketRawBox = document.getElementById('ticketRawBox');
  const ticketRawTextVal = document.getElementById('ticketRawTextVal');

  let currentTicketData = null;

  // Application State
  let productsList = [];
  let uniqueGroups = new Set();
  const frontendCatalogCache = {}; // Cache products per server
  let globalApiCurrency = 'MXN'; // Hardcoded to MXN since backend converts all prices
  let globalApiCreditRaw = 0; // Store the raw user credit balance for comparison

  let selectedProductForOrder = null;
  let orderHistory = [];
  let consoleLogList = [];

  let authToken = null;
  let authRole = null;
  let authUsername = null;
  let authUserId = null;
  let currentServerId = localStorage.getItem('currentServerId') || '1';

  function updateSliderUI() {
    const allBtns = document.querySelectorAll('.btn-server-switch');
    const indicator = document.getElementById('serverSwitchIndicator');
    
    let visibleBtns = 0;
    allBtns.forEach(b => { if (b.style.display !== 'none') visibleBtns++; });
    
    if (indicator && visibleBtns > 0) {
      indicator.style.width = `calc(${100 / visibleBtns}% - 6px)`;
    }

    let visibleIndex = 0;
    allBtns.forEach((btn) => {
      if (btn.style.display !== 'none') {
        const isMatch = btn.dataset.server === currentServerId;
        btn.classList.toggle('active', isMatch);
        btn.style.color = isMatch ? 'white' : 'rgba(255,255,255,0.6)';
        if (isMatch) {
          indicator.style.transform = `translateX(${visibleIndex * 100}%)`;
        }
        visibleIndex++;
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // Setup slider event listeners immediately
  const switchContainer = document.getElementById('serverSwitchContainer');
  if (switchContainer) {
    updateSliderUI();
    
    document.querySelectorAll('.btn-server-switch').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.server;
                if (currentServerId !== id) {
          currentServerId = id;
          localStorage.setItem('currentServerId', id);
          updateSliderUI();
          
          // IMMEDIATE UI WIPE TO PREVENT GHOST DATA IF API FAILS
          productsList = [];
          uniqueGroups.clear();
          if (typeof renderProducts === 'function') renderProducts([]);
          if (filterTypeSelect && tsInstances[filterTypeSelect.id]) { tsInstances[filterTypeSelect.id].clear(true); window.lastSelectedType = 'all'; }
          if (typeof populateGroupsFilter === 'function') populateGroupsFilter('all');
          if (typeof populateServicesFilter === 'function') populateServicesFilter('all', 'all');
          if (filterGroupSelect && tsInstances[filterGroupSelect.id]) { tsInstances[filterGroupSelect.id].clear(true); window.lastSelectedGroup = 'all'; }
          if (filterServiceSelect && tsInstances[filterServiceSelect.id]) { tsInstances[filterServiceSelect.id].clear(true); window.lastSelectedServiceId = ''; }
          
          if (authToken) {
            updateAccountCredits();
            syncProducts(false); // DO NOT force sync when switching tabs
            if (!document.getElementById('historySection').classList.contains('hidden')) {
              fetchOrderHistory();
            }
            if (adminSection && !adminSection.classList.contains('hidden')) {
              loadAdminData();
            }
          }
        }
      });
    });
  }


  // Load Persisted Session
  function checkPersistedSession() {
    authToken = localStorage.getItem('dhru_token');
    authRole = localStorage.getItem('dhru_role');
    authUsername = localStorage.getItem('dhru_username');
    authUserId = localStorage.getItem('dhru_uid');
    // We no longer load history from local storage. It is fetched from the backend on login.

    if (authToken) {
      btnAdminManage.classList.add('hidden');
      btnRechargeBalance.classList.add('hidden');
      btnWhatsappBot.classList.add('hidden');
      btnUserProfile.classList.add('hidden');
      if (btnRechargesHistory) btnRechargesHistory.classList.add('hidden');
      btnLogout.classList.add('hidden');
      
      loginView.classList.add('hidden');
      dashboardView.classList.remove('hidden');
      btnLogout.classList.remove('hidden');
      if (authRole === 'admin') {
        btnAdminManage.classList.remove('hidden');
        if (typeof btnAdminCoupons !== 'undefined' && btnAdminCoupons) btnAdminCoupons.classList.remove('hidden');
        if (btnImportOrder) btnImportOrder.classList.remove('hidden');
        if (btnBulkSavePrices) btnBulkSavePrices.classList.remove('hidden');
        // Inject admin headers to history table
        const historyHead = document.querySelector('#historySection thead tr');
        if (historyHead && !historyHead.dataset.adminInjected) {
          historyHead.dataset.adminInjected = 'true';
          const thUser = document.createElement('th');
          thUser.textContent = 'Usuario';
          const thProfit = document.createElement('th');
          thProfit.textContent = 'Ganancia';
          historyHead.insertBefore(thUser, historyHead.children[2]);
          historyHead.appendChild(thProfit);
        }
      } else {
        btnUserProfile.classList.remove('hidden');
        if (btnRechargesHistory) btnRechargesHistory.classList.remove('hidden');
      }
      
      btnRechargeBalance.classList.remove('hidden'); // Shown for EVERYONE now
      btnWhatsappBot.classList.remove('hidden');
      
      syncProducts(true);
      updateAccountCredits();
      fetchOrderHistory();
      
      document.getElementById('creditsBadgeContainer').classList.remove('hidden');
      const ssc = document.getElementById('serverSwitchContainer');
      if (ssc) ssc.classList.remove('hidden');
    }
  }
  checkPersistedSession();

  async function fetchOrderHistory() {
    if (!authToken) return;
    try {
      const res = await fetch('/api/history', {
        headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        orderHistory = await res.json();
        renderOrderHistory();
        autoSyncHistory(true); // Auto-sync in background without alerts
      }
    } catch (e) {
      console.warn('Failed to fetch history', e);
    }
  }

  // Toggle Password visibility
  btnTogglePass.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    btnTogglePass.innerHTML = `<i data-lucide="${isPassword ? 'eye-off' : 'eye'}"></i>`;
    lucide.createIcons();
  });

  // Handle Login Form Submission
  credentialsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      alert('Por favor completa todos los campos.');
      return;
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (res.ok) {
        authToken = data.token;
        authRole = data.role;
        authUsername = data.username;
        authUserId = data.uid;
        localStorage.setItem('dhru_token', authToken);
        localStorage.setItem('dhru_role', authRole);
        localStorage.setItem('dhru_username', authUsername);
        localStorage.setItem('dhru_uid', authUserId);
        
        currentServerId = '1';
        localStorage.setItem('currentServerId', '1');
        updateSliderUI();

        loginView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        btnLogout.classList.remove('hidden');
        
        const ssc = document.getElementById('serverSwitchContainer');
        if (ssc) ssc.classList.remove('hidden');

        if (authRole === 'admin') {
          btnAdminManage.classList.remove('hidden');
          if (typeof btnAdminCoupons !== 'undefined' && btnAdminCoupons) btnAdminCoupons.classList.remove('hidden');
          btnBulkSavePrices.classList.remove('hidden');
          if (btnImportOrder) btnImportOrder.classList.remove('hidden');
        } else {
          btnUserProfile.classList.remove('hidden');
          if (btnRechargesHistory) btnRechargesHistory.classList.remove('hidden');
        }

        btnRechargeBalance.classList.remove('hidden'); // Shown for EVERYONE now
        btnWhatsappBot.classList.remove('hidden');

        syncProducts(true);
        updateAccountCredits();
        fetchOrderHistory();
      } else {
        alert(data.error || 'Error al iniciar sesión');
      }
    } catch (err) {
      alert('Error de red al iniciar sesión');
    }
  });

  // Setup back button
  btnBackToCategories.addEventListener('click', () => {
    if (filterTypeSelect) filterTypeSelect.value = 'all';
    if (filterGroupSelect) {
       filterGroupSelect.innerHTML = '<option value="all">Todos los grupos</option>';
       filterGroupSelect.value = 'all';
    }
    if (filterServiceSelect) {
       filterServiceSelect.innerHTML = '<option value="">Selecciona una opción</option>';
       filterServiceSelect.value = '';
    }
    renderProducts(productsList);
  });

  // Setup Tabs
  tabCatalog.addEventListener('click', () => {
    tabCatalog.classList.add('active');
    tabHistory.classList.remove('active');
    if (tabAdmin) tabAdmin.classList.remove('active');
    productsSection.classList.remove('hidden');
    historySection.classList.add('hidden');
    if (adminSection) adminSection.classList.add('hidden');
    if (typeof rechargesSection !== 'undefined' && rechargesSection) rechargesSection.classList.add('hidden');
    if (!categoriesGrid.classList.contains('hidden')) {
      renderProducts(productsList);
    }
  });

  tabHistory.addEventListener('click', () => {
    tabHistory.classList.add('active');
    tabCatalog.classList.remove('active');
    if (tabAdmin) tabAdmin.classList.remove('active');
    historySection.classList.remove('hidden');
    productsSection.classList.add('hidden');
    if (adminSection) adminSection.classList.add('hidden');
    if (typeof rechargesSection !== 'undefined' && rechargesSection) rechargesSection.classList.add('hidden');
    fetchOrderHistory(); // Refresh history every time the tab is opened
  });
  
  if (tabAdmin) {
    tabAdmin.addEventListener('click', async () => {
      tabAdmin.classList.add('active');
      tabCatalog.classList.remove('active');
      tabHistory.classList.remove('active');
      adminSection.classList.remove('hidden');
      productsSection.classList.add('hidden');
      historySection.classList.add('hidden');
      if (typeof rechargesSection !== 'undefined' && rechargesSection) rechargesSection.classList.add('hidden');
      
      await loadAdminData();
      await fetchMasterHistory();
    });
  }

  // Setup IMEI Toggle
  imeiAutoGenerate.addEventListener('change', () => {
    if (imeiAutoGenerate.checked) {
      imeiInputWrapper.classList.add('hidden');
      imeiHint.classList.add('hidden');
      imeiInput.required = false;
      imeiLabel.style.opacity = '0.5';
    } else {
      imeiInputWrapper.classList.remove('hidden');
      imeiHint.classList.remove('hidden');
      imeiInput.required = true;
      imeiLabel.style.opacity = '1';
    }
  });

  // Logout Logic
  btnLogout.addEventListener('click', () => {
    localStorage.removeItem('dhru_token');
    localStorage.removeItem('dhru_role');
    localStorage.removeItem('dhru_username');
    localStorage.removeItem('dhru_uid');
    localStorage.removeItem('currentServerId');
    location.reload();
  });

  // User Profile Logic
  const userProfileModal = document.getElementById('userProfileModal');
  const btnCloseProfileModal = document.getElementById('btnCloseProfileModal');
  const profileUsername = document.getElementById('profileUsername');
  const profileRole = document.getElementById('profileRole');
  const inputNewPassword = document.getElementById('inputNewPassword');
  const btnSaveNewPassword = document.getElementById('btnSaveNewPassword');

  if (btnUserProfile) {
    btnUserProfile.addEventListener('click', () => {
      profileUsername.textContent = authUsername;
      profileRole.textContent = authRole.toUpperCase();
      inputNewPassword.value = '';
      userProfileModal.classList.remove('hidden');
    });
  }

  if (btnCloseProfileModal) {
    btnCloseProfileModal.addEventListener('click', () => {
      userProfileModal.classList.add('hidden');
    });
  }

  if (btnSaveNewPassword) {
    btnSaveNewPassword.addEventListener('click', async () => {
      const pwd = inputNewPassword.value;
      if (!pwd || pwd.length < 4) return alert('La contraseña debe tener al menos 4 caracteres.');
      
      try {
        const res = await fetch(`/api/users/${authUserId}/password`, {
          method: 'PUT',
          headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
          body: JSON.stringify({ password: pwd })
        });
        if (res.ok) {
          alert('¡Contraseña actualizada con éxito!');
          inputNewPassword.value = '';
          userProfileModal.classList.add('hidden');
        } else {
          const err = await res.json();
          alert('Error: ' + err.error);
        }
      } catch (err) {
        alert('Error de conexión.');
      }
    });
  }

  // Clear History
  btnClearHistory.addEventListener('click', async () => {
    if (confirm('¿Estás seguro de que deseas limpiar el historial de pedidos del servidor actual?')) {
      try {
        const res = await fetch('/api/history', {
          method: 'DELETE',
          headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
          orderHistory = [];
          renderOrderHistory();
          alert('Historial limpiado exitosamente.');
        } else {
          alert('Error al limpiar el historial en el servidor.');
        }
      } catch (err) {
        alert('Error de conexión al limpiar el historial.');
      }
    }
  });

  // Clear Console
  btnClearConsole.addEventListener('click', () => {
    consoleLogList = [];
    renderConsoleLogs();
  });

  // Synchronize Order History Statuses
  btnSyncHistory.addEventListener('click', async () => {
    await autoSyncHistory(false);
  });

  if (btnImportOrder) {
    btnImportOrder.addEventListener('click', async () => {
      if (authRole !== 'admin') return;
      
      const orderId = prompt('Ingresa el ID del pedido del servidor que deseas importar al panel (Ej: 228):');
      if (!orderId) return;

      const manualServiceId = prompt('Ingresa el ID del Producto/Servicio asociado a este pedido (Ej: 34):');
      if (!manualServiceId) return;

      // Auto-detect service name and type from local catalog
      const product = productsList.find(p => String(p.serviceid) === String(manualServiceId));
      let type = 'SERVER';
      let defaultName = 'Importado Manualmente';
      let defaultCost = 0;

      if (product) {
         type = product.serviceType === 'SERVER' ? 'SERVER' : 'IMEI';
         defaultName = product.service;
         defaultCost = (product.rawItem && product.rawItem._REAL_COST) ? product.rawItem._REAL_COST : (product.credit || 0);
      } else {
         let promptType = prompt('Servicio no encontrado en el catálogo local. ¿El pedido es de tipo IMEI o SERVER? (Escribe IMEI o SERVER):', 'SERVER');
         if (!promptType) return;
         type = promptType.toUpperCase().trim();
         if (type !== 'IMEI' && type !== 'SERVER') type = 'IMEI';
      }

      const btnSpan = btnImportOrder.querySelector('span');
      const originalText = btnSpan.textContent;
      btnSpan.textContent = 'Buscando...';
      btnImportOrder.setAttribute('disabled', 'true');

      try {
        const res = await fetch('/api/orders/bulk-status', {
          method: 'POST',
          headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
          body: JSON.stringify({ items: [{ id: orderId, type: type }] })
        });
        
        const data = await res.json();
        
        if (res.ok && data.SUCCESS && data.SUCCESS.length > 0) {
          const apiOrder = data.SUCCESS[0].raw || data.SUCCESS[0].DATA || data.SUCCESS[0].data || data.SUCCESS[0];
          
          if (!apiOrder) {
             alert('El servidor no devolvió datos válidos para esta orden.');
             return;
          }

          const statusVal = String(apiOrder.STATUS || apiOrder.status || '');
          let statusStr = 'pending';
          if (statusVal === '4' || statusVal.toLowerCase() === 'completed' || statusVal.toLowerCase() === 'success') statusStr = 'success';
          else if (statusVal === '3' || statusVal.toLowerCase() === 'failed' || statusVal.toLowerCase() === 'rejected' || statusVal.toLowerCase() === 'canceled') statusStr = 'failed';

          let serviceId = apiOrder.SERVICEID || apiOrder.serviceid || apiOrder.serviceId || manualServiceId;
          let serviceName = apiOrder.SERVICENAME || apiOrder.servicename || apiOrder.serviceName || '';
          let imei = apiOrder.IMEI || apiOrder.imei || apiOrder.REFERENCEID || apiOrder.QTY || '';

          if (!serviceName) {
            serviceName = defaultName;
          }

          if (!imei) {
            const manualImei = prompt(`La API no devolvió los Detalles/IMEI para "${serviceName}". Por favor, ingresa el detalle de la orden (Ej: correo del cliente o IMEI):`, 'N/A');
            imei = manualImei || 'N/A';
          }

          const importPayload = {
            orderId: orderId,
            serviceId: serviceId,
            serviceName: serviceName,
            imei: imei,
            status: statusStr,
            statusText: apiOrder.REPLY || apiOrder.REJECT_REASON || apiOrder.CODE || apiOrder.MESSAGE || apiOrder.statusText || 'Importado',
            serverId: currentServerId,
            serviceType: type,
            cost: defaultCost
          };

          const addRes = await fetch('/api/history/add', {
            method: 'POST',
            headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify(importPayload)
          });
          const addData = await addRes.json();
          
          if (addRes.ok) {
            alert('¡Pedido importado con éxito!');
            fetchOrderHistory(); 
          } else {
            alert('Error al importar: ' + (addData.error || 'Desconocido'));
          }
        } else {
          alert('No se encontró el pedido o hubo un error al consultarlo.');
        }
      } catch (err) {
        alert('Error de conexión al intentar importar.');
      } finally {
        btnSpan.textContent = originalText;
        btnImportOrder.removeAttribute('disabled');
      }
    });
  }

  async function autoSyncHistory(silent = false) {
    if (!authToken) {
      if (!silent) alert('Faltan credenciales en la sesión.');
      return;
    }

    // Let's sync ALL orders that have a valid order ID and whose statusText contains a placeholder message
    const pendingOrders = orderHistory.filter(o => {
      if (!o.orderId || o.orderId === 'Error') return false;
      const isPending = o.status === 'pending';
      const txt = String(o.statusText || '').toLowerCase();
      const isGenericText = !txt || txt.includes('received') || txt.includes('espera') || txt === 'exitoso' || txt === 'rechazado' || txt === 'completado';
      return isPending || isGenericText;
    });

    if (pendingOrders.length === 0) {
      if (!silent) alert('No hay pedidos pendientes por sincronizar en el historial.');
      return;
    }

    if (!silent) {
      btnSyncHistory.setAttribute('disabled', 'true');
      btnSyncHistory.querySelector('span').textContent = 'Sincronizando...';
      const icon = btnSyncHistory.querySelector('svg');
      if (icon) icon.classList.add('icon-spin');
    }

    let updatedCount = 0;
    const updatedOrders = [];

    const itemsToSync = pendingOrders.map(o => {
      let t = o.serviceType;
      if (!t) {
        const matchingProduct = productsList.find(p => String(p.serviceid) === String(o.serviceId));
        if (matchingProduct && matchingProduct.serviceType === 'SERVER') {
          t = 'SERVER';
        } else {
          t = 'IMEI';
        }
      }
      return { id: o.orderId, type: t };
    });
    
    try {
      const payload = { items: itemsToSync };
      
      const res = await fetch('/api/orders/bulk-status', {
        method: 'POST',
        headers: { 'X-Server-Id': currentServerId, 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      logApiCall(`getorderbulk [Count: ${itemsToSync.length}]`, payload, data, res.ok);
      
      if (res.status === 401) {
        if (!silent) alert('Sesión caducada (401). Por favor, vuelve a iniciar sesión.');
        logout();
        return;
      }
      
      if (res.ok && data.SUCCESS && Array.isArray(data.SUCCESS)) {
        for (const apiOrderWrapper of data.SUCCESS) {
          let apiOrder = apiOrderWrapper.DATA || apiOrderWrapper.data || apiOrderWrapper;
          
          const orderIdToCheck = String(apiOrder.orderid || apiOrder.requested_id || apiOrder.ID || apiOrder.id || apiOrder.REFERENCEID || apiOrder.referenceid || '');
          const localOrder = orderHistory.find(o => String(o.orderId) === orderIdToCheck);
          
          if (localOrder) {
            const orderStatus = String(apiOrder.STATUS || apiOrder.status || '').toLowerCase();
            const replyCode = apiOrder.statusText || apiOrder.CODE || apiOrder.code || apiOrder.REPLY || apiOrder.reply || '';
            
            const isRejected = orderStatus === '3' || 
                               orderStatus === 'failed' || 
                               orderStatus === 'rejected' ||
                               orderStatus === 'error' ||
                               orderStatus === 'cancel' ||
                               orderStatus === 'canceled' ||
                               orderStatus === 'cancelled';

            const isCompleted = orderStatus === '4' || 
                                orderStatus === 'completed' || 
                                orderStatus === 'success';
                                
            let hasChanged = false;

            if (isRejected && localOrder.status !== 'failed') {
              localOrder.status = 'failed';
              localOrder.statusText = replyCode || apiOrder.MESSAGE || apiOrder.message || 'Rechazado';
              localOrder.updateTimestamp = new Date().toLocaleString('es-MX');
              hasChanged = true;
            } else if (isCompleted && localOrder.status !== 'success') {
              localOrder.status = 'success';
              localOrder.statusText = replyCode || apiOrder.MESSAGE || apiOrder.message || 'Completado';
              localOrder.updateTimestamp = new Date().toLocaleString('es-MX');
              hasChanged = true;
            } else if ((replyCode || apiOrder.MESSAGE || apiOrder.message) && localOrder.statusText !== (replyCode || apiOrder.MESSAGE || apiOrder.message)) {
              localOrder.statusText = replyCode || apiOrder.MESSAGE || apiOrder.message;
              localOrder.updateTimestamp = new Date().toLocaleString('es-MX');
              hasChanged = true;
            }

            if (hasChanged) {
              updatedCount++;
              updatedOrders.push(localOrder);
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error in bulk sync:`, err);
    }

    // Persist updated history back to backend if anything changed
    if (updatedOrders.length > 0) {
      try {
        await fetch('/api/history', {
          method: 'PUT',
          headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
          body: JSON.stringify({ updatedOrders })
        });
      } catch (e) {
        console.warn('Failed to save updated history to backend', e);
      }
    }

    renderOrderHistory();

    if (!silent) {
      btnSyncHistory.removeAttribute('disabled');
      btnSyncHistory.querySelector('span').textContent = 'Sincronizar Pedidos';
      const icon = btnSyncHistory.querySelector('svg');
      if (icon) icon.classList.remove('icon-spin');
      if (updatedCount > 0) {
        alert(`Sincronización completada. Se actualizaron ${updatedCount} pedidos.`);
      } else {
        alert(`Sincronización completada. No hubo cambios en los estados de los pedidos.`);
      }
    }
  }

  // Update Account Credits
  async function updateAccountCredits() {
    if (!authToken) return;
    try {
      const res = await fetch('/api/account', {
        method: 'GET',
        headers: { 'X-Server-Id': currentServerId, 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.SUCCESS && data.SUCCESS.length > 0) {
          const info = data.SUCCESS[0];
          const rawCredits = parseFloat(info.CREDIT || '0');
          globalApiCreditRaw = rawCredits;
          
          creditsBadgeContainer.classList.remove('hidden');
          
          if (info.IS_ADMIN) {
            const assigned = parseFloat(info.ASSIGNED || '0').toFixed(2);
            const available = parseFloat(info.AVAILABLE || '0').toFixed(2);
            creditsBalanceText.innerHTML = `
              <div style="display: flex; gap: 12px; font-size: 0.8rem; text-align: left; align-items: center;">
                <div style="display: flex; flex-direction: column;">
                  <span style="color: #10b981; font-weight: 700; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px;">Real</span>
                  <span style="color: white;">$${rawCredits.toFixed(2)} <span style="font-size:0.7rem;color:rgba(255,255,255,0.5)">MXN</span></span>
                </div>
                <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.15);"></div>
                <div style="display: flex; flex-direction: column;">
                  <span style="color: #c4b5fd; font-weight: 700; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px;">Cedido</span>
                  <span style="color: white;">$${assigned} <span style="font-size:0.7rem;color:rgba(255,255,255,0.5)">MXN</span></span>
                </div>
                <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.15);"></div>
                <div style="display: flex; flex-direction: column;">
                  <span style="color: #22d3ee; font-weight: 700; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px;">Disp</span>
                  <span style="color: white;">$${available} <span style="font-size:0.7rem;color:rgba(255,255,255,0.5)">MXN</span></span>
                </div>
              </div>
            `;
          } else {
            creditsBalanceText.textContent = `Créditos: $${rawCredits.toFixed(2)} MXN`;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch account credits balance', e);
    }
  }

  // Sychronize Products implementation
  async function syncProducts(shouldPersist = false) {
    if (!authToken) return;

    // Capture the server ID we are syncing for!
    const targetServerId = currentServerId;

    setLoadingState(true);
    updateStatus('loading', 'Sincronizando...');

    try {
      let data;
      
      // Use frontend cache if we aren't forcing a sync
      const cachedEntry = frontendCatalogCache[targetServerId];
      const isCacheValid = cachedEntry && (Date.now() - cachedEntry.timestamp < 15 * 60 * 1000);
      
      if (!shouldPersist && isCacheValid) {
        data = cachedEntry.data;
      } else {
        const url = shouldPersist ? '/api/products?forceSync=true' : '/api/products';
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'X-Server-Id': targetServerId,
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          }
        });

        data = await response.json();

        if (!response.ok) {
          if (response.status === 401) {
            alert('Tu sesión ha expirado o el servidor se reinició. Por favor, inicia sesión de nuevo.');
            btnLogout.click();
            return;
          }
          logApiCall('imeiservicelist', {}, data, false);
          const detailedError = data.details ? (typeof data.details === 'object' ? JSON.stringify(data.details) : data.details) : '';
          throw new Error((data.error || 'Error al comunicarse con la API.') + (detailedError ? ` Detalles: ${detailedError}` : ''));
        }
        
        // Cache it for future tab switches with timestamp
        if (!data.ERROR || data.ERROR.length === 0) {
           frontendCatalogCache[targetServerId] = { data: data, timestamp: Date.now() };
        }
      }

      if (data.ERROR && data.ERROR.length > 0) {
        logApiCall('imeiservicelist', {}, data, false);
        const errMsg = typeof data.ERROR[0] === 'object' ? (data.ERROR[0].MESSAGE || JSON.stringify(data.ERROR[0])) : data.ERROR[0];
        throw new Error(`Dhru API Error: ${errMsg}`);
      }

      // If the user switched tabs while we were fetching, DO NOT UPDATE THE UI!
      if (targetServerId !== currentServerId) {
         console.log('Tab switched during fetch. Aborting UI update for', targetServerId);
         return;
      }

      if (!data.SUCCESS) {
        logApiCall('imeiservicelist', {}, data, false);
        throw new Error('La respuesta de la API no contiene el formato esperado.');
      }

      logApiCall('imeiservicelist', {}, data, true);

      // Preserve UI state
      const wasViewingProducts = !productsBody.classList.contains('hidden');
      const prevTitle = catalogTitle.textContent;
      const q = globalProductSearch ? globalProductSearch.value.toLowerCase().trim() : '';

      const prevType = filterTypeSelect ? filterTypeSelect.value : 'all';
      const prevGroup = filterGroupSelect ? filterGroupSelect.value : 'all';
      const prevService = filterServiceSelect ? filterServiceSelect.value : '';

      productsList = [];
      uniqueGroups.clear();

      if (Array.isArray(data.SUCCESS) && data.SUCCESS.length > 0 && data.SUCCESS[0].LIST) {
        const listObj = data.SUCCESS[0].LIST;
        for (const groupKey in listObj) {
          const group = listObj[groupKey];
          const groupName = group.GROUPNAME || groupKey;
          const groupType = group.GROUPTYPE || 'General';
          if (group.SERVICES && typeof group.SERVICES === 'object') {
            for (const serviceId in group.SERVICES) {
              const item = group.SERVICES[serviceId];
              productsList.push({
                serviceid: item.SERVICEID || serviceId,
                service: item.SERVICENAME || item.SERVICE || 'Sin nombre',
                group: groupName,
                type: groupType || item.SERVICETYPE || item.TYPE || 'General',
                serviceType: item._SERVICE_TYPE || 'IMEI', // IMPORTANT: Store the backend type (IMEI or SERVER)
                credit: item.CREDIT || '0.00',
                time: item.TIME || 'N/A',
                rawItem: item
              });
            }
          }
        }
      } else if (Array.isArray(data.SUCCESS)) {
        productsList = data.SUCCESS.map(item => ({
          serviceid: item.SERVICEID || item.serviceid || 'N/A',
          service: item.SERVICENAME || item.SERVICE || item.service || 'Sin nombre',
          group: item.GROUP || item.group || 'General',
          type: item.GROUPTYPE || item.SERVICETYPE || item.TYPE || item.type || 'General',
          credit: item.CREDIT || item.credit || '0.00',
          time: item.TIME || item.time || 'N/A',
          rawItem: item
        }));
      } else if (typeof data.SUCCESS === 'object' && data.SUCCESS !== null) {
        for (const groupName in data.SUCCESS) {
          if (Array.isArray(data.SUCCESS[groupName])) {
            data.SUCCESS[groupName].forEach(item => {
              productsList.push({
                serviceid: item.SERVICEID || item.serviceid || 'N/A',
                service: item.SERVICENAME || item.SERVICE || item.service || 'Sin nombre',
                group: groupName || 'General',
                type: item.GROUPTYPE || item.SERVICETYPE || item.TYPE || item.type || 'General',
                credit: item.CREDIT || item.credit || '0.00',
                time: item.TIME || item.time || 'N/A',
                rawItem: item
              });
            });
          }
        }
      }


      productsList.forEach(p => {
        if (p.group) uniqueGroups.add(p.group);
      });

      initAdvancedFilters();

      // Restore Advanced Filter Dropdowns
      if (filterTypeSelect && tsInstances[filterTypeSelect.id]) {
        // If we switch servers, previous type might not exist, but let's clear it gracefully
        tsInstances[filterTypeSelect.id].clear(true); window.lastSelectedType = 'all';
        populateGroupsFilter('all');
      }
      if (filterGroupSelect && tsInstances[filterGroupSelect.id]) {
        tsInstances[filterGroupSelect.id].clear(true); window.lastSelectedGroup = 'all';
        populateServicesFilter('all', 'all');
      }
      if (filterServiceSelect && tsInstances[filterServiceSelect.id]) {
        tsInstances[filterServiceSelect.id].clear(true); window.lastSelectedServiceId = '';
      }

      renderProducts(productsList);

      // Restore view if user was inside a category or search
      if (wasViewingProducts) {
        if (q) {
          globalProductSearch.dispatchEvent(new Event('input'));
        } else if (prevTitle === 'Resultados de Búsqueda') {
          btnAdvancedSearch.click();
        } else {
          const groupItems = productsList.filter(p => {
            let gName = p.group || 'Otros Servicios';
            const gnLower = gName.toLowerCase();
            if (gnLower.includes('att') || gnLower.includes('at&t') || gnLower.includes('at&amp;t')) {
              gName = 'Desbloqueos AT&T (USA / MX)';
            }
            return gName === prevTitle;
          });
          if (groupItems.length > 0) {
            showCategoryProducts(prevTitle, groupItems);
          }
        }
      }

      renderOrderHistory();
      
      updateStatus('online', 'Conectado');
      setLoadingState(false);

    } catch (err) {
      console.error(err);
      showError(err.message);
      updateStatus('offline', 'Error de conexión');
      setLoadingState(false);
    }
  }

  // Advanced Filters Logic
  function initAdvancedFilters() {
    if (!filterTypeSelect || !filterGroupSelect || !filterServiceSelect) return;

    // 1. Get unique types
    const types = [...new Set(productsList.map(p => p.type))].filter(Boolean).sort();
    
    // 2. Populate Type Select
    filterTypeSelect.innerHTML = '<option value="all">Todos los tipos</option>';
    types.forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      // Beautiful labels based on type
      let label = type;
      const typeLower = type.toLowerCase();
      if (typeLower.includes('imei')) label = '📱 SERVICIOS IMEI';
      else if (typeLower.includes('server')) label = '🖥️ SERVICIO REMOTO';
      else if (typeLower.includes('file')) label = '📄 SERVICIO DE ARCHIVOS';
      else if (typeLower.includes('activation') || typeLower.includes('credit')) label = '⚡ CRÉDITOS | ACTIVACIONES';
      
      option.textContent = label;
      filterTypeSelect.appendChild(option);
    });

    // 3. Initial populations
    populateGroupsFilter('all');
    populateServicesFilter('all', 'all');

    // 4. Cascade Events
    if (!filterTypeSelect.dataset.listenerBound) {
      filterTypeSelect.addEventListener('change', (e) => { window.lastSelectedType = e.target.value; console.log('TYPE CHANGED TO:', e.target.value);
        populateGroupsFilter(e.target.value);
        populateServicesFilter(e.target.value, 'all');
      });

      filterGroupSelect.addEventListener('change', (e) => { window.lastSelectedGroup = e.target.value; console.log('GROUP CHANGED TO:', e.target.value);
        populateServicesFilter(filterTypeSelect.value, e.target.value);
      });
      filterTypeSelect.dataset.listenerBound = 'true';
    }
    
    syncTomSelect(filterTypeSelect);
  }

  let tsInstances = {};
  function syncTomSelect(el) {
    if (!el || typeof TomSelect === 'undefined') return;
    if (tsInstances[el.id]) {
      tsInstances[el.id].destroy();
    }
    const ts = new TomSelect(el, {
      create: false,
      maxOptions: 50,
      dropdownParent: 'body',
      selectOnTab: true,
      
      controlInput: '<input placeholder="Buscar...">'
    });
    
    tsInstances[el.id] = ts;
  }

  function populateGroupsFilter(typeFilter) { window.lastSelectedGroup = 'all';
    let filteredProducts = productsList;
    if (typeFilter !== 'all') {
      filteredProducts = productsList.filter(p => p.type === typeFilter);
    }
    const groups = [...new Set(filteredProducts.map(p => p.group))].filter(Boolean).sort();
    
    filterGroupSelect.innerHTML = '<option value="all">Todos los grupos</option>';
    groups.forEach(group => {
      const option = document.createElement('option');
      option.value = group;
      option.textContent = group;
      filterGroupSelect.appendChild(option);
    });
    
    syncTomSelect(filterGroupSelect);
  }

  function populateServicesFilter(typeFilter, groupFilter) {
    let filteredProducts = productsList;
    
    // Huge optimization: do not render all services in the dropdown at once!
    if (groupFilter === 'all' && productsList.length > 500) {
      filterServiceSelect.innerHTML = '<option value="">Seleccione un grupo primero...</option>'; window.lastSelectedServiceId = '';
      syncTomSelect(filterServiceSelect);
      return;
    }

    if (typeFilter && typeFilter !== 'all') {
      filteredProducts = filteredProducts.filter(p => p.type === typeFilter);
    }
    if (groupFilter && groupFilter !== 'all') {
      filteredProducts = filteredProducts.filter(p => p.group === groupFilter);
    }
    
    // Sort alphabetically by service name
    filteredProducts.sort((a, b) => a.service.localeCompare(b.service));

    filterServiceSelect.innerHTML = '<option value="">Selecciona un servicio</option>'; window.lastSelectedServiceId = '';
    filteredProducts.forEach(product => {
      const option = document.createElement('option');
      option.value = product.serviceid;
      // Add price for better UX
      option.textContent = `${product.service} - ${formatPrice(product.credit)}`;
      filterServiceSelect.appendChild(option);
    });
    
    syncTomSelect(filterServiceSelect);
  }

  // Handle Search Button Click
  if (btnAdvancedSearch) {
    // UX FIX: Intercept mousedown to forcefully select the active TomSelect option before blur clears it
    // UX FIX: Capture phase mousedown to forcefully select the option they typed BEFORE blur clears it
    btnAdvancedSearch.addEventListener('click', () => {
      let typeFilter = window.lastSelectedType || filterTypeSelect.value || 'all';
      let groupFilter = window.lastSelectedGroup || filterGroupSelect.value || 'all';
      let serviceIdFilter = window.lastSelectedServiceId || filterServiceSelect.value || '';
      
      const globalSearchQuery = (typeof globalProductSearch !== 'undefined' && globalProductSearch) ? globalProductSearch.value.toLowerCase().trim() : '';
      
      console.log('SEARCH TRIGGERED', {typeFilter, groupFilter, serviceIdFilter, globalSearchQuery});
      
      let filtered = productsList;

      
      // If user typed in the top global search box but clicked "Buscar" down here, apply it!
      if (globalSearchQuery) {
         filtered = filtered.filter(p => 
           String(p.service).toLowerCase().includes(globalSearchQuery) || 
           String(p.serviceid).toLowerCase().includes(globalSearchQuery) ||
           (p.group && p.group.toLowerCase().includes(globalSearchQuery))
         );
      }
      
      if (serviceIdFilter) {
         // Direct service selected
         filtered = filtered.filter(p => String(p.serviceid) === String(serviceIdFilter));
      } else {
         // Filter by type and group
         if (typeFilter && typeFilter !== 'all') filtered = filtered.filter(p => p.type === typeFilter);
         if (groupFilter && groupFilter !== 'all') filtered = filtered.filter(p => p.group === groupFilter);
      }
      
      if (filtered.length === 0) {
        productsBody.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <i data-lucide="search-code"></i>
            <h3>No se encontraron productos</h3>
          </div>
        `;
        lucide.createIcons();
      } else {
        window.currentSearchResults = filtered;
        let truncated = false;
        let combined = filtered;
        if (combined.length > 50) {
          combined = combined.slice(0, 50);
          truncated = true;
        }
        
        renderProductCards(combined);
        
        if (truncated) {
          const warningHtml = `
            <div id="search-truncated-warning" style="grid-column: 1 / -1; text-align: center; margin-top: 1rem; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
              <p style="color: var(--text-secondary); margin-bottom: 0.75rem; font-size: 0.95rem;">Mostrando los primeros 50 resultados de ${window.currentSearchResults.length} encontrados.</p>
              <button type="button" class="btn btn-primary" onclick="window.showAllSearchResults()" style="font-size: 0.85rem; padding: 8px 16px;">
                <i data-lucide="list"></i> Mostrar todos los resultados
              </button>
            </div>
          `;
          productsBody.insertAdjacentHTML('beforeend', warningHtml);
          lucide.createIcons();
        }
      }
      
      if (typeof productCount !== 'undefined' && productCount) {
        productCount.textContent = filtered.length;
      }

      categoriesGrid.classList.add('hidden');
      productsBody.classList.remove('hidden');
      btnBackToCategories.classList.remove('hidden');
      catalogTitle.textContent = `Resultados (T:${typeFilter} G:${groupFilter})`;
    });
  }

  // Handle direct Service selection trigger
  if (filterServiceSelect) {
    filterServiceSelect.addEventListener('change', (e) => { window.lastSelectedServiceId = e.target ? e.target.value : filterServiceSelect.value; console.log('SERVICE CHANGED TO:', window.lastSelectedServiceId);
       if (filterServiceSelect.value !== '') {
         // Optionally auto-search when a specific service is picked
         btnAdvancedSearch.click();
       }
    });
  }
  
  // Handle Global Text Search
  // Elemento globalProductSearch ya declarado arriba
  if (globalProductSearch) {
    let searchTimeout;
    globalProductSearch.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const q = e.target.value.toLowerCase().trim();
        if (q === '') {
           // Si se borra la búsqueda, volver al estado inicial del catálogo
           if (filterTypeSelect) {
             filterTypeSelect.value = 'all';
             if (tsInstances[filterTypeSelect.id]) tsInstances[filterTypeSelect.id].setValue('all', true);
           }
           if (filterGroupSelect) {
             filterGroupSelect.innerHTML = '<option value="all">Todos los grupos</option>';
             if (tsInstances[filterGroupSelect.id]) {
                tsInstances[filterGroupSelect.id].destroy();
                tsInstances[filterGroupSelect.id] = null;
             }
             populateGroupsFilter('all');
           }
           if (filterServiceSelect) {
             filterServiceSelect.innerHTML = '<option value="">Seleccione un grupo primero...</option>';
             if (tsInstances[filterServiceSelect.id]) {
                tsInstances[filterServiceSelect.id].destroy();
                tsInstances[filterServiceSelect.id] = null;
             }
             syncTomSelect(filterServiceSelect);
           }
           renderProducts(productsList); // Re-render the categories view
           return;
        }
        
        let filtered = productsList.filter(p => 
          String(p.service).toLowerCase().includes(q) || 
          String(p.serviceid).toLowerCase().includes(q)
        );
        
        window.currentSearchResults = filtered;
        let truncated = false;
        let combined = filtered;
        if (combined.length > 50) {
          combined = combined.slice(0, 50);
          truncated = true;
        }
        
        if (combined.length === 0) {
          productsBody.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
              <i data-lucide="search-code"></i>
              <h3>No se encontraron productos</h3>
            </div>
          `;
          lucide.createIcons();
        } else {
          renderProductCards(combined);
          if (truncated) {
            const warningHtml = `
              <div id="search-truncated-warning" style="grid-column: 1 / -1; text-align: center; margin-top: 1rem; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                <p style="color: var(--text-secondary); margin-bottom: 0.75rem; font-size: 0.95rem;">Mostrando los primeros 50 resultados de ${window.currentSearchResults.length} encontrados.</p>
                <button type="button" class="btn btn-primary" onclick="window.showAllSearchResults()" style="font-size: 0.85rem; padding: 8px 16px;">
                  <i data-lucide="list"></i> Mostrar todos los resultados
                </button>
              </div>
            `;
            productsBody.insertAdjacentHTML('beforeend', warningHtml);
            lucide.createIcons();
          }
        }
        
        if (typeof productCount !== 'undefined' && productCount) {
          productCount.textContent = combined.length;
        }
        
        categoriesGrid.classList.add('hidden');
        productsBody.classList.remove('hidden');
        btnBackToCategories.classList.remove('hidden');
        catalogTitle.textContent = `Resultados para "${q}"`;
      }, 300); // 300ms debounce
    });
  }

  // Render products into the table
  window.showAllSearchResults = function() {
      if (window.currentSearchResults && window.currentSearchResults.length > 0) {
          renderProductCards(window.currentSearchResults);
          const warning = document.getElementById('search-truncated-warning');
          if (warning) warning.remove();
      }
  };

  function renderProducts(products) {
    productsBody.innerHTML = '';
    productCount.textContent = products.length;

    if (!products || products.length === 0) {
      feedbackArea.innerHTML = `
        <div class="empty-state">
          <i data-lucide="search-code"></i>
          <h3>No se encontraron productos</h3>
        </div>
      `;
      feedbackArea.classList.remove('hidden');
      productsBody.classList.add('hidden');
      categoriesGrid.classList.add('hidden');
      lucide.createIcons();
      return;
    }

    feedbackArea.classList.add('hidden');
    categoriesGrid.parentElement.classList.remove('hidden');
    
    // Group products by category
    const grouped = {};
    products.forEach(p => {
      let gName = p.group || 'Otros Servicios';
      
      // Normalize AT&T groups into a single group
      const gnLower = gName.toLowerCase();
      if (gnLower.includes('att') || gnLower.includes('at&t') || gnLower.includes('at&amp;t')) {
        gName = 'Desbloqueos AT&T (USA / MX)';
      }
      
      if (!grouped[gName]) grouped[gName] = [];
      grouped[gName].push(p);
    });

    // --- FAVORITES INJECTION ---
    let favorites = [];
    try {
      favorites = JSON.parse(localStorage.getItem('mega_favorites') || '[]');
    } catch (e) {
      favorites = [];
    }
    const favoriteItems = products.filter(p => favorites.includes(String(p.serviceid)));
    // Always add the category so it appears at the start
    grouped['⭐ Mis Favoritos'] = favoriteItems;

    categoriesGrid.innerHTML = '';

    // Sort categories: "Hot" first, then alphabetical
    const entries = Object.entries(grouped);
    entries.sort((a, b) => {
      if (a[0] === '⭐ Mis Favoritos') return -1;
      if (b[0] === '⭐ Mis Favoritos') return 1;
      const isHotA = isHotCategory(a[0]);
      const isHotB = isHotCategory(b[0]);
      if (isHotA && !isHotB) return -1;
      if (!isHotA && isHotB) return 1;
      return a[0].localeCompare(b[0]);
    });

    for (const [groupName, items] of entries) {
      const tile = document.createElement('div');
      tile.className = 'category-tile';
      
      const isHot = isHotCategory(groupName);
      if (isHot) tile.classList.add('hot-category');
      
      let icon = 'layers';
      // Normalize group name: remove emojis, convert to lowercase
      const gn = groupName.toLowerCase().replace(/[\u1000-\uFFFF]+/g, '').trim();
      
      if (groupName === '⭐ Mis Favoritos') icon = 'star';
      else if (gn.includes('renta') || gn.includes('server') || gn.includes('remote') || gn.includes('usb')) icon = 'server';
      else if (gn.includes('streaming') || gn.includes('tv') || gn.includes('netflix')) icon = 'monitor';
      else if (gn.includes('vpn') || gn.includes('auth') || gn.includes('token') || gn.includes('mdm') || gn.includes('icloud')) icon = 'shield';
      else if (gn.includes('samsung') || gn.includes('xiaomi') || gn.includes('apple') || gn.includes('iphone') || gn.includes('imei') || gn.includes('unlock') || gn.includes('frp')) icon = 'smartphone';
      else if (gn.includes('tramite') || gn.includes('acta') || gn.includes('documento')) icon = 'file-text';
      else if (gn.includes('check') || gn.includes('finder') || gn.includes('info')) icon = 'search';
      else if (gn.includes('recarga') || gn.includes('saldo') || gn.includes('topup')) icon = 'zap';
      else if (gn.includes('esim') || gn.includes('sim') || gn.includes('network') || gn.includes('carrier')) icon = 'wifi';
      else if (gn.includes('redes sociales') || gn.includes('follower')) icon = 'users';
      else if (gn.includes('limpieza') || gn.includes('blacklist') || gn.includes('clean')) icon = 'check-circle';
      else if (gn.includes('tool') || gn.includes('schematic') || gn.includes('wuxinji') || gn.includes('refox')) icon = 'wrench';
      else if (gn.includes('licencia') || gn.includes('activa') || gn.includes('key')) icon = 'key';
      
      let hotBadgeHtml = isHot ? '<span class="hot-badge">🔥 HOT</span>' : '';
      
      tile.innerHTML = `
        ${hotBadgeHtml}
        <i data-lucide="${icon}"></i>
        <h3>${escapeHtml(groupName)}</h3>
        <span class="category-count">${items.length} Servicios</span>
      `;
      
      tile.addEventListener('click', () => {
        showCategoryProducts(groupName, items);
      });
      
      categoriesGrid.appendChild(tile);
    }
    
    showCategoriesView();
  }
  
  function isHotCategory(groupName) {
    const gn = groupName.toLowerCase();
    return gn.includes('renta') || gn.includes('check') || gn.includes('at&t') || gn.includes('att');
  }
  
  function showCategoriesView() {
    categoriesGrid.classList.remove('hidden');
    productsBody.classList.add('hidden');
    btnBackToCategories.classList.add('hidden');
    catalogTitle.textContent = 'Catálogo de Productos';
    lucide.createIcons();
  }

  function showCategoryProducts(groupName, items) {
    categoriesGrid.classList.add('hidden');
    productsBody.classList.remove('hidden');
    btnBackToCategories.classList.remove('hidden');
    catalogTitle.textContent = groupName;
    
    renderProductCards(items);
  }

  function renderProductCards(items) {
    productsBody.innerHTML = '';
    
    let favorites = [];
    try {
      favorites = JSON.parse(localStorage.getItem('mega_favorites') || '[]');
    } catch (e) {}
    
    items.forEach(p => {
      const priceText = formatPrice(p.credit);
      
      let adminPricesHtml = '';
      let adminCustomPriceHtml = '';
      if (authRole === 'admin' || authRole === 'colaborador') {
        const real = formatPrice(p.rawItem._REAL_COST || '0');
        const client = formatPrice(p.rawItem._CLIENT_PRICE || '0');
        
        const isOff = p.rawItem._DISABLED;
        const toggleBtnHtml = `
          <button type="button" class="btn btn-secondary btn-toggle-service" data-id="${escapeHtml(p.serviceid)}" data-disabled="${isOff ? 'true' : 'false'}" style="margin-top: 10px; width: 100%; border: 1px solid ${isOff ? '#ef4444' : '#10b981'}; color: ${isOff ? '#ef4444' : '#10b981'};">
            <i data-lucide="${isOff ? 'power-off' : 'power'}" style="width: 14px;"></i> ${isOff ? 'SERVICIO APAGADO (ON)' : 'SERVICIO ACTIVO (OFF)'}
          </button>
        `;

        adminPricesHtml = `
          <div style="font-size: 0.8rem; margin-top: 5px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 4px;">
            <div style="color: #10b981; margin-bottom: 2px;">Costo API: <strong>${real}</strong></div>
            <div style="color: #c4b5fd;">Precio Cliente: <strong>${client}</strong></div>
            ${toggleBtnHtml}
          </div>
        `;
        
        adminCustomPriceHtml = `
          <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
            <h4 style="margin-top: 0; margin-bottom: 10px; color: #f472b6; font-size: 0.9rem; display: flex; align-items: center; gap: 5px;">
              <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i> Asignar Precio Manual
            </h4>
            <form class="custom-price-form" data-id="${escapeHtml(p.serviceid)}" style="display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap;">
              <div class="input-group" style="flex: 1; min-width: 100px; margin-bottom: 0;">
                <label style="font-size: 0.75rem; margin-bottom: 3px;">Precio Reseller (MXN)</label>
                <input type="number" step="0.01" class="custom-reseller-input admin-price-input" data-id="${escapeHtml(p.serviceid)}" data-type="reseller" value="${p.rawItem._CUSTOM_RESELLER !== undefined ? escapeHtml(p.rawItem._CUSTOM_RESELLER) : ''}" placeholder="${escapeHtml(p.credit)}" style="padding: 6px; font-size: 0.85rem;" required>
              </div>
              <div class="input-group" style="flex: 1; min-width: 100px; margin-bottom: 0;">
                <label style="font-size: 0.75rem; margin-bottom: 3px;">Precio Cliente (MXN)</label>
                <input type="number" step="0.01" class="custom-client-input admin-price-input" data-id="${escapeHtml(p.serviceid)}" data-type="client" value="${p.rawItem._CUSTOM_CLIENT !== undefined ? escapeHtml(p.rawItem._CUSTOM_CLIENT) : ''}" placeholder="${escapeHtml(p.rawItem._CLIENT_PRICE || '0')}" style="padding: 6px; font-size: 0.85rem;" required>
              </div>
              <div style="display: flex; gap: 5px;">
                <button type="submit" class="btn btn-primary" style="padding: 6px 10px; font-size: 0.8rem;" title="Guardar Precio Fijo">
                  <i data-lucide="save" style="width: 14px; height: 14px; margin: 0;"></i>
                </button>
                <button type="button" class="btn btn-secondary btn-reset-price" data-id="${escapeHtml(p.serviceid)}" style="padding: 6px 10px; font-size: 0.8rem;" title="Restablecer (Auto)">
                  <i data-lucide="refresh-cw" style="width: 14px; height: 14px; margin: 0;"></i>
                </button>
              </div>
            </form>
            
            <h4 style="margin-top: 15px; margin-bottom: 10px; color: #34d399; font-size: 0.9rem; display: flex; align-items: center; gap: 5px;">
              <i data-lucide="users" style="width: 14px; height: 14px;"></i> Precios Exclusivos
            </h4>
            <button type="button" class="btn btn-secondary btn-user-prices" data-id="${escapeHtml(p.serviceid)}" data-title="${escapeHtml(p.service)}" style="width: 100%; display: flex; justify-content: center; align-items: center; gap: 6px; font-size: 0.85rem; padding: 8px;">
              <i data-lucide="user-cog" style="width: 16px; height: 16px;"></i> Configurar Precios por Usuario
            </button>
          </div>
        `;
      }
      
      const card = document.createElement('div');
      card.className = 'product-card';
      
      card.innerHTML = `
        <div class="product-card-header">
          <span class="product-id">ID: ${escapeHtml(p.serviceid)}</span>
        </div>
        <h3 class="product-title">${escapeHtml(p.service)}</h3>
        <div class="product-details">
          <div class="detail-row">
            <i data-lucide="clock"></i> <span>${escapeHtml(p.time)}</span>
          </div>
          <div class="detail-row" style="align-items: flex-start; flex-direction: column;">
            <div style="margin-bottom: ${authRole === 'admin' || authRole === 'colaborador' ? '5px' : '0'};"><i data-lucide="dollar-sign" style="width: 14px; display: inline-block;"></i> <strong style="color: #fff;">${authRole === 'admin' || authRole === 'colaborador' ? 'Precio Reseller: ' : ''}${priceText}</strong></div>
            ${adminPricesHtml}
          </div>
        </div>
        
        <div class="product-card-actions">
          <button type="button" class="btn-action-fav" data-id="${escapeHtml(p.serviceid)}" title="Favorito">
            <i data-lucide="star" style="${favorites.includes(String(p.serviceid)) ? 'color: gold; fill: gold;' : ''}"></i>
          </button>
          <button type="button" class="btn-action-details" data-id="${escapeHtml(p.serviceid)}">
            <i data-lucide="info"></i> Detalles
          </button>
          ${p.rawItem._DISABLED ? `
            <button type="button" class="btn-action-buy" style="background: rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.5); color: #ef4444; cursor: not-allowed;" disabled>
              <i data-lucide="x-circle"></i> OFF
            </button>
          ` : `
            <button type="button" class="btn-action-buy" data-id="${escapeHtml(p.serviceid)}">
              <i data-lucide="shopping-cart"></i> Comprar
            </button>
          `}
        </div>
        <div class="product-card-extra hidden" id="extra_${escapeHtml(p.serviceid)}">
          <div class="extra-content">
            <p><strong>Descripción:</strong> ${p.rawItem.INFO ? escapeHtml(p.rawItem.INFO).replace(/\\n/g, '<br>') : 'Sin información adicional.'}</p>
            ${adminCustomPriceHtml}
          </div>
        </div>
      `;
      productsBody.appendChild(card);
    });

    lucide.createIcons();

    document.querySelectorAll('.btn-action-buy').forEach(btn => {
      btn.addEventListener('click', () => {
        const serviceId = btn.getAttribute('data-id');
        openPurchaseModal(serviceId);
      });
    });

    document.querySelectorAll('.btn-action-details').forEach(btn => {
      btn.addEventListener('click', () => {
        const serviceId = btn.getAttribute('data-id');
        const extraDiv = document.getElementById(`extra_${serviceId}`);
        if (extraDiv) {
          extraDiv.classList.toggle('hidden');
          const isHidden = extraDiv.classList.contains('hidden');
          btn.innerHTML = isHidden ? '<i data-lucide="info"></i> Detalles' : '<i data-lucide="chevron-up"></i> Ocultar';
          lucide.createIcons();
        }
      });
    });

    document.querySelectorAll('.btn-action-fav').forEach(btn => {
      btn.addEventListener('click', () => {
        const serviceId = btn.getAttribute('data-id');
        let currentFavs = [];
        try {
          currentFavs = JSON.parse(localStorage.getItem('mega_favorites') || '[]');
        } catch(e) {}
        
        const idx = currentFavs.indexOf(String(serviceId));
        if (idx > -1) {
          currentFavs.splice(idx, 1);
          btn.innerHTML = '<i data-lucide="star"></i>';
        } else {
          currentFavs.push(String(serviceId));
          btn.innerHTML = '<i data-lucide="star" style="color: gold; fill: gold;"></i>';
        }
        localStorage.setItem('mega_favorites', JSON.stringify(currentFavs));
        lucide.createIcons();
        
        // If we are currently viewing the Favorites category, and we removed it, we might want to refresh, but it's fine as is.
      });
    });

    // Custom Price Form Listeners (Admin only)
    if (authRole === 'admin' || authRole === 'colaborador') {
      document.querySelectorAll('.custom-price-form').forEach(form => {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const serviceId = form.getAttribute('data-id');
          const resellerPrice = form.querySelector('.custom-reseller-input').value;
          const clientPrice = form.querySelector('.custom-client-input').value;
          
          try {
            const res = await fetch('/api/admin/product-price', {
              method: 'POST',
              headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
              body: JSON.stringify({ serviceid: serviceId, resellerPrice, clientPrice })
            });
            if (res.ok) {
              alert('Precio manual guardado correctamente.');
              await syncProducts(true);
            } else {
              const errText = await res.text();
              alert(`Error al guardar el precio manual. Código: ${res.status}. Detalles: ${errText}`);
            }
          } catch (err) {
            alert('Error de conexión.');
          }
        });
      });

      document.querySelectorAll('.btn-reset-price').forEach(btn => {
        btn.addEventListener('click', async () => {
          const serviceId = btn.getAttribute('data-id');
          if (!confirm('¿Estás seguro de restablecer el precio para usar el cálculo automático global?')) return;
          try {
            const res = await fetch(`/api/admin/product-price/${serviceId}`, {
              method: 'DELETE',
              headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` }
            });
            if (res.ok) {
              alert('Precio restablecido a automático.');
              await syncProducts(true);
            } else {
              alert('Error al restablecer.');
            }
          } catch (err) {
            alert('Error de conexión.');
          }
        });
      });

      document.querySelectorAll('.btn-user-prices').forEach(btn => {
        btn.addEventListener('click', () => {
          const serviceId = btn.getAttribute('data-id');
          const serviceTitle = btn.getAttribute('data-title');
          openUserPricesModal(serviceId, serviceTitle);
        });
      });
    }

    document.querySelectorAll('.btn-toggle-service').forEach(btn => {
      btn.addEventListener('click', async () => {
        const serviceId = btn.getAttribute('data-id');
        const isDisabled = btn.getAttribute('data-disabled') === 'true';
        const newStatus = !isDisabled;
        if (!confirm(`¿Estás seguro de que deseas ${newStatus ? 'APAGAR' : 'ENCENDER'} este servicio para los clientes?`)) return;
        
        try {
          const res = await fetch('/api/admin/toggle-service', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ serviceid: serviceId, disabled: newStatus })
          });
          
          if (res.ok) {
            alert(`Servicio ${newStatus ? 'apagado' : 'encendido'} exitosamente.`);
            await syncProducts(true);
          } else {
            const errText = await res.text();
            alert(`Error al cambiar el estado del servicio: ${errText}`);
          }
        } catch (err) {
          alert('Error de conexión.');
        }
      });
    });
  }

  let activeUserServiceId = null;
  const userCustomPriceModal = document.getElementById('userCustomPriceModal');
  const userCustomPriceBody = document.getElementById('userCustomPriceBody');
  const userModalTitle = document.getElementById('userModalTitle');
  const btnCloseUserModal = document.getElementById('btnCloseUserModal');
  const btnCancelUserModal = document.getElementById('btnCancelUserModal');
  const btnSaveUserModal = document.getElementById('btnSaveUserModal');

  if (btnCloseUserModal) btnCloseUserModal.addEventListener('click', () => userCustomPriceModal.classList.add('hidden'));
  if (btnCancelUserModal) btnCancelUserModal.addEventListener('click', () => userCustomPriceModal.classList.add('hidden'));
  
  if (btnSaveUserModal) {
    btnSaveUserModal.addEventListener('click', async () => {
      if (!activeUserServiceId) return;
      const inputs = userCustomPriceBody.querySelectorAll('.user-specific-price-input');
      const userPrices = {};
      inputs.forEach(input => {
        const val = input.value.trim();
        if (val !== '') {
          userPrices[input.dataset.userid] = { resellerPrice: parseFloat(val) };
        }
      });
      
      try {
        const res = await fetch(`/api/admin/user-product-prices/${activeUserServiceId}`, {
          method: 'POST',
          headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
          body: JSON.stringify({ userPrices })
        });
        if (res.ok) {
          alert('Precios exclusivos guardados correctamente.');
          userCustomPriceModal.classList.add('hidden');
          syncProducts(true);
        } else {
          alert('Error al guardar precios.');
        }
      } catch (err) {
        alert('Error de conexión.');
      }
    });
  }

  async function openUserPricesModal(serviceId, serviceTitle) {
    activeUserServiceId = serviceId;
    userModalTitle.textContent = `Precios: ${serviceTitle}`;
    userCustomPriceModal.classList.remove('hidden');
    userCustomPriceBody.innerHTML = '<div class="spinner-container" style="padding: 40px 0;"><div class="spinner"></div><p style="text-align:center; margin-top:10px;">Cargando usuarios...</p></div>';
    
    try {
      const [usersRes, pricesRes] = await Promise.all([
        fetch('/api/users', { headers: { 'Authorization': `Bearer ${authToken}` } }),
        fetch(`/api/admin/user-product-prices/${serviceId}`, { headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` } })
      ]);
      
      if (!usersRes.ok || !pricesRes.ok) throw new Error('Error fetching data');
      
      const users = await usersRes.json();
      const prices = await pricesRes.json();
      
      userCustomPriceBody.innerHTML = '<p style="font-size:0.85rem; color:var(--text-secondary); margin:0 0 10px 0;">Si dejas el campo en blanco, el revendedor usará el precio global.</p>';
      const resellers = users.filter(u => u.role !== 'admin');
      
      if (resellers.length === 0) {
        userCustomPriceBody.innerHTML = '<p>No hay revendedores registrados.</p>';
        return;
      }
      
      resellers.forEach(u => {
        const currentPrice = prices[u.id] ? prices[u.id].resellerPrice : '';
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px;';
        row.innerHTML = `
          <div>
            <strong style="color: #fff; font-size: 0.95rem;">${escapeHtml(u.username)}</strong>
            <div style="font-size: 0.8rem; color: var(--text-muted);">Aumento base: +$${u.markup || 0}</div>
          </div>
          <div class="input-group" style="margin: 0; width: 140px;">
            <input type="number" step="0.01" class="user-specific-price-input" data-userid="${escapeHtml(u.id)}" placeholder="Normal" value="${currentPrice}" style="padding: 8px; text-align: right;">
          </div>
        `;
        userCustomPriceBody.appendChild(row);
      });
      
    } catch (err) {
      userCustomPriceBody.innerHTML = '<p style="color:#ef4444; text-align:center;">Error al cargar datos.</p>';
    }
  }

  // Format price helper
  function formatPrice(credits) {
    const rawVal = parseFloat(credits) || 0;
    return `$${rawVal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
  }

  // Smart Parser for Credentials
  function parseCredentials(text) {
    if (!text) return { user: 'N/A', pass: 'N/A' };
    
    // Replace breaks first so they don't leak into the output
    let preCleanText = String(text).replace(/<br\s*\/?>/gi, ' ').replace(/<\/div>/gi, ' ').replace(/<[^>]*>?/gm, '').trim();

    // Pattern 0: Explicit check for ✅ separator
    if (preCleanText.includes('✅')) {
      let parts = preCleanText.split('✅').map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return { user: parts[0], pass: parts[parts.length - 1] };
      }
    }
    
    // Replace emojis, equal signs, pipes, commas with spaces
    let cleanText = preCleanText
      .replace(/[✨⭐★=|,;]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Pattern 1: Explicit labels like "user : xxx pass: yyy"
    let match = cleanText.match(/(?:username|user|usuario|login|email|correo)\s*[:=-]?\s*(\S+)\s+(?:password|pass|contraseña|clave|pin)\s*[:=-]?\s*(\S+)/i);
    if (match) {
      // Clean up captured values (remove trailing colons if any)
      let u = match[1].replace(/[:=-]+$/, '');
      let p = match[2].replace(/[:=-]+$/, '');
      return { user: u, pass: p };
    }

    // Find email if present
    let emailMatch = cleanText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);

    // Filter out filler words and short prefixes
    let tokens = cleanText.split(/\s+/).filter(t => 
      t.length > 2 && 
      !t.toLowerCase().includes('login') && 
      !t.toLowerCase().includes('detail') && 
      !t.toLowerCase().includes('success') && 
      !/^[=]+$/.test(t)
    );
    
    // If we have an email, prioritize it as the user, and the next most reasonable token as password
    if (emailMatch && tokens.length >= 2) {
      const email = emailMatch[1];
      // Exclude the email itself and any tiny prefix numbers (like '12') from being the password
      const otherTokens = tokens.filter(t => t !== email && !/^[0-9]{1,3}$/.test(t));
      if (otherTokens.length > 0) {
        return { user: email, pass: otherTokens[otherTokens.length - 1] };
      }
    }

    // Pattern 2: Two valid strings remaining
    if (tokens.length >= 2) {
      return { user: tokens[tokens.length - 2], pass: tokens[tokens.length - 1] };
    }

    // Fallback if we couldn't parse cleanly
    return { user: 'VER_HISTORIAL', pass: 'VER_HISTORIAL' };
  }

  // Bulk save prices logic
  btnBulkSavePrices.addEventListener('click', async () => {
    if (authRole !== 'admin') return;
    
    // Collect all custom price inputs that might have been modified
    // We'll just collect ALL visible inputs for simplicity, 
    // or ideally only those that differ from original, but sending all is fine for small catalogs.
    // To be efficient, let's grab all inputs with class 'admin-price-input'
    const inputs = document.querySelectorAll('.admin-price-input');
    const bulkData = {};
    
    inputs.forEach(input => {
      const serviceId = input.getAttribute('data-id');
      const type = input.getAttribute('data-type'); // 'reseller' or 'client'
      const val = input.value;
      
      if (!bulkData[serviceId]) {
        bulkData[serviceId] = {};
      }
      if (type === 'reseller') bulkData[serviceId].resellerPrice = val;
      if (type === 'client') bulkData[serviceId].clientPrice = val;
    });

    const bulkArray = [];
    for (const serviceId in bulkData) {
      if (bulkData[serviceId].resellerPrice !== undefined && bulkData[serviceId].clientPrice !== undefined) {
        bulkArray.push({
          serviceId: serviceId,
          resellerPrice: bulkData[serviceId].resellerPrice,
          clientPrice: bulkData[serviceId].clientPrice
        });
      }
    }

    if (bulkArray.length === 0) {
      alert('No hay precios que guardar.');
      return;
    }

    const originalText = btnBulkSavePrices.innerHTML;
    btnBulkSavePrices.innerHTML = '<i data-lucide="loader"></i> Guardando...';
    lucide.createIcons();
    btnBulkSavePrices.disabled = true;

    try {
      const res = await fetch('/api/admin/product-price', {
        method: 'POST',
        headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ bulk: bulkArray })
      });
      if (res.ok) {
        alert('Todos los precios manuales fueron guardados exitosamente.');
        await syncProducts(true);
      } else {
        alert('Error al guardar masivamente.');
      }
    } catch (err) {
      alert('Error de conexión.');
    } finally {
      btnBulkSavePrices.innerHTML = originalText;
      lucide.createIcons();
      btnBulkSavePrices.disabled = false;
    }
  });

  // Status indicator helper
  function updateStatus(type, text) {
    const dot = connectionStatus.querySelector('.status-dot');
    const label = connectionStatus.querySelector('.status-text');
    dot.className = 'status-dot ' + type;
    label.textContent = text;
  }

  // Loading state helper
  function setLoadingState(isLoading) {
    if (isLoading) {
      feedbackArea.innerHTML = `
        <div class="spinner-container">
          <div class="spinner"></div>
          <p>Consultando catálogo a la API de Dhru Fusion...</p>
        </div>
      `;
      feedbackArea.classList.remove('hidden');
      productsBody.parentElement.classList.add('hidden');
    }
  }

  // Error messaging helper
  function showError(message) {
    feedbackArea.innerHTML = `
      <div class="empty-state" style="color: var(--status-offline)">
        <i data-lucide="alert-triangle"></i>
        <h3>Error al Sincronizar</h3>
        <p style="color: var(--text-secondary)">${escapeHtml(message)}</p>
        <div class="error-details">
          Sugerencia: Asegúrate de que el endpoint sea correcto, que tu IP no esté bloqueada/no requiera lista blanca (whitelist) en el panel de Dhru Fusion, y que las credenciales ingresadas sean correctas. 
          <br><br>
          <button type="button" class="btn btn-secondary btn-small" style="margin: 0 auto; display: block;" id="btnErrorGoBack">
            Volver a Credenciales
          </button>
        </div>
      </div>
    `;
    feedbackArea.classList.remove('hidden');
    productsBody.parentElement.classList.add('hidden');
    lucide.createIcons();

    document.getElementById('btnErrorGoBack').addEventListener('click', () => {
      btnLogout.click();
    });
  }

  // HTML sanitization helper
  function escapeHtml(unsafe) {
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }

  // ============================================
  // ORDER HISTORY RENDERING LOGIC (RESELLER PANEL STYLE TABLE)
  // ============================================

  function renderOrderHistory() {
    historyBody.innerHTML = '';
    
    // Helper to colorize server responses
    function colorizeServerResponse(text) {
      if (!text) return 'Sin comentarios';
      
      if (typeof text === 'object') {
          try {
              text = JSON.stringify(text, null, 2);
          } catch(e) {
              text = String(text);
          }
      }
      
      let cleaned = String(text);
      cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
      cleaned = cleaned.replace(/<\/div>/gi, '\n');
      cleaned = cleaned.replace(/<\/p>/gi, '\n');
      cleaned = cleaned.replace(/<\/li>/gi, '\n');
      cleaned = cleaned.replace(/<[^>]*>?/gm, '');
      cleaned = cleaned.replace(/\n\s*\n/g, '\n').trim();

      let safeText = escapeHtml(cleaned);
      
      // Match Key: Value pattern and wrap in spans for coloring (exclude http/https)
      safeText = safeText.replace(/^([a-zA-Z0-9_ \-\.]+):\s*(.*)$/gm, (match, p1, p2) => {
        if (p1.toLowerCase() === 'http' || p1.toLowerCase() === 'https') {
          return match; 
        }
        return `<span style="color: var(--secondary-color); font-weight: 600;">${p1}:</span> <span style="color: #10b981;">${p2}</span>`;
      });

      // Detect URLs and make them clickable
      const urlRegex = /(https?:\/\/[^\s<]+)/g;
      safeText = safeText.replace(urlRegex, '<a href="$1" target="_blank" style="color: #00f0ff; text-decoration: underline;">$1</a>');

      return safeText;
    }
    
    const limit = parseInt(historyLimitFilter.value) || 10;
    const query = historySearchInput.value.toLowerCase().trim();

    let filteredHistory = [...orderHistory];

    if (query) {
      filteredHistory = filteredHistory.filter(item => {
        return item.serviceId.toString().toLowerCase().includes(query) ||
               item.serviceName.toLowerCase().includes(query) ||
               item.imei.toLowerCase().includes(query);
      });
    }

    historyCount.textContent = filteredHistory.length;

    const colspanCount = authRole === 'admin' ? 9 : 7;
    const theadTr = document.querySelector('.reseller-history-table thead tr');
    if (theadTr) {
      if (authRole === 'admin') {
        theadTr.innerHTML = `
          <th>ID</th>
          <th>SERVICIO</th>
          <th>USUARIO</th>
          <th>CATEGORÍA</th>
          <th>DETALLES / IMEI</th>
          <th>ESTADO</th>
          <th>CÓDIGO</th>
          <th>COSTO</th>
          <th>GANANCIA</th>
        `;
      } else {
        theadTr.innerHTML = `
          <th>ID</th>
          <th>SERVICIO</th>
          <th>CATEGORÍA</th>
          <th>DETALLES / IMEI</th>
          <th>ESTADO</th>
          <th>CÓDIGO</th>
          <th>COSTO</th>
        `;
      }
    }

    const sortedHistory = [...filteredHistory];
    const pagedHistory = sortedHistory.slice(0, limit);

    if (pagedHistory.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td colspan="${colspanCount}" style="text-align: center; color: var(--text-muted); padding: 2rem;">
          No hay órdenes registradas que coincidan con la búsqueda.
        </td>
      `;
      historyBody.appendChild(tr);
      return;
    }

    pagedHistory.forEach((item) => {
      const trHeader = document.createElement('tr');
      trHeader.className = 'history-row-header-click';
      trHeader.setAttribute('data-target-id', `details_row_${item.id}`);

      // Determine category (IMEI, SERVER, REMOTE)
      let category = item.serviceType;
      if (!category) {
        const matchingProduct = productsList.find(p => String(p.serviceid) === String(item.serviceId));
        if (matchingProduct && matchingProduct.serviceType === 'SERVER') {
          category = 'SERVER';
        } else {
          category = 'IMEI';
        }
      }

      let categoryClass = 'badge-category-imei';
      if (category === 'SERVER') {
        categoryClass = 'badge-category-server';
      } else if (category === 'REMOTE') {
        categoryClass = 'badge-category-remote';
      }

      // Determine status label and class
      let statusLabel = 'EN ESPERA';
      let statusClass = 'status-badge pending';
      if (item.status === 'success') {
        statusLabel = 'EXITOSO';
        statusClass = 'status-badge success';
      } else if (item.status === 'failed') {
        statusLabel = 'RECHAZADO';
        statusClass = 'status-badge rejected';
      }

      const formattedCost = formatPrice(item.costInCredits);
      
      let displayImeiNum = item.imei;
      if (displayImeiNum.includes('(')) {
        const customDataMatch = displayImeiNum.match(/\(([^)]+)\)/);
        if (customDataMatch) {
          const customData = customDataMatch[1];
          const parts = customData.split(':');
          const key = parts[0];
          const val = parts.slice(1).join(':').trim();
          displayImeiNum = `
            <div style="display: flex; flex-direction: column; line-height: 1.4;">
              <span style="color: var(--text-secondary); font-size: 0.75rem;">${escapeHtml(key)}</span>
              <span style="display: flex; align-items: center; gap: 4px; font-family: 'Inter', sans-serif; font-size: 0.85rem; color: var(--text-primary);">
                <i data-lucide="info" style="width: 12px; height: 12px; color: #3b82f6;"></i>
                ${escapeHtml(val)}
              </span>
            </div>
          `;
        } else {
           const imeiOnly = displayImeiNum.split(' ')[0];
           displayImeiNum = `<span style="font-family: 'Fira Code', monospace; color: #a5b4fc;">${escapeHtml(imeiOnly)}</span>`;
        }
      } else if (displayImeiNum === 'N/A') {
        displayImeiNum = `<span style="color: var(--text-muted); font-size: 0.8rem;">N/A</span>`;
      } else {
        // Normal IMEI
        displayImeiNum = `<span style="font-family: 'Fira Code', monospace; color: #a5b4fc;">${escapeHtml(displayImeiNum)}</span>`;
      }

      // Display CODE result matching screenshot under CODIGO column
      // First strip HTML for the summary view so we don't render literal <div> tags
      let rawString = String(item.statusText || item.msg || '');
      let strippedText = rawString.replace(/<br\s*\/?>/gi, ' ').replace(/<\/div>/gi, ' ').replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
      let displayCodeContent = strippedText;
      if (displayCodeContent.length > 35) displayCodeContent = displayCodeContent.substring(0, 35) + '...';

      trHeader.innerHTML = `
        <td>
          <button type="button" class="btn-expand-row">+</button>
          <span class="product-id" title="ID de Orden" style="font-weight: bold; color: ${item.orderId ? 'var(--text-primary)' : 'var(--text-muted)'};">
            ${item.orderId ? escapeHtml(item.orderId) : '[Sin ID]'}
          </span>
        </td>
        <td>
          <strong>${escapeHtml(item.serviceName || item.service || 'Servicio')}</strong> 
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">ID: ${escapeHtml(item.serviceId || 'N/A')}</div>
        </td>
        ${authRole === 'admin' ? `
        <td>
          <div style="font-size: 0.85rem; color: #a78bfa; font-weight: 600;">${escapeHtml(item.username || 'N/A')}</div>
        </td>
        ` : ''}
        <td><span class="status-badge ${categoryClass}">${category}</span></td>
        <td>${displayImeiNum}</td>
        <td><span class="${statusClass}">${statusLabel}</span></td>
        <td><div style="font-family: 'Fira Code', monospace; font-size:0.8rem; color:#94a3b8; max-width:280px; display:inline-block; white-space:pre-wrap; word-break:break-word; background: rgba(0,0,0,0.4); padding: 0.3rem 0.6rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">${escapeHtml(displayCodeContent)}</div></td>
        <td><strong class="order-cost-val" style="color: #34d399;">$${parseFloat(item.costCharged || item.costInCredits || 0).toFixed(2)}</strong></td>
        ${authRole === 'admin' ? `
        <td>
          <strong style="color: #10b981;">+$${parseFloat(item.profit || 0).toFixed(2)}</strong>
        </td>
        ` : ''}
      `;

      // Expandable details sub-row
      const trDetails = document.createElement('tr');
      trDetails.className = 'history-detail-row hidden';
      trDetails.id = `details_row_${item.id}`;
      trDetails.innerHTML = `
        <td colspan="${colspanCount}" class="history-detail-cell">
          <div class="order-card-details" style="padding: 1rem 0; overflow-y: auto;">
            <div class="details-grid">
              <div class="details-col">
                <span class="detail-label">PEDIDO DESDE</span>
                <strong class="detail-val">API</strong>
              </div>
              <div class="details-col">
                <span class="detail-label">DIRECCIÓN IP</span>
                <strong class="detail-val">${escapeHtml(item.ip || '127.0.0.1')}</strong>
              </div>
              <div class="details-col">
                <span class="detail-label">FECHA DE CREACIÓN</span>
                <strong class="detail-val">${escapeHtml(item.date || item.timestamp || 'N/A')}</strong>
              </div>
              <div class="details-col">
                <span class="detail-label">FECHA DE ACTUALIZACIÓN</span>
                <strong class="detail-val">${escapeHtml(item.updateTimestamp || item.date || item.timestamp || 'N/A')}</strong>
              </div>
            </div>
            <div class="details-comments">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <span class="detail-label" style="margin-bottom: 0;">COMENTARIOS / CREDENCIALES ENTREGADAS</span>
                <div style="display: flex; gap: 0.5rem;">
                  <button type="button" class="btn btn-sm btn-copy-raw" style="background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 0.3rem; font-weight: bold;"><i data-lucide="copy" style="width: 14px; height: 14px;"></i> Copiar</button>
                  ${item.status === 'success' ? `<button type="button" class="btn btn-sm btn-ticket" style="background: rgba(0,240,255,0.1); color: #00f0ff; border: 1px solid rgba(0,240,255,0.3); padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 0.3rem; font-weight: bold;"><i data-lucide="image" style="width: 14px; height: 14px;"></i> Generar Ticket</button>` : ''}
                  ${authRole === 'admin' && !item.isRefunded && item.status !== 'success' ? `<button type="button" class="btn btn-sm btn-refund" style="background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 0.3rem; font-weight: bold;" data-orderid="${item.orderId}" data-serverid="${item.serverId}"><i data-lucide="undo-2" style="width: 14px; height: 14px;"></i> Reembolsar Cliente</button>` : ''}
                  ${item.isRefunded ? `<span style="background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; display: flex; align-items: center; gap: 0.3rem;"><i data-lucide="check-circle" style="width: 14px; height: 14px;"></i> Dinero Reembolsado</span>` : ''}
                </div>
              </div>
              <pre class="detail-val-pre">${colorizeServerResponse(item.statusText || item.msg || 'N/A')}</pre>
            </div>
            ${item.notes ? `
            <div class="details-comments" style="margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1rem;">
              <span class="detail-label">NOTAS DEL PEDIDO (TU INFORMACIÓN)</span>
              <pre class="detail-val-pre" style="color: #a78bfa;">${escapeHtml(item.notes)}</pre>
            </div>
            ` : ''}
          </div>
        </td>
      `;

      // Hook click event
      trHeader.addEventListener('click', (e) => {
        // Expand row on click anywhere
        
        const detailsRow = document.getElementById(`details_row_${item.id}`);
        const btnExpand = trHeader.querySelector('.btn-expand-row');
        
        const isHidden = detailsRow.classList.contains('hidden');
        if (isHidden) {
          detailsRow.classList.remove('hidden');
          btnExpand.textContent = '-';
          btnExpand.style.background = 'var(--status-offline)';
          btnExpand.style.color = '#fff';
          btnExpand.style.borderColor = 'var(--status-offline)';
        } else {
          detailsRow.classList.add('hidden');
          btnExpand.textContent = '+';
          btnExpand.style.background = 'rgba(34, 211, 238, 0.1)';
          btnExpand.style.color = '#22d3ee';
          btnExpand.style.borderColor = 'rgba(34, 211, 238, 0.3)';
        }
      });

      historyBody.appendChild(trHeader);
      historyBody.appendChild(trDetails);

      // Ticket Button Event Listener
      if (item.status === 'success') {
        const btnTicket = trDetails.querySelector('.btn-ticket');
        if (btnTicket) {
          btnTicket.addEventListener('click', () => {
            currentTicketData = item;
            ticketClientPrice.value = '';
            ticketModal.classList.remove('hidden');
          });
        }
      }

      // Copy Button Event Listener
      const btnCopyRaw = trDetails.querySelector('.btn-copy-raw');
      if (btnCopyRaw) {
        btnCopyRaw.addEventListener('click', async () => {
          try {
            const rawText = String(item.statusText || '').replace(/<br\s*\/?>/gi, '\n').trim();
            await navigator.clipboard.writeText(rawText);
            
            const originalHtml = btnCopyRaw.innerHTML;
            btnCopyRaw.innerHTML = '<i data-lucide="check" style="width: 14px; height: 14px; color: #10b981;"></i> <span style="color: #10b981;">¡Copiado!</span>';
            lucide.createIcons();
            
            setTimeout(() => {
              btnCopyRaw.innerHTML = originalHtml;
              lucide.createIcons();
            }, 2000);
          } catch (e) {
            console.error('Error al copiar', e);
            alert('Error al copiar al portapapeles');
          }
        });
      }

      // Refund Button Event Listener
      const btnRefund = trDetails.querySelector('.btn-refund');
      if (btnRefund) {
        btnRefund.addEventListener('click', async () => {
          if (!confirm(`¿Estás seguro de que quieres reembolsar la orden #${item.orderId} a ${item.username}?`)) return;
          
          const orderId = btnRefund.getAttribute('data-orderid');
          const serverId = btnRefund.getAttribute('data-serverid');
          
          btnRefund.disabled = true;
          btnRefund.innerHTML = 'Reembolsando...';
          
          try {
            const res = await fetch('/api/admin/refund', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
              body: JSON.stringify({ orderId, serverId })
            });
            const data = await res.json();
            if (data.success) {
              alert('Orden reembolsada correctamente al usuario.');
              btnRefund.innerHTML = 'Reembolsado ✅';
              btnRefund.classList.remove('btn-refund');
              // Auto-refresh the page or trigger fetchHistory
              if (typeof fetchHistory === 'function') fetchHistory();
            } else {
              alert(data.error || 'Error al reembolsar');
              btnRefund.disabled = false;
              btnRefund.innerHTML = 'Reintentar Reembolso';
            }
          } catch (e) {
            alert('Error de conexión');
            btnRefund.disabled = false;
            btnRefund.innerHTML = 'Reintentar Reembolso';
          }
        });
      }
    });
  }

  function addOrderToHistory(orderRecord) {
    orderRecord.localUniqueId = 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    orderHistory.push(orderRecord);
    if (orderHistory.length > 100) {
      orderHistory.shift();
    }
    localStorage.setItem('dhru_order_history', JSON.stringify(orderHistory));
    renderOrderHistory();
  }

  // Hook history limit and search filter listeners
  historyLimitFilter.addEventListener('change', renderOrderHistory);
  historySearchInput.addEventListener('input', renderOrderHistory);

  // ============================================
  // DEBUG API CALLS LOGGING LOGIC
  // ============================================

  function maskApiKey(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const cloned = JSON.parse(JSON.stringify(obj));
    if (cloned.apiaccesskey) {
      cloned.apiaccesskey = '••••••••••••••••' + cloned.apiaccesskey.slice(-4);
    }
    return cloned;
  }

  function logApiCall(action, requestParams, responseData, isSuccess) {
    const timestamp = new Date().toLocaleTimeString('es-MX');
    const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const maskedParams = maskApiKey(requestParams);
    
    const entry = {
      id: logId,
      time: timestamp,
      action: action,
      params: maskedParams,
      response: responseData,
      isSuccess: isSuccess
    };

    consoleLogList.push(entry);
    if (consoleLogList.length > 40) {
      consoleLogList.shift();
    }

    renderConsoleLogs();
  }

  function renderConsoleLogs() {
    consoleCount.textContent = consoleLogList.length;
    if (consoleLogList.length === 0) {
      consoleEmpty.classList.remove('hidden');
      consoleList.innerHTML = '';
      return;
    }

    consoleEmpty.classList.add('hidden');
    consoleList.innerHTML = '';

    const reversedLogs = [...consoleLogList].reverse();

    reversedLogs.forEach(log => {
      const item = document.createElement('div');
      item.className = 'console-log-item';
      const statusText = log.isSuccess ? 'CONEXIÓN EXITOSA' : 'ERROR / RECHAZADO';
      const statusClass = log.isSuccess ? 'log-status-success' : 'log-status-failed';
      
      item.innerHTML = `
        <div class="console-log-header">
          <div>
            <span class="log-time">[${log.time}]</span>
            <span class="log-action">${escapeHtml(log.action.toUpperCase())}</span>
          </div>
          <strong class="${statusClass}">${statusText}</strong>
        </div>
        <div class="console-log-details" id="details_${log.id}">
          <div class="log-subheading">1. PARÁMETROS DE PETICIÓN ENVIADOS (CENSURADO):</div>
          <span>${escapeHtml(JSON.stringify(log.params, null, 2))}</span>
          <br><br>
          <div class="log-subheading">2. RESPUESTA COMPLETA DE LA API (JSON RAW):</div>
          <span>${escapeHtml(JSON.stringify(log.response, null, 2))}</span>
        </div>
      `;
      
      item.addEventListener('click', () => {
        const details = item.querySelector('.console-log-details');
        details.classList.toggle('show');
      });

      consoleList.appendChild(item);
    });
  }

  // ============================================
  // ORDER / PURCHASE MODAL LOGIC
  // ============================================

  function openPurchaseModal(serviceId) {
    const product = productsList.find(p => p.serviceid.toString() === serviceId.toString());
    if (!product) return;

    selectedProductForOrder = product;

    modalServiceId.textContent = `ID: ${product.serviceid}`;
    modalServiceName.textContent = product.service;
    modalServiceGroup.textContent = product.group;
    modalServicePrice.textContent = `Costo: ${formatPrice(product.credit)}`;

    // Balance check and Price calculation
    const baseCost = parseFloat(product.credit) || 0;
    const balance = globalApiCreditRaw || 0;
    
    function updatePriceDisplay(qty) {
      const totalCost = baseCost * qty;
      modalServicePrice.textContent = `Costo: ${formatPrice(totalCost)}`;
      
      if (balance >= totalCost) {
        modalBalanceWarning.style.display = 'block';
        modalBalanceWarning.style.color = '#34d399';
        modalBalanceWarning.style.background = 'rgba(16,185,129,0.1)';
        modalBalanceWarning.textContent = '✅ Saldo suficiente';
      } else {
        modalBalanceWarning.style.display = 'block';
        modalBalanceWarning.style.color = '#f87171';
        modalBalanceWarning.style.background = 'rgba(239,68,68,0.1)';
        modalBalanceWarning.textContent = '❌ Saldo insuficiente comuníquese con el administrador #angel';
      }
      btnConfirmOrder.removeAttribute('disabled');
    }
    
    // Quantity Setup
    const raw = product.rawItem || {};
    
    // Remove previous listeners safely
    let currentQtyInput = document.getElementById('quantityInput');
    const newQuantityInput = currentQtyInput.cloneNode(true);
    currentQtyInput.parentNode.replaceChild(newQuantityInput, currentQtyInput);
    newQuantityInput.value = 1;
    
    if (raw.QNT === "1") {
      document.getElementById('quantityInputGroup').classList.remove('hidden');
      let minQnt = parseInt(raw.MINQNT) || 1;
      let maxQnt = parseInt(raw.MAXQNT) || 9999;
      if (minQnt <= 0) minQnt = 1;
      if (maxQnt <= 0) maxQnt = 9999;
      
      newQuantityInput.min = minQnt;
      newQuantityInput.max = maxQnt;
      newQuantityInput.value = minQnt;
      document.getElementById('quantityHint').textContent = `Mínimo: ${minQnt} | Máximo: ${maxQnt}`;
      
      newQuantityInput.addEventListener('input', (e) => {
        let val = parseInt(e.target.value) || minQnt;
        if (val < minQnt) val = minQnt;
        if (val > maxQnt) val = maxQnt;
        updatePriceDisplay(val);
      });
      updatePriceDisplay(minQnt);
    } else {
      document.getElementById('quantityInputGroup').classList.add('hidden');
      updatePriceDisplay(1);
    }
    
    // Helper to fix mojibake encoding issues from some servers (e.g., SÃ¡bado -> Sábado)
    const fixText = (str) => {
      if (!str) return str;
      try { return decodeURIComponent(escape(str)); } catch (e) { return str; }
    };

    // Service Info
    if (product.rawItem && (product.rawItem.INFO || product.rawItem.TIME || product.rawItem.FAQ)) {
      modalServiceInfoBlock.style.display = 'block';
      modalServiceTime.textContent = product.rawItem.TIME ? `Tiempo Estimado: ${fixText(product.rawItem.TIME)}` : '';
      
      let infoHtml = fixText(product.rawItem.INFO) || '';
      if (product.rawItem.FAQ) {
        infoHtml += `\n\nFAQ:\n${fixText(product.rawItem.FAQ)}`;
      }
      modalServiceInfoText.innerHTML = infoHtml.replace(/<br\s*\/?>/gi, '\n').trim();
    } else {
      modalServiceInfoBlock.style.display = 'none';
    }

    imeiInput.value = '';
    customFieldsContainer.innerHTML = '';
    
    // Default: Assume IMEI is required unless explicitly disabled or if it's a known non-IMEI group
    let needsImei = true;
    const gName = (product.group || '').toLowerCase();
    const sName = (product.service || '').toLowerCase();
    
    // Check backend type or various casing for Requires.Imei
    if (raw && raw._SERVICE_TYPE === 'SERVER') {
      needsImei = false;
    } else if (raw && (raw.requires_imei === false || raw.requires_imei === '0' || raw['Requires.Imei'] === false || raw['Requires.Imei'] === '0' || raw['Requires.IMEI'] === '0')) {
      needsImei = false;
    } else if (gName.includes('server') || gName.includes('file') || gName.includes('software') || gName.includes('streaming') || gName.includes('licencia') || gName.includes('credit') || gName.includes('tramite')) {
      needsImei = false;
    } else if (sName.includes('chatgpt') || sName.includes('netflix') || sName.includes('spotify') || sName.includes('magis') || sName.includes('cuenta') || sName.includes('acta')) {
      needsImei = false;
    }
    
    // Store needsImei in a data attribute so we can use it during submit.
    // We will update this further down if we detect account-related custom fields.

    let hasCurpf = false;
    let hasCurpm = false;

    let requiresCustom = raw && (raw['Requires.Custom'] || raw.requires_custom || raw['REQUIRES.CUSTOM']);
    
    if (requiresCustom && Array.isArray(requiresCustom) && requiresCustom.length > 0) {
      requiresCustom.forEach(field => {
        const fieldNameRaw = field.fieldname || field.description || '';
        const fName = fieldNameRaw.toLowerCase();
        
        // If it asks for an email, user, or password, it's an account service, not a phone unlock
        if (fName.includes('email') || fName.includes('correo') || fName.includes('usuario') || fName.includes('password') || fName.includes('contraseña')) {
          needsImei = false;
        }
        
        if (fName.includes('curpf')) hasCurpf = true;
        if (fName.includes('curpm')) hasCurpm = true;
        
        const inputGroup = document.createElement('div');
        inputGroup.className = 'input-group';
        
        const label = document.createElement('label');
        label.textContent = `${fieldNameRaw || 'Campo adicional'}${field.required ? ' *' : ''}`;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'input-wrapper';
        
        const icon = document.createElement('i');
        
        let input;
        let optionsRaw = field.options || field.dropdown_options || field.fieldoptions || field.allowed_values || '';
        if (field.type === 'dropdown' || field.type === 'select' || optionsRaw) {
          icon.setAttribute('data-lucide', 'list');
          input = document.createElement('select');
          input.className = 'custom-field-input';
          input.setAttribute('data-fieldname', field.fieldname || 'custom');
          if (field.required) input.required = true;
          
          const defaultOpt = document.createElement('option');
          defaultOpt.value = '';
          defaultOpt.textContent = 'SELECCIONE';
          input.appendChild(defaultOpt);
          
          let options = optionsRaw;
          if (typeof options === 'string') {
             options = options.split(',').map(o => o.trim());
          }
          if (Array.isArray(options)) {
             options.forEach(opt => {
               const option = document.createElement('option');
               option.value = opt;
               option.textContent = opt;
               input.appendChild(option);
             });
          }
        } else {
          icon.setAttribute('data-lucide', 'plus-circle');
          input = document.createElement('input');
          input.type = 'text';
          input.className = 'custom-field-input';
          input.setAttribute('data-fieldname', field.fieldname || 'custom');
          input.placeholder = field.description || field.fieldname || '';
          if (field.required) input.required = true;
        }

        wrapper.appendChild(icon);
        wrapper.appendChild(input);
        inputGroup.appendChild(label);
        inputGroup.appendChild(wrapper);
        
        customFieldsContainer.appendChild(inputGroup);
      });
    }

    // Check if any custom fields were rendered
    const hasCustomFields = customFieldsContainer.children.length > 0;
    
    // OVERRIDE: If the API explicitly names the IMEI field (e.g. "NUMERO"), we MUST show it.
    const hasCustomImeiName = raw && (raw.IMEINAME || raw.CUSTOM_IMEI);

    if (!hasCustomImeiName && (!needsImei || (raw && (raw.requires_imei === false || raw.requires_imei === '0' || raw['Requires.Imei'] === false || raw['Requires.Imei'] === '0' || raw['Requires.IMEI'] === '0')))) {
      if (hasCustomFields) {
        // If it doesn't need an IMEI AND we already have custom fields, hide the IMEI input entirely
        imeiInputGroup.classList.add('hidden');
        imeiInput.removeAttribute('required');
        imeiInput.removeAttribute('minlength');
        imeiInput.removeAttribute('maxlength');
        imeiAutoGenerate.checked = true; // Auto-generate dummy IMEI in the background
      } else {
        // Doesn't need an IMEI but NO custom fields either. Repurpose the field.
        imeiInputGroup.classList.remove('hidden');
        
        const sNameLower = sName.toLowerCase();
        const gNameLower = gName.toLowerCase();
      
      if (sNameLower.includes('recarga') || gNameLower.includes('recarga') || sNameLower.includes('saldo') || sNameLower.includes('topup') || sNameLower.includes('pines')) {
        imeiLabel.textContent = 'Ingresa el Número Telefónico / Referencia';
        imeiInput.placeholder = 'Número a recargar o Referencia';
      } else if (sNameLower.includes('acta') || sNameLower.includes('curp') || sNameLower.includes('documento') || sNameLower.includes('rfc') || sNameLower.includes('constancia') || gNameLower.includes('tramite')) {
        if (hasCurpf && !hasCurpm) {
          imeiLabel.textContent = 'CURPM *';
          imeiInput.placeholder = 'Ingresa el CURPM';
        } else if (hasCurpm && !hasCurpf) {
          imeiLabel.textContent = 'CURPF *';
          imeiInput.placeholder = 'Ingresa el CURPF';
        } else {
          imeiLabel.textContent = 'Ingresa el CURP o Dato Principal';
          imeiInput.placeholder = 'Ej. CURP, RFC, etc.';
        }
      } else if (sNameLower.includes('cuenta') || sNameLower.includes('netflix') || sNameLower.includes('magis') || sNameLower.includes('spotify') || sNameLower.includes('chatgpt') || sNameLower.includes('streaming') || sNameLower.includes('pantalla') || gNameLower.includes('vpn')) {
        imeiLabel.textContent = 'Correo / Usuario / Link a activar';
        imeiInput.placeholder = 'Ingresa el correo, link o usuario';
      } else if (gNameLower.includes('redes sociales') || gNameLower.includes('follower')) {
        imeiLabel.textContent = 'Link del Perfil / Publicación';
        imeiInput.placeholder = 'https://instagram.com/...';
      } else if (gNameLower.includes('esim') || gNameLower.includes('sim') || gNameLower.includes('plan')) {
        imeiLabel.textContent = 'Correo Electrónico (Para recibir QR)';
        imeiInput.placeholder = 'ejemplo@correo.com';
      } else if (gNameLower.includes('limpieza') || gNameLower.includes('blacklist') || gNameLower.includes('clean')) {
        imeiLabel.textContent = 'IMEI a Limpiar / Procesar (15 dígitos)';
        imeiInput.placeholder = 'Ingresa el IMEI a procesar';
        imeiInput.setAttribute('minlength', '15');
        imeiInput.setAttribute('maxlength', '15');
      } else if (gNameLower.includes('check') || gNameLower.includes('finder') || gNameLower.includes('info')) {
        imeiLabel.textContent = 'IMEI o Serial a Consultar';
        imeiInput.placeholder = 'Ingresa el IMEI o SN';
      } else if (sNameLower.includes('server') || sNameLower.includes('software') || sNameLower.includes('licencia') || sNameLower.includes('box') || sNameLower.includes('dongle') || sNameLower.includes('tool') || sNameLower.includes('credito') || sNameLower.includes('credit')) {
        imeiLabel.textContent = 'Usuario / Correo / Serial (SN)';
        imeiInput.placeholder = 'Ingresa el dato requerido de la herramienta';
      } else {
        imeiLabel.textContent = 'Dato Principal / Referencia del Pedido';
        imeiInput.placeholder = 'Ingresa el identificador principal';
      }

      imeiInput.removeAttribute('minlength');
      imeiInput.removeAttribute('maxlength');
      imeiAutoGenerate.checked = false; 
      } // CLOSE INNER ELSE
    } else {
      imeiInputGroup.classList.remove('hidden');
      imeiLabel.textContent = 'IMEI o Número de Serie';
      imeiInput.placeholder = 'Ingresa el IMEI o Serial';
      imeiInput.removeAttribute('minlength');
      imeiInput.removeAttribute('maxlength');
      imeiAutoGenerate.checked = false;
    }
    
    // OVERRIDE: Always respect the custom IMEI name provided by the DHRU API if present
    if (raw && (raw.IMEINAME || raw.CUSTOM_IMEI)) {
      const customName = raw.IMEINAME || raw.CUSTOM_IMEI;
      imeiLabel.textContent = customName + ' *';
      imeiInput.placeholder = 'Ingresa ' + customName;
    } else if (raw && raw.CUSTOM && raw.CUSTOM.customname) {
      const customName = raw.CUSTOM.customname;
      imeiLabel.textContent = customName + ' *';
      imeiInput.placeholder = 'Ingresa ' + customName;
    }
    
    // Apply Advanced validations if any
    imeiInput.removeAttribute('pattern'); // reset
    if (raw && raw.CUSTOM) {
      if (raw.CUSTOM.customlen) imeiInput.setAttribute('minlength', raw.CUSTOM.customlen);
      if (raw.CUSTOM.maxlength) imeiInput.setAttribute('maxlength', raw.CUSTOM.maxlength);
      if (raw.CUSTOM.regex) imeiInput.setAttribute('pattern', raw.CUSTOM.regex);
    }
    
    imeiAutoGenerate.dispatchEvent(new Event('change'));

    purchaseModal.classList.remove('hidden');
    lucide.createIcons();
  }

  function closePurchaseModal() {
    purchaseModal.classList.add('hidden');
    selectedProductForOrder = null;
  }

  btnCloseModal.addEventListener('click', closePurchaseModal);
  btnCancelOrder.addEventListener('click', closePurchaseModal);

  purchaseModal.addEventListener('click', (e) => {
    if (e.target === purchaseModal) {
      closePurchaseModal();
    }
  });

  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedProductForOrder) return;

    const username = localStorage.getItem('dhru_username');
    const serviceid = selectedProductForOrder.serviceid;
    const serviceName = selectedProductForOrder.service;
    const serviceType = selectedProductForOrder.serviceType || 'IMEI'; // Extract service type
    const costInCredits = selectedProductForOrder.credit;
    const timestamp = new Date().toLocaleString('es-MX');

    // The user either typed an IMEI or checked the box to auto-generate
    const needsImei = !imeiAutoGenerate.checked;
    let imei = '';
    let imeiDataString = '';
    
    // If the whole group is hidden (meaning requires_imei was explicitly 0), or if the box is checked
    if (needsImei && !imeiInputGroup.classList.contains('hidden')) {
      imei = imeiInput.value.trim();
      
      // If the field explicitly requested 15 digits (e.g. clean/blacklist), strictly enforce it.
      // Otherwise, just enforce it's not empty, allowing 4-digit PINs or SNs.
      if (imeiLabel.textContent.includes('(15 dígitos)')) {
        if (!/^[A-Za-z0-9]{15}$/.test(imei)) {
          alert('El IMEI debe tener exactamente 15 caracteres.');
          return;
        }
      } else if (!imei) {
        alert('Debes ingresar los datos solicitados.');
        return;
      }
      imeiDataString = imei;
    } else {
      // Generate a unique 15-digit dummy IMEI: Date.now() (13 digits) + 2 random digits
      const randomSuffix = Math.floor(Math.random() * 90 + 10).toString();
      imei = Date.now().toString() + randomSuffix;
      imeiDataString = 'N/A';
    }

    if (!authToken) {
      alert('Faltan sesión del portal. Inicia sesión nuevamente.');
      return;
    }

    const custom_fields = {};
    document.querySelectorAll('.custom-field-input').forEach(input => {
      const name = input.getAttribute('data-fieldname');
      if (name) {
        custom_fields[name] = input.value.trim();
      }
    });

    const btnConfirm = document.getElementById('btnConfirmOrder');
    const originalText = btnConfirm.querySelector('span').textContent;
    btnConfirm.setAttribute('disabled', 'true');
    btnConfirm.querySelector('span').textContent = 'Procesando...';

    const customKeys = Object.keys(custom_fields);
    if (customKeys.length > 0) {
      imeiDataString += ' (';
      customKeys.forEach((key, index) => {
        imeiDataString += `${key}: ${custom_fields[key]}${index < customKeys.length - 1 ? ', ' : ''}`;
      });
      imeiDataString += ')';
    }

    const orderNotesInput = document.getElementById('orderNotes');
    const notes = orderNotesInput ? orderNotesInput.value.trim() : '';
    
    const quantityInputDom = document.getElementById('quantityInput');
    const qnt = (quantityInputDom && !document.getElementById('quantityInputGroup').classList.contains('hidden')) 
                ? (parseInt(quantityInputDom.value) || 1) : 1;

    const orderPayload = {
      serviceid,
      imei,
      custom_fields,
      serviceType,
      serviceName,
      notes,
      qnt
    };

    try {
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: { 'X-Server-Id': currentServerId,
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(orderPayload)
      });

      let data = await response.json();

      if (!response.ok) {
        if (data.error === 'ADMIN_INSUFFICIENT_BALANCE') {
          if (confirm('No tienes saldo disponible en tu Bolsa personal de Ganancias Admin para esta compra.\n\n¿Deseas descontarlo de todos modos y usar fondos globales?')) {
            orderPayload.bypassAdminBalance = true;
            // Retry fetch
            const retryResponse = await fetch('/api/order', {
              method: 'POST',
              headers: { 'X-Server-Id': currentServerId,
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify(orderPayload)
            });
            const retryData = await retryResponse.json();
            if (!retryResponse.ok) {
              throw new Error(retryData.error || 'Error al conectar con el servidor en reintento.');
            }
            data = retryData; // Update data with success response
          } else {
            return; // User cancelled
          }
        } else {
          logApiCall('placeimeiorder', orderPayload, data, false);
          throw new Error(data.error || 'Error al conectar con el servidor.');
        }
      }

      if (data.ERROR) {
        logApiCall('placeorder', orderPayload, data, false);
        let errMsg = 'Error desconocido de Dhru';
        if (Array.isArray(data.ERROR) && data.ERROR.length > 0) {
          errMsg = typeof data.ERROR[0] === 'object' ? (data.ERROR[0].MESSAGE || JSON.stringify(data.ERROR[0])) : data.ERROR[0];
        } else if (typeof data.ERROR === 'object') {
          errMsg = data.ERROR.MESSAGE || data.ERROR.message || JSON.stringify(data.ERROR);
        } else if (typeof data.ERROR === 'string') {
          errMsg = data.ERROR;
        }
        throw new Error(`Dhru Error: ${errMsg}`);
      }

      logApiCall('placeimeiorder', orderPayload, data, true);

      let orderId = '';
      let msg = '';
      
      if (data.SUCCESS && Array.isArray(data.SUCCESS) && data.SUCCESS.length > 0) {
        const successItem = data.SUCCESS[0];
        orderId = successItem.REFERENCEID || successItem.referenceid || successItem.ORDERID || successItem.orderid || successItem.ID || successItem.id || '';
        msg = successItem.MESSAGE || successItem.message || 'Exitoso';
      } else if ((data.SUCCESS === true || data.SUCCESS === 'true') && data.RESULT) {
        const resObj = data.RESULT;
        orderId = resObj.REFERENCEID || resObj.referenceid || resObj.ORDERID || resObj.orderid || resObj.ID || resObj.id || '';
        msg = resObj.MESSAGE || resObj.message || 'Exitoso';
      } else {
        orderId = data.REFERENCEID || data.referenceid || data.ORDERID || data.orderid || data.ID || data.id || '';
        msg = data.MESSAGE || data.message || 'Exitoso';
      }

      // Add success log to history (Waiting state initially)
      addOrderToHistory({
        timestamp,
        updateTimestamp: new Date().toLocaleString('es-MX'),
        serviceId: serviceid,
        serviceName,
        imei: imeiDataString,
        costInCredits,
        orderId,
        status: 'pending', // Set to pending wait state so it gets checked on Sync!
        statusText: msg,
        ip: data.clientIp || '127.0.0.1',
        serviceType
      });

      alert(`¡Pedido Exitoso!\n\nID de Orden: ${orderId}\nMensaje: ${msg}`);
      closePurchaseModal();
      
      // Navigate to history tab automatically
      tabHistory.click();
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Auto-trigger order status query after 1.5 seconds to pull codes instantly if completed
      setTimeout(() => {
        btnSyncHistory.click();
      }, 1500);

    } catch (err) {
      console.error(err);
      
      // Add error log to history
      addOrderToHistory({
        timestamp,
        updateTimestamp: new Date().toLocaleString('es-MX'),
        serviceId: serviceid,
        serviceName,
        imei: imeiDataString,
        costInCredits,
        orderId: 'Error',
        status: 'failed',
        statusText: err.message,
        ip: '127.0.0.1',
        serviceType
      });

      alert(`Error al realizar pedido:\n${err.message}`);
    } finally {
      btnConfirm.removeAttribute('disabled');
      btnConfirm.querySelector('span').textContent = originalText;
    }
  });

  // -------------------------------------------------------------
  // Ticket Generator Modal & Html2Canvas Logic
  // -------------------------------------------------------------
  
  const closeTicketModal = () => {
    ticketModal.classList.add('hidden');
    ticketClientPrice.value = '';
    currentTicketData = null;
    
    // Hide preview on close
    const ticketPreviewContainer = document.getElementById('ticketPreviewContainer');
    if (ticketPreviewContainer) {
      ticketPreviewContainer.classList.add('hidden');
    }
  };

  btnTicketClose.addEventListener('click', closeTicketModal);
  btnCancelTicket.addEventListener('click', closeTicketModal);

  btnGenerateTicketFinal.addEventListener('click', async () => {
    if (!currentTicketData) return;
    
    // Set UI State to loading
    const originalBtnHTML = btnGenerateTicketFinal.innerHTML;
    btnGenerateTicketFinal.innerHTML = '<i data-lucide="loader" class="lucide-spin"></i><span>Generando...</span>';
    lucide.createIcons();
    btnGenerateTicketFinal.setAttribute('disabled', 'true');

    try {
      // Populate Template
      const title = String(currentTicketData.serviceName || 'UNLOCK TOOL').split('[')[0].trim();
      ticketTitle.textContent = title;

      const orderIdNode = document.getElementById('ticketOrderId');
      if (orderIdNode) {
        orderIdNode.textContent = `ID: #${currentTicketData.orderId || 'N/A'}`;
      }

      const price = ticketClientPrice.value.trim();
      if (price && !isNaN(price)) {
        ticketPriceVal.textContent = parseFloat(price).toLocaleString('es-MX', { minimumFractionDigits: 2 });
        ticketPricePill.classList.remove('hidden');
      } else {
        ticketPricePill.classList.add('hidden');
      }

      // Format Type logic
      const formatType = ticketFormatType.value;
      let rawText = String(currentTicketData.statusText || '');
      
      let cleanedRawText = rawText.replace(/<br\s*\/?>/gi, '\n')
                                  .replace(/<\/div>/gi, '\n')
                                  .replace(/<[^>]*>?/gm, '')
                                  .replace(/\n\s*\n/g, '\n')
                                  .trim();

      ticketRawTextVal.textContent = cleanedRawText;
      const ticketStreamingBox = document.getElementById('ticketStreamingBox');

      if (formatType === 'raw') {
        ticketParsedBox.classList.add('hidden');
        if (ticketStreamingBox) ticketStreamingBox.classList.add('hidden');
        ticketRawBox.classList.remove('hidden');
      } else if (formatType === 'streaming') {
        ticketParsedBox.classList.add('hidden');
        ticketRawBox.classList.add('hidden');
        if (ticketStreamingBox) {
          ticketStreamingBox.classList.remove('hidden');
          const container = document.getElementById('streamingFieldsContainer');
          container.innerHTML = '';
          const lines = cleanedRawText.split('\n').map(l => l.trim()).filter(l => l);
          let html = '';
          
          // Heuristic: Does it look like a streaming response with title?
          // It usually has 'Usuario' and 'Contraseña' as standalone lines.
          const hasUsuario = lines.some(l => l.toLowerCase() === 'usuario' || l.toLowerCase() === 'email' || l.toLowerCase() === 'correo');
          const hasContra = lines.some(l => l.toLowerCase() === 'contraseña' || l.toLowerCase() === 'password' || l.toLowerCase() === 'pass' || l.toLowerCase() === 'pin');
          
          if (hasUsuario && hasContra) {
            let i = 0;
            // 1. Title (anything before 'usuario')
            let titleLines = [];
            while(i < lines.length && !['usuario', 'email', 'correo', 'contraseña', 'password', 'pass', 'pin'].includes(lines[i].toLowerCase())) {
              titleLines.push(lines[i]);
              i++;
            }
            if (titleLines.length > 0) {
              html += `<div style="text-align: center; color: var(--accent); font-weight: bold; margin-bottom: 0.5rem; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 0.5rem;">${escapeHtml(titleLines.join(' '))}</div>`;
            }
            
            // 2. Extract pairs
            while(i < lines.length) {
              const currentLine = lines[i];
              const lower = currentLine.toLowerCase();
              
              if (['usuario', 'email', 'correo', 'contraseña', 'password', 'pass', 'pin', 'perfil'].includes(lower)) {
                const key = currentLine;
                const val = lines[i+1] || '';
                html += `
                  <div class="ticket-field">
                    <span class="ticket-label">${escapeHtml(key)}:</span>
                    <span class="ticket-value" style="overflow-wrap: break-word; word-break: normal; white-space: normal;">${escapeHtml(val)}</span>
                  </div>
                `;
                i += 2;
              } else {
                // If it's something else, it's a note or footer
                const remaining = lines.slice(i).join('\n');
                html += `
                  <div style="margin-top: 0.5rem; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 0.5rem; display: flex; flex-direction: column; gap: 4px;">
                    <span class="ticket-label" style="width: 100%; text-align: left;">Nota:</span>
                    <span class="ticket-value" style="width: 100%; text-align: left; white-space: pre-wrap; overflow-wrap: break-word; word-break: normal; font-size: 0.85rem; color: #10b981;">${escapeHtml(remaining)}</span>
                  </div>
                `;
                break;
              }
            }
          } else {
            // Fallback generic parsing
            for(let i=0; i<lines.length; i+=2) {
              const key = lines[i];
              let val = lines[i+1] || '';
              const lowerKey = key.toLowerCase();
              
              if (lowerKey.includes('condicion') || lowerKey.includes('nota') || lowerKey.includes('regla') || !val) {
                 val = lines.slice(i+1).join('\n');
                 html += `
                   <div style="margin-top: 0.5rem; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 0.5rem; display: flex; flex-direction: column; gap: 4px;">
                     <span class="ticket-label" style="width: 100%; text-align: left;">${escapeHtml(key)}:</span>
                     <span class="ticket-value" style="width: 100%; text-align: left; white-space: pre-wrap; overflow-wrap: break-word; word-break: normal; font-size: 0.85rem;">${escapeHtml(val)}</span>
                   </div>
                 `;
                 break;
              } else if (val.length < 40 && key.length < 40) {
                html += `
                  <div class="ticket-field">
                    <span class="ticket-label">${escapeHtml(key)}:</span>
                    <span class="ticket-value" style="overflow-wrap: break-word; word-break: normal; white-space: normal;">${escapeHtml(val)}</span>
                  </div>
                `;
              } else {
                html += `
                  <div style="margin-top: 0.5rem; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 0.5rem; display: flex; flex-direction: column; gap: 4px;">
                    <span class="ticket-label" style="width: 100%; text-align: left;">${escapeHtml(key)}:</span>
                    <span class="ticket-value" style="width: 100%; text-align: left; white-space: pre-wrap; overflow-wrap: break-word; word-break: normal; font-size: 0.85rem;">${escapeHtml(val)}</span>
                  </div>
                `;
              }
            }
          }
          container.innerHTML = html;
        }
      } else {
        ticketParsedBox.classList.remove('hidden');
        if (ticketStreamingBox) ticketStreamingBox.classList.add('hidden');
        
        // Show raw box if it actually contains text
        if (ticketRawTextVal.textContent.trim()) {
           ticketRawBox.classList.remove('hidden');
        } else {
           ticketRawBox.classList.add('hidden');
        }
        // Parse Credentials
        const creds = parseCredentials(currentTicketData.statusText);
        ticketUserVal.textContent = creds.user;
        ticketPassVal.textContent = creds.pass;
      }

      // Bring template to view momentarily
      ticketTemplateContainer.style.opacity = '1';

      // Copy to Clipboard (Modern approach with Promise to preserve user gesture)
      try {
        const makeImagePromise = async () => {
          // Brutal optimization: Using html-to-image (modern) instead of html2canvas or dom-to-image.
          // This avoids Firefox layout freezes, respects web fonts, and renders instantly using SVG foreignObject.
          const blob = await htmlToImage.toBlob(ticketTemplate, {
            backgroundColor: '#111116',
            pixelRatio: 2, // Retina quality: text and logos will be ultra-crisp!
            skipFonts: true,
            style: {
              transform: 'scale(1)',
              transformOrigin: 'top left'
            }
          });
          
          ticketTemplateContainer.style.opacity = '0';
          
          // Show Preview immediately
          const ticketPreviewContainer = document.getElementById('ticketPreviewContainer');
          const ticketPreviewImg = document.getElementById('ticketPreviewImg');
          if (ticketPreviewContainer && ticketPreviewImg) {
            ticketPreviewImg.src = URL.createObjectURL(blob);
            ticketPreviewContainer.classList.remove('hidden');
          }
          
          return blob;
        };
        
        // This tells the browser: "We are putting a promise in the clipboard right now due to a user click"
        const clipboardItem = new ClipboardItem({ 'image/png': makeImagePromise() });
        await navigator.clipboard.write([clipboardItem]);
        
        btnGenerateTicketFinal.innerHTML = '<i data-lucide="check"></i><span>¡Copiado!</span>';
        lucide.createIcons();
        
        setTimeout(() => {
           btnGenerateTicketFinal.removeAttribute('disabled');
           btnGenerateTicketFinal.innerHTML = originalBtnHTML;
           lucide.createIcons();
        }, 3000);
        
      } catch (clipboardErr) {
        console.error('Clipboard copy failed:', clipboardErr);
        // Sometimes the clipboard error is just "NotAllowedError" or "Document is not focused"
        // Let's fallback to showing the preview and a smaller alert
        alert('Tu navegador requiere permiso manual. Haz clic derecho en la imagen de abajo y selecciona "Copiar imagen".');
        
        btnGenerateTicketFinal.removeAttribute('disabled');
        btnGenerateTicketFinal.innerHTML = originalBtnHTML;
        lucide.createIcons();
      }
    } catch (err) {
      console.error('Error rendering ticket:', err);
      alert('Hubo un error al generar la imagen. Revisa la consola.');
      btnGenerateTicketFinal.removeAttribute('disabled');
      btnGenerateTicketFinal.innerHTML = originalBtnHTML;
      lucide.createIcons();
    }
  });

  // --- ADMIN USERS MODAL LOGIC ---
  const btnCreateUserFormToggle = document.getElementById('btnCreateUserFormToggle');
  const createUserFormContainer = document.getElementById('createUserFormContainer');
  const createUserForm = document.getElementById('createUserForm');
  const btnCancelCreateUser = document.getElementById('btnCancelCreateUser');
  const usersTableBody = document.getElementById('usersTableBody');
  const adminProfitDisplay = document.getElementById('adminProfitDisplay');
  const adminSettingsForm = document.getElementById('adminSettingsForm');
  const btnDownloadBackup = document.getElementById('btnDownloadBackup');
  const btnUploadBackup = document.getElementById('btnUploadBackup');
  const fileRestoreBackup = document.getElementById('fileRestoreBackup');
  const inputResellerMarkup = document.getElementById('inputResellerMarkup');
  const inputClientMarkup = document.getElementById('inputClientMarkup');

  // Recharge server info card dynamic update
  const rechargeServerSelect = document.getElementById('rechargeServer');
  const rechargeServerInfo = document.getElementById('rechargeServerInfo');
  const serverInfoMap = {
    '1': { emoji: '⚡', name: 'MEGA-SERVER', desc: 'Servicios de desbloqueo IMEI internacionales', color: '#60a5fa', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)' },
    '3': { emoji: '🔱', name: 'OMEGA-SERVER', desc: 'Servicios de desbloqueo nacionales y cuentas', color: '#facc15', bg: 'rgba(250,204,21,0.1)', border: 'rgba(250,204,21,0.3)' }
  };
  function updateRechargeServerInfo() {
    const val = rechargeServerSelect.value;
    const info = serverInfoMap[val] || serverInfoMap['1'];
    rechargeServerInfo.style.background = info.bg;
    rechargeServerInfo.style.borderColor = info.border;
    rechargeServerInfo.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 2rem;">${info.emoji}</span>
        <div>
          <strong style="color: ${info.color}; font-size: 1.1rem;">${info.name}</strong>
          <p style="color: #94a3b8; font-size: 0.8rem; margin: 2px 0 0;">${info.desc}</p>
        </div>
      </div>
    `;
  }
  rechargeServerSelect.addEventListener('change', updateRechargeServerInfo);

  if (btnWhatsappBot) {
    btnWhatsappBot.addEventListener('click', () => {
      whatsappBotModal.classList.remove('hidden');
    });
    btnCloseWhatsappBotModal.addEventListener('click', () => {
      whatsappBotModal.classList.add('hidden');
    });
    whatsappBotModal.addEventListener('click', (e) => {
      if (e.target === whatsappBotModal) {
        whatsappBotModal.classList.add('hidden');
      }
    });
  }

  btnRechargeBalance.addEventListener('click', () => {
    console.log('✅ BOTÓN SALDO CLICKEADO');
    rechargeStep1.classList.remove('hidden');
    rechargeStep2.classList.add('hidden');
    rechargeAmount.value = '';
    rechargeTracking.value = '';
    currentRechargeData = null;
    modalRecharge.classList.remove('hidden');
    updateRechargeServerInfo();
  });

  closeRechargeModal.addEventListener('click', () => {
    modalRecharge.classList.add('hidden');
  });

  btnRechargeBack.addEventListener('click', () => {
    modalRecharge.classList.add('hidden');
  });

  btnGenerarCuenta.addEventListener('click', async () => {
    const amount = parseFloat(rechargeAmount.value);
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, ingresa un monto válido.');
      return;
    }
    const bankCode = rechargeBank.value;
    const serverId = document.getElementById('rechargeServer').value;
    
    const btnOriginalText = btnGenerarCuenta.innerHTML;
    btnGenerarCuenta.innerHTML = '<div class="loading-spinner"></div>';
    btnGenerarCuenta.disabled = true;

    try {
      const response = await fetch('/api/fund/route', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + authToken
        },
        body: JSON.stringify({ amount, bankCode, serverId })
      });
      const data = await response.json();
      
      if (response.ok && data.accounts) {
        currentRechargeData = data;
        // Default to the first account, but let user change it by clicking the cards
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
          
          // Helper para botones de copiar
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
          
          // Lógica de Cambiar Cuenta
          const btnChange = card.querySelector('.btn-change-account');
          btnChange.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Restablecer estilos de esta tarjeta
            card.style.flex = '1 1 calc(50% - 10px)';
            card.style.transform = 'scale(1)';
            card.style.background = 'rgba(0,0,0,0.3)';
            card.querySelector('.card-bank-name').style.fontSize = '1.1rem';
            card.querySelector('.card-owner-name').style.fontSize = '1rem';
            card.querySelector('.card-clabe').style.fontSize = '1.2rem';
            
            // Mostrar todas las tarjetas
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
            
            // Ocultar las demás tarjetas
            Array.from(container.children).forEach(c => {
              if (c !== card) {
                c.style.display = 'none';
              }
            });
            
            // Agrandar y resaltar la tarjeta seleccionada
            card.style.flex = '1 1 100%'; // Ocupar todo el ancho
            card.style.transform = 'scale(1.02)'; // Hacerla un poquito más grande
            card.style.borderColor = '#10b981';
            card.style.background = 'rgba(16, 185, 129, 0.05)';
            
            card.querySelector('.card-bank-name').style.color = '#10b981';
            card.querySelector('.card-bank-name').style.fontSize = '1.3rem';
            card.querySelector('.card-owner-name').style.fontSize = '1.1rem';
            card.querySelector('.card-clabe').style.fontSize = '1.5rem'; // CLABE mucho más grande
            
            card.querySelector('.selection-indicator').style.display = 'none';
            
            const actions = card.querySelector('.selected-actions');
            actions.classList.remove('hidden');
            actions.style.display = 'flex';
            
            if (window.lucide) window.lucide.createIcons({ root: card });
          });
          
          container.appendChild(card);
        });
        
        // Comentado para obligar al usuario a elegir manualmente
        // if (container.firstElementChild) {
        //   container.firstElementChild.click();
        // }
        
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
    const bankCode = rechargeBank.value;
    const serverId = document.getElementById('rechargeServer').value;
    
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
          'Authorization': 'Bearer ' + authToken
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
        modalRecharge.style.display = 'none';
        fetchUserData(); // Actualizar saldo visualmente
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

  if (btnAdminManage) {
    btnAdminManage.addEventListener('click', () => {
      if (tabAdmin) tabAdmin.click();
    });
  }

  btnCreateUserFormToggle.addEventListener('click', () => {
    createUserFormContainer.classList.toggle('hidden');
  });

  btnCancelCreateUser.addEventListener('click', () => {
    createUserFormContainer.classList.add('hidden');
    createUserForm.reset();
  });

  async function loadAdminData() {
    try {
      const statsRes = await fetch('/api/admin/stats', { headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` }});
      if (statsRes.ok) {
        const stats = await statsRes.json();
        adminProfitDisplay.textContent = `$${parseFloat(stats.profitBalance || 0).toFixed(2)} MXN`;
      }

      const settingsRes = await fetch('/api/admin/settings', { headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` }});
      if (settingsRes.ok) {
        const set = await settingsRes.json();
        const currentSet = currentServerId === '3' ? set.server3 : (currentServerId === '2' ? set.server2 : set.server1);
        if (currentSet) {
          inputResellerMarkup.value = parseFloat(currentSet.resellerMarkup || 0).toFixed(2);
          inputClientMarkup.value = parseFloat(currentSet.clientMarkup || 0).toFixed(2);
        }
        const inputExchangeRate = document.getElementById('inputExchangeRate');
        if (inputExchangeRate) {
          inputExchangeRate.value = parseFloat(set.exchangeRate || 17.60).toFixed(2);
        }
      }
      
      const lbl = document.getElementById('settingsCurrentServerLabel');
      if (lbl) {
        const sNames = {'1': '⚡ MEGA-SERVER', '2': '🛡 ALPHA-SERVER', '3': '🔱 OMEGA-SERVER'};
        lbl.textContent = sNames[currentServerId] || 'MEGA-SERVER';
      }

      // Load Auto-Backups
      const autobackupList = document.getElementById('autobackupList');
      if (autobackupList) {
        try {
          const autoRes = await fetch('/api/admin/autobackups', { headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` }});
          if (autoRes.ok) {
            const backups = await autoRes.json();
            autobackupList.innerHTML = '';
            if (backups.length === 0) {
              autobackupList.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-secondary);">No hay respaldos automáticos aún. Haz un movimiento de dinero para generar uno.</p>';
            } else {
              backups.forEach(b => {
                const parts = b.filename.replace('autobackup_', '').replace('.json', '').split('_');
                const timestamp = parts[0]; 
                const reason = parts.slice(1).join(' ').replace(/_/g, ' ');
                const kb = (b.size / 1024).toFixed(1);
                const localDate = new Date(b.date).toLocaleString('es-MX');

                const div = document.createElement('div');
                div.style.display = 'flex';
                div.style.justifyContent = 'space-between';
                div.style.alignItems = 'center';
                div.style.padding = '8px 12px';
                div.style.background = 'rgba(59, 130, 246, 0.1)';
                div.style.borderRadius = '6px';
                div.style.border = '1px solid rgba(59, 130, 246, 0.2)';

                div.innerHTML = `
                  <div style="display: flex; flex-direction: column; gap: 2px;">
                    <strong style="color: #bfdbfe; font-size: 0.9rem;">${reason || 'Respaldo Automático'}</strong>
                    <span style="color: var(--text-secondary); font-size: 0.75rem;">${localDate} &bull; ${kb} KB</span>
                  </div>
                  <button type="button" class="btn btn-sm btn-download-autobackup" data-file="${b.filename}" style="background: rgba(59, 130, 246, 0.2); border-color: rgba(59, 130, 246, 0.4); color: #60a5fa; white-space: nowrap;">
                    <i data-lucide="download" style="width: 14px; height: 14px;"></i> Descargar
                  </button>
                `;
                autobackupList.appendChild(div);
              });

              // Add event listeners
              document.querySelectorAll('.btn-download-autobackup').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                  const filename = e.currentTarget.getAttribute('data-file');
                  try {
                    const dlRes = await fetch(`/api/admin/autobackups/${filename}`, { headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` }});
                    if (!dlRes.ok) throw new Error('Failed');
                    const blob = await dlRes.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    a.remove();
                  } catch(err) {
                    alert('Error al descargar el respaldo.');
                  }
                });
              });
            }
            lucide.createIcons();
          }
        } catch(e) {
          console.error(e);
          autobackupList.innerHTML = '<p style="color: #f87171; font-size: 0.85rem;">Error al cargar respaldos.</p>';
        }
      }

      const usersRes = await fetch('/api/users', { headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` }});
      if (usersRes.ok) {
        const users = await usersRes.json();
        usersTableBody.innerHTML = '';
        
        // Populate Master History User Filter while we have the users
        const masterUserFilter = document.getElementById('masterHistoryUserFilter');
        if (masterUserFilter) {
           masterUserFilter.innerHTML = '<option value="all">Todos los Usuarios</option>';
           users.forEach(u => {
             masterUserFilter.innerHTML += `<option value="${u.id}">${escapeHtml(u.username)}</option>`;
           });
        }

        users.forEach(u => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${u.id}</td>
            <td>
               <div style="display:flex; flex-direction:column; gap:4px;">
                 <strong>${escapeHtml(u.username)}</strong>
                 ${u.role === 'admin' ? `<span class="status-badge badge-category-server" style="width:fit-content; font-size:0.7rem; padding: 2px 6px;">ADMIN</span>` : 
                   `<select class="role-select" data-id="${u.id}" style="width: fit-content; padding: 2px 6px; font-size: 0.7rem; background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); color: #c4b5fd; border-radius: 4px; outline: none; cursor: pointer;">
                      <option value="reseller" ${u.role === 'reseller' || !u.role ? 'selected' : ''}>RESELLER</option>
                      <option value="colaborador" ${u.role === 'colaborador' ? 'selected' : ''}>COLABORADOR</option>
                    </select>`
                 }
                 <div style="display: flex; align-items: center; gap: 4px;">
                   <input type="password" class="user-password-field" value="${escapeHtml(u.password || '')}" readonly style="width: 60px; padding: 2px; font-size:0.75rem; border-radius: 4px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); color: white;">
                   ${u.role !== 'admin' ? `
                     <button type="button" class="btn-icon btn-toggle-pwd" title="Mostrar/Ocultar" style="width: 20px; height: 20px; min-width: 20px; display: flex; align-items: center; justify-content: center;"><i data-lucide="eye" style="width: 12px; height: 12px;"></i></button>
                     <button type="button" class="btn-icon btn-edit-pwd" data-id="${u.id}" title="Cambiar Contraseña" style="width: 20px; height: 20px; min-width: 20px; display: flex; align-items: center; justify-content: center;"><i data-lucide="key" style="width: 12px; height: 12px; color: #facc15;"></i></button>
                   ` : ''}
                 </div>
               </div>
            </td>
            <td>
              ${u.role !== 'admin' ? `
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span style="color:var(--text-secondary);">$</span>
                  <input type="number" step="0.1" class="user-markup-input" data-id="${u.id}" value="${u.markup !== null && u.markup !== undefined ? u.markup : ''}" placeholder="Global" style="width: 70px; padding: 4px; border-radius: 4px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); color: white;">
                </div>
              ` : '-'}
            </td>
            <td>
               <div style="display:flex; flex-direction:column; gap:4px; font-size:0.85rem;">
                 <div style="display:flex; justify-content:space-between; width: 170px; background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius:4px;"><span style="color:#60a5fa">⚡ MEGA:</span> <strong style="color: #34d399;">$${parseFloat(u.credits1 || 0).toFixed(2)}</strong></div>
                 <div style="display:flex; justify-content:space-between; width: 170px; background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius:4px;"><span style="color:#f472b6">🛡 ALPHA:</span> <strong style="color: #34d399;">$${parseFloat(u.credits2 || 0).toFixed(2)}</strong></div>
                 <div style="display:flex; justify-content:space-between; width: 170px; background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius:4px;"><span style="color:#facc15">Ω OMEGA:</span> <strong style="color: #34d399;">$${parseFloat(u.credits3 || 0).toFixed(2)}</strong></div>
               </div>
            </td>
            <td style="text-align: right; vertical-align: middle;">
              ${u.role !== 'admin' ? `
                <div style="display: flex; gap: 5px; justify-content: flex-end;">
                  <button type="button" class="btn btn-sm btn-recharge-user" data-id="${u.id}" title="Añadir Saldo" style="background: rgba(34,211,238,0.1); color: #22d3ee; padding: 6px;"><i data-lucide="plus" style="width:16px;height:16px;"></i></button>
                  <button type="button" class="btn btn-sm btn-deduct-user" data-id="${u.id}" title="Quitar Saldo" style="background: rgba(244,63,94,0.1); color: #f43f5e; padding: 6px;"><i data-lucide="minus" style="width:16px;height:16px;"></i></button>
                  <button type="button" class="btn btn-sm btn-delete-user" data-id="${u.id}" title="Eliminar Usuario" style="background: rgba(239,68,68,0.1); color: #ef4444; padding: 6px;"><i data-lucide="trash-2" style="width:16px;height:16px;"></i></button>
                </div>
              ` : '<span style="color:var(--text-muted); font-size:0.8rem;">Admin</span>'}
            </td>
          `;
          usersTableBody.appendChild(tr);
        });
        
        lucide.createIcons();

        // Bind Actions
        document.querySelectorAll('.role-select').forEach(select => {
          select.addEventListener('change', async (e) => {
            const id = e.target.dataset.id;
            const val = e.target.value;
            try {
              const res = await fetch(`/api/users/${id}`, {
                method: 'PUT',
                headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ role: val })
              });
              if(res.ok) {
                e.target.style.borderColor = '#10b981';
                setTimeout(() => e.target.style.borderColor = 'rgba(139, 92, 246, 0.3)', 1500);
              } else {
                e.target.style.borderColor = '#ef4444';
              }
            } catch (err) {
              console.error(err);
            }
          });
        });

        document.querySelectorAll('.user-markup-input').forEach(input => {
          input.addEventListener('change', async (e) => {
            const id = e.target.dataset.id;
            const val = e.target.value;
            try {
              const res = await fetch(`/api/users/${id}`, {
                method: 'PUT',
                headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ markup: val })
              });
              if(res.ok) {
                e.target.style.borderColor = '#10b981';
                setTimeout(() => e.target.style.borderColor = 'var(--border-color)', 1500);
              } else {
                e.target.style.borderColor = '#ef4444';
              }
            } catch (err) {
              console.error(err);
            }
          });
        });

        // Password Reveal Logic
        document.querySelectorAll('.btn-toggle-pwd').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const input = e.currentTarget.previousElementSibling;
            if (input.type === 'password') {
              input.type = 'text';
              e.currentTarget.innerHTML = '<i data-lucide="eye-off" style="width: 14px; height: 14px;"></i>';
            } else {
              input.type = 'password';
              e.currentTarget.innerHTML = '<i data-lucide="eye" style="width: 14px; height: 14px;"></i>';
            }
            lucide.createIcons();
          });
        });

        // Edit Password Logic
        document.querySelectorAll('.btn-edit-pwd').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const newPwd = prompt('Ingresa la nueva contraseña para este usuario (mínimo 4 caracteres):');
            if (!newPwd) return;
            if (newPwd.length < 4) return alert('La contraseña es muy corta.');
            
            try {
              const res = await fetch(`/api/users/${id}/password`, {
                method: 'PUT',
                headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ password: newPwd })
              });
              if(res.ok) {
                alert('Contraseña actualizada con éxito.');
                loadAdminData();
              } else {
                alert('Error al actualizar contraseña.');
              }
            } catch (err) {
              console.error(err);
            }
          });
        });

        document.querySelectorAll('.btn-delete-user').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (confirm('¿Eliminar este usuario?')) {
              await fetch(`/api/users/${id}`, { method: 'DELETE', headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` }});
              loadAdminData();
            }
          });
        });

        const serverNames = {'1': '⚡ MEGA-SERVER', '2': '🛡 ALPHA-SERVER', '3': '🔱 OMEGA-SERVER'};

        document.querySelectorAll('.btn-recharge-user').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const user = users.find(u => u.id == id);
            const sName = serverNames[currentServerId];
            const currentCreds = parseFloat(currentServerId === '1' ? user.credits1 : (currentServerId === '2' ? user.credits2 : user.credits3) || 0);
            const addAmount = prompt(`Servidor Actual: ${sName}\n¿Cuánto saldo añadir a ${user.username}? (Ingresa cantidad a sumar)`);
            if (addAmount && !isNaN(parseFloat(addAmount))) {
              const newCredits = currentCreds + Math.abs(parseFloat(addAmount));
              await fetch(`/api/users/${id}`, {
                method: 'PUT',
                headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ credits: newCredits })
              });
              loadAdminData();
              updateAccountCredits();
            }
          });
        });

        document.querySelectorAll('.btn-deduct-user').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const user = users.find(u => u.id == id);
            const sName = serverNames[currentServerId];
            const currentCreds = parseFloat(currentServerId === '1' ? user.credits1 : (currentServerId === '2' ? user.credits2 : user.credits3) || 0);
            const subAmount = prompt(`Servidor Actual: ${sName}\n¿Cuánto saldo QUITAR a ${user.username}? (Ingresa cantidad a restar)`);
            if (subAmount && !isNaN(parseFloat(subAmount))) {
              let newCredits = currentCreds - Math.abs(parseFloat(subAmount));
              if (newCredits < 0) newCredits = 0;
              await fetch(`/api/users/${id}`, {
                method: 'PUT',
                headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ credits: newCredits })
              });
              loadAdminData();
              updateAccountCredits();
            }
          });
        });
      }
    } catch (e) {
      console.error('Failed to load admin data', e);
    }
  }

  // --- ADMIN SUB-TABS LOGIC ---
  const btnAdminTabUsers = document.getElementById('btnAdminTabUsers');
  const btnAdminTabHistory = document.getElementById('btnAdminTabHistory');
  const btnAdminTabSettings = document.getElementById('btnAdminTabSettings');
  
  const adminTabUsers = document.getElementById('adminTabUsersContent');
  const adminTabHistory = document.getElementById('adminTabHistoryContent');
  const adminTabSettings = document.getElementById('adminTabSettingsContent');

  if (btnAdminTabUsers) {
    btnAdminTabUsers.addEventListener('click', () => {
      document.querySelectorAll('.admin-sub-tab').forEach(t => t.classList.remove('active'));
      btnAdminTabUsers.classList.add('active');
      adminTabUsers.classList.remove('hidden');
      adminTabHistory.classList.add('hidden');
      adminTabSettings.classList.add('hidden');
    });
  }

  if (btnAdminTabHistory) {
    btnAdminTabHistory.addEventListener('click', () => {
      document.querySelectorAll('.admin-sub-tab').forEach(t => t.classList.remove('active'));
      btnAdminTabHistory.classList.add('active');
      adminTabHistory.classList.remove('hidden');
      adminTabUsers.classList.add('hidden');
      adminTabSettings.classList.add('hidden');
      fetchMasterHistory(); // Fetch data when entering the tab
    });
  }

  if (btnAdminTabSettings) {
    btnAdminTabSettings.addEventListener('click', () => {
      document.querySelectorAll('.admin-sub-tab').forEach(t => t.classList.remove('active'));
      btnAdminTabSettings.classList.add('active');
      adminTabSettings.classList.remove('hidden');
      adminTabUsers.classList.add('hidden');
      adminTabHistory.classList.add('hidden');
    });
  }

  let g_masterHistory = [];

  async function fetchMasterHistory() {
    try {
      const res = await fetch('/api/history?allServers=true', {
        headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        g_masterHistory = await res.json();
        renderMasterHistory();
      }
    } catch (e) {
      console.error('Error fetching master history', e);
    }
  }

  function renderMasterHistory() {
    const tbody = document.getElementById('masterHistoryBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    // Filters
    const elServer = document.getElementById('masterHistoryServerFilter');
    const elUser = document.getElementById('masterHistoryUserFilter');
    const elSearch = document.getElementById('masterHistorySearchInput');
    const elLimit = document.getElementById('masterHistoryLimitFilter');
    
    const serverFilter = elServer ? elServer.value : 'all';
    const userFilter = elUser ? elUser.value : 'all';
    const searchFilter = elSearch ? elSearch.value.toLowerCase() : '';
    const limitFilter = elLimit ? parseInt(elLimit.value, 10) : 50;
    
    const sNames = {'1': '⚡ MEGA-SVR', '2': '🛡 ALPHA-SVR', '3': '🔱 OMEGA-SVR'};
    
    let filtered = g_masterHistory.filter(order => {
      if (serverFilter !== 'all' && String(order.serverId) !== serverFilter) return false;
      if (userFilter !== 'all' && String(order.userId) !== userFilter) return false;
      if (searchFilter) {
        if (!order.serviceName.toLowerCase().includes(searchFilter) &&
            !(order.imei && order.imei.toLowerCase().includes(searchFilter)) &&
            !(String(order.referenceId).includes(searchFilter))) {
          return false;
        }
      }
      return true;
    });
    
    // Sort descending by date (most recent first)
    filtered.sort((a, b) => {
      const dateA = a.date || a.timestamp || 0;
      const dateB = b.date || b.timestamp || 0;
      return new Date(dateB) - new Date(dateA);
    });
    
    // Apply limit
    if (limitFilter > 0) {
      filtered = filtered.slice(0, limitFilter);
    }
    
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-secondary);">No se encontraron pedidos.</td></tr>';
      return;
    }
    
    filtered.forEach(order => {
      const tr = document.createElement('tr');
      
      let statusText = 'Pendiente';
      let stColor = '#eab308';
      let statLower = String(order.status).toLowerCase();
      
      if (statLower === 'success' || statLower === 'completado' || order.status === 4) {
        statusText = 'Completado';
        stColor = '#22c55e';
      } else if (statLower === 'failed' || statLower === 'rechazado' || statLower === 'reembolsado' || order.status === 3) {
        statusText = 'Rechazado';
        stColor = '#ef4444';
      } else if (statLower === 'en proceso' || statLower === 'procesando' || order.status === 1) {
        statusText = 'En Proceso';
        stColor = '#3b82f6';
      }
      
      const orderId = order.id || order.orderId || order.referenceId || 'N/A';
      const cost = order.costCharged !== undefined ? order.costCharged : (order.cost || 0);
      const apiCost = order.realCost !== undefined ? order.realCost : 0;
      const dateStr = order.date || order.timestamp;
      const formattedDate = dateStr ? new Date(dateStr).toLocaleString('es-MX') : 'Fecha Inválida';
      
      // Fix older history without serverId
      const sId = order.serverId ? String(order.serverId) : '1';

      tr.innerHTML = `
        <td>
           <span style="font-family: monospace; display:block; margin-bottom:4px;">#${orderId}</span>
           <span style="color: var(--text-secondary); font-size: 0.75rem;">${formattedDate}</span>
        </td>
        <td>
           <span style="display:inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; background: rgba(59, 130, 246, 0.2); color: #60a5fa; margin-bottom:4px;">${sNames[sId] || '⚡ MEGA-SVR'}</span><br>
           <strong style="font-size:0.85rem; color: #a78bfa;">${escapeHtml(order.username || 'Desconocido')}</strong>
        </td>
        <td>
           <strong style="color:var(--text-primary); font-size: 0.9rem;">${escapeHtml(order.serviceName)}</strong><br>
           ${order.imei && order.imei !== 'N/A' ? `<span style="font-family:monospace; color:var(--text-secondary); font-size:0.85rem;">IMEI: ${order.imei}</span>` : ''}
        </td>
        <td><span style="color: ${stColor}; font-weight: bold;">${statusText}</span></td>
        <td>
           <div style="display:flex; flex-direction:column; gap:2px; font-size: 0.85rem;">
             <span><span style="color:var(--text-secondary);">Reseller:</span> <strong style="color:#34d399;">$${parseFloat(cost).toFixed(2)}</strong></span>
             <span><span style="color:var(--text-secondary);">API:</span> <strong style="color:#f87171;">$${parseFloat(apiCost).toFixed(2)}</strong></span>
           </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  const masterHistorySearchInput = document.getElementById('masterHistorySearchInput');
  if (masterHistorySearchInput) {
    masterHistorySearchInput.addEventListener('input', renderMasterHistory);
  }
  const masterHistoryServerFilter = document.getElementById('masterHistoryServerFilter');
  if (masterHistoryServerFilter) {
    masterHistoryServerFilter.addEventListener('change', renderMasterHistory);
  }
  const masterHistoryUserFilter = document.getElementById('masterHistoryUserFilter');
  if (masterHistoryUserFilter) {
    masterHistoryUserFilter.addEventListener('change', renderMasterHistory);
  }
  const masterHistoryLimitFilter = document.getElementById('masterHistoryLimitFilter');
  if (masterHistoryLimitFilter) {
    masterHistoryLimitFilter.addEventListener('change', renderMasterHistory);
  }

  createUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('newUsername').value;
    const password = document.getElementById('newPassword').value;
    const credits = document.getElementById('newCredits').value;
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ username, password, credits })
      });
      if (res.ok) {
        createUserFormContainer.classList.add('hidden');
        createUserForm.reset();
        loadAdminData();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al crear usuario');
      }
    } catch (e) {
      alert('Error de conexión');
    }
  });

  const btnAdminStartBot = document.getElementById('btnAdminStartBot');
  const btnAdminStopBot = document.getElementById('btnAdminStopBot');
  const btnAdminRefreshLogs = document.getElementById('btnAdminRefreshLogs');
  const adminBotLogsDisplay = document.getElementById('adminBotLogsDisplay');

  async function loadBotLogs() {
    if (!adminBotLogsDisplay) return;
    try {
      const token = localStorage.getItem('dhru_token');
      const res = await fetch('/api/admin/bot/logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        adminBotLogsDisplay.textContent = data.logs || 'Sin logs.';
        adminBotLogsDisplay.scrollTop = adminBotLogsDisplay.scrollHeight;
      }
    } catch (e) {
      adminBotLogsDisplay.textContent = 'Error cargando logs: ' + e.message;
    }
  }

  if (btnAdminRefreshLogs) {
    btnAdminRefreshLogs.addEventListener('click', loadBotLogs);
  }

  if (btnAdminStartBot) {
    btnAdminStartBot.addEventListener('click', async () => {
      try {
        const token = localStorage.getItem('dhru_token');
        const res = await fetch('/api/admin/bot/start', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');
        alert(data.message);
        setTimeout(loadBotLogs, 2000); // refresh logs after start
      } catch (err) {
        alert(err.message);
      }
    });
  }

  if (btnAdminStopBot) {
    btnAdminStopBot.addEventListener('click', async () => {
      try {
        const token = localStorage.getItem('dhru_token');
        const res = await fetch('/api/admin/bot/stop', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');
        alert(data.message);
        setTimeout(loadBotLogs, 1000);
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // Cargar logs al iniciar si el admin tiene abierta esa pestaña
  if (adminBotLogsDisplay) {
    loadBotLogs();
  }

  if (adminSettingsForm) {
    adminSettingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const resellerMarkup = inputResellerMarkup.value;
        const clientMarkup = inputClientMarkup.value;
        const exchangeRate = document.getElementById('inputExchangeRate') ? document.getElementById('inputExchangeRate').value : 17.60;
        
        let payload = { exchangeRate: parseFloat(exchangeRate) };
        if (currentServerId === '3') {
          payload.server3 = { resellerMarkup: resellerMarkup, clientMarkup: clientMarkup };
        } else if (currentServerId === '2') {
          payload.server2 = { resellerMarkup: resellerMarkup, clientMarkup: clientMarkup };
        } else {
          payload.server1 = { resellerMarkup: resellerMarkup, clientMarkup: clientMarkup };
        }

        const res = await fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'X-Server-Id': currentServerId, 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          alert('Configuración guardada correctamente. El catálogo se recargará ahora para reflejar los nuevos precios.');
          await syncProducts(true);
        } else {
          alert('Error al guardar configuración');
        }
      } catch (err) {
        alert('Error de conexión');
      }
    });
  }

  // --- Backup & Restore ---
  
  if (btnDownloadBackup) {
    btnDownloadBackup.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/admin/backup', { headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` } });
        if (!res.ok) throw new Error('Failed to fetch backup');
        const backupData = await res.json();
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `megaunlockphone-backup-${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
      } catch (err) {
        console.error(err);
        alert('Error al descargar el respaldo.');
      }
    });
  }

  if (btnUploadBackup && fileRestoreBackup) {
    btnUploadBackup.addEventListener('click', () => {
      fileRestoreBackup.click();
    });

    fileRestoreBackup.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!confirm('⚠️ ¡ADVERTENCIA!\n\nRestaurar este archivo sobreescribirá TODA la base de datos actual (usuarios, historial y configuraciones).\n\n¿Estás completamente seguro de continuar?')) {
        fileRestoreBackup.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsedData = JSON.parse(event.target.result);
          
          const res = await fetch('/api/admin/restore', {
            method: 'POST',
            headers: { 'X-Server-Id': currentServerId, 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}` 
            },
            body: JSON.stringify(parsedData)
          });
          
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to restore backup');
          }
          
          alert('✅ ¡Respaldo restaurado con éxito!\nLa página se recargará ahora.');
          window.location.reload();
        } catch (err) {
          console.error(err);
          alert('❌ Error al restaurar el respaldo:\n' + err.message);
        } finally {
          fileRestoreBackup.value = '';
        }
      };
      
      reader.readAsText(file);
    });
  }

  // --- COUPON ADMIN LOGIC ---
  const adminCouponsModal = document.getElementById('adminCouponsModal');
  const btnCloseAdminCouponsModal = document.getElementById('btnCloseAdminCouponsModal');
  const btnOpenCreateCoupon = document.getElementById('btnOpenCreateCoupon');
  const createCouponModal = document.getElementById('createCouponModal');
  const btnCloseCreateCoupon = document.getElementById('btnCloseCreateCoupon');
  const createCouponForm = document.getElementById('createCouponForm');
  const couponsTableBody = document.getElementById('couponsTableBody');

  const couponNormalPrice = document.getElementById('couponNormalPrice');
  const couponPromoPrice = document.getElementById('couponPromoPrice');
  const couponDiscountPercentage = document.getElementById('couponDiscountPercentage');

  let activeCoupons = [];

  if (btnAdminCoupons) {
    btnAdminCoupons.addEventListener('click', () => {
      adminCouponsModal.classList.remove('hidden');
      loadAdminCoupons();
    });
  }

  if (btnCloseAdminCouponsModal) {
    btnCloseAdminCouponsModal.addEventListener('click', () => {
      adminCouponsModal.classList.add('hidden');
    });
  }

  if (btnOpenCreateCoupon) {
    btnOpenCreateCoupon.addEventListener('click', () => {
      createCouponModal.classList.remove('hidden');
      createCouponForm.reset();
      couponDiscountPercentage.textContent = '0%';
    });
  }

  if (btnCloseCreateCoupon) {
    btnCloseCreateCoupon.addEventListener('click', () => {
      createCouponModal.classList.add('hidden');
    });
  }

  function calculatePercentage() {
    const normal = parseFloat(couponNormalPrice.value) || 0;
    const promo = parseFloat(couponPromoPrice.value) || 0;
    if (normal > 0 && promo >= 0 && normal >= promo) {
      const perc = Math.round(((normal - promo) / normal) * 100);
      couponDiscountPercentage.textContent = `-${perc}%`;
    } else {
      couponDiscountPercentage.textContent = '0%';
    }
  }

  if (couponNormalPrice) couponNormalPrice.addEventListener('input', calculatePercentage);
  if (couponPromoPrice) couponPromoPrice.addEventListener('input', calculatePercentage);

  if (createCouponForm) {
    createCouponForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const serviceName = document.getElementById('couponServiceName').value;
      const normalPrice = couponNormalPrice.value;
      const promoPrice = couponPromoPrice.value;
      const maxRedemptions = document.getElementById('couponMaxRedemptions').value;
      const showPercentage = document.getElementById('couponShowPercentage').checked;
      const conditions = document.getElementById('couponConditions').value;
      const imageUrl = document.getElementById('couponImageUrl').value;

      try {
        const res = await fetch('/api/admin/coupons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
          body: JSON.stringify({ serviceName, normalPrice, promoPrice, showPercentage, conditions, maxRedemptions, imageUrl })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        // Generate Image immediately
        await generateCouponImage(data.coupon);
        
        createCouponModal.classList.add('hidden');
        loadAdminCoupons();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  async function loadAdminCoupons() {
    try {
      const res = await fetch('/api/admin/coupons', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      activeCoupons = data;
      renderCouponsTable();
    } catch (err) {
      console.error(err);
    }
  }

  function renderCouponsTable() {
    if (!couponsTableBody) return;
    couponsTableBody.innerHTML = '';
    
    activeCoupons.forEach(c => {
      const isRedeemed = c.status === 'redeemed';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-family: monospace; font-weight: bold; color: #00f0ff;">${c.code}</td>
        <td>${escapeHtml(c.serviceName)}</td>
        <td>${c.normalPrice ? `<span style="text-decoration: line-through; color: #ef4444; font-size: 0.8rem;">$${c.normalPrice}</span> ` : ''}<strong style="color: #4ade80;">$${c.promoPrice}</strong></td>
        <td><strong style="color: #a855f7;">${c.currentRedemptions || 0} / ${c.maxRedemptions || 1}</strong></td>
        <td>
          <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; background: ${isRedeemed ? 'rgba(239, 68, 68, 0.2)' : 'rgba(74, 222, 128, 0.2)'}; color: ${isRedeemed ? '#ef4444' : '#4ade80'};">
            ${isRedeemed ? 'AGOTADO' : 'ACTIVO'}
          </span>
        </td>
        <td style="text-align: right; display: flex; gap: 8px; justify-content: flex-end;">
          <button class="btn btn-secondary btn-small btn-view-coupon" data-code="${c.code}"><i data-lucide="eye"></i> Ver</button>
          ${!isRedeemed ? 
            `<button class="btn btn-primary btn-small btn-redeem-coupon" data-code="${c.code}"><i data-lucide="check-circle"></i> Marcar</button>` : ''
          }
          <button class="btn btn-secondary btn-small btn-del-coupon" data-code="${c.code}" style="color: #ef4444;"><i data-lucide="trash-2"></i></button>
        </td>
      `;
      couponsTableBody.appendChild(tr);
    });
    lucide.createIcons();
    
    document.querySelectorAll('.btn-redeem-coupon').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const code = e.currentTarget.getAttribute('data-code');
        const username = prompt('¿Quién canjeó este cupón? (Nombre o ID del usuario):');
        if (!username) return;
        
        try {
          const res = await fetch('/api/admin/coupons/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ code, username })
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          loadAdminCoupons();
        } catch (err) {
          alert(err.message);
        }
      });
    });

    document.querySelectorAll('.btn-del-coupon').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if(!confirm('¿Eliminar este cupón permanentemente?')) return;
        const code = e.currentTarget.getAttribute('data-code');
        try {
          await fetch(`/api/admin/coupons/${code}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          loadAdminCoupons();
        } catch(err){}
      });
    });

    document.querySelectorAll('.btn-view-coupon').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const code = e.currentTarget.getAttribute('data-code');
        const coupon = activeCoupons.find(c => c.code === code);
        if(coupon) {
          generateCouponImage(coupon);
        }
      });
    });
  }

  async function generateCouponImage(coupon) {
    const tplContainer = document.getElementById('couponTemplateContainer');
    const tplBox = document.getElementById('couponTemplate');
    const tplStamp = document.getElementById('couponRedeemedStamp');
    const tplLogo = document.getElementById('tplCouponLogo');
    
    if (coupon.imageUrl && coupon.imageUrl.trim() !== '') {
      try {
        // Fetch via proxy and convert to base64 to completely avoid html-to-image CORS/network quirks
        const proxyUrl = '/api/proxy-image?url=' + encodeURIComponent(coupon.imageUrl);
        const res = await fetch(proxyUrl);
        if (res.ok) {
          const blob = await res.blob();
          if (blob.type.startsWith('image/')) {
            const base64Url = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
            
            // Wait for image to load to prevent html-to-image from crashing on incomplete images
            await new Promise((resolve) => {
              tplLogo.onload = resolve;
              tplLogo.onerror = () => { 
                tplLogo.style.display = 'none'; 
                tplLogo.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
                resolve(); 
              };
              tplLogo.src = base64Url;
            });
            if (tplLogo.style.display !== 'none') tplLogo.style.display = 'block';
          } else {
            tplLogo.style.display = 'none';
          }
        }
      } catch (err) {
        console.error('Error loading coupon image via proxy:', err);
      }
    } else {
      tplLogo.style.display = 'none';
      tplLogo.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
    }

    document.getElementById('tplCouponService').textContent = coupon.serviceName;
    
    const oldPriceBox = document.getElementById('tplCouponOldPriceBox');
    if (coupon.normalPrice != null && coupon.normalPrice > 0) {
      document.getElementById('tplCouponOldPrice').textContent = '$' + coupon.normalPrice.toFixed(2);
      if(oldPriceBox) oldPriceBox.style.display = 'flex';
    } else {
      if(oldPriceBox) oldPriceBox.style.display = 'none';
    }
    
    document.getElementById('tplCouponNewPrice').textContent = '$' + coupon.promoPrice.toFixed(2);
    document.getElementById('tplCouponCode').textContent = coupon.code;
    
    const conditionsBox = document.getElementById('tplCouponConditionsBox');
    const conditionsText = document.getElementById('tplCouponConditionsText');
    if (coupon.conditions && coupon.conditions.trim() !== '') {
      conditionsText.textContent = coupon.conditions;
      conditionsBox.classList.remove('hidden');
    } else {
      conditionsBox.classList.add('hidden');
    }
    
    const discountPill = document.getElementById('tplCouponDiscountPill');
    if (coupon.showPercentage) {
      const normal = coupon.normalPrice;
      const promo = coupon.promoPrice;
      let perc = 0;
      if (normal > 0) perc = Math.round(((normal - promo) / normal) * 100);
      document.getElementById('tplCouponDiscountVal').textContent = perc;
      discountPill.classList.remove('hidden');
    } else {
      discountPill.classList.add('hidden');
    }

    if (coupon.status === 'redeemed') {
      tplStamp.classList.remove('hidden');
    } else {
      tplStamp.classList.add('hidden');
    }

    tplContainer.style.opacity = '1';
    
    try {
      const blob = await htmlToImage.toBlob(tplBox, {
        backgroundColor: '#111116',
        pixelRatio: 2,
        skipFonts: true,
        imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
        style: { transform: 'scale(1)', transformOrigin: 'top left' }
      });
      
      tplContainer.style.opacity = '0';
      
      // Show Preview
      const couponPreviewModal = document.getElementById('couponPreviewModal');
      const couponPreviewImg = document.getElementById('couponPreviewImg');
      const couponPreviewSuccessMsg = document.getElementById('couponPreviewSuccessMsg');
      const btnCloseCouponPreview = document.getElementById('btnCloseCouponPreview');
      const btnCancelCouponPreview = document.getElementById('btnCancelCouponPreview');
      
      if (couponPreviewModal && couponPreviewImg) {
        couponPreviewImg.src = URL.createObjectURL(blob);
        couponPreviewModal.classList.remove('hidden');
        
        if (btnCloseCouponPreview) {
          btnCloseCouponPreview.onclick = () => couponPreviewModal.classList.add('hidden');
        }
        if (btnCancelCouponPreview) {
          btnCancelCouponPreview.onclick = () => couponPreviewModal.classList.add('hidden');
        }
      }
      
      try {
        const clipboardItem = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([clipboardItem]);
        if (couponPreviewSuccessMsg) couponPreviewSuccessMsg.style.display = 'block';
      } catch (clipErr) {
        // Clipboard failed, but they can manually copy from the preview
        console.warn('Clipboard write failed', clipErr);
        if (couponPreviewSuccessMsg) couponPreviewSuccessMsg.style.display = 'none';
      }
      
    } catch (err) {
      console.error(err);
      tplContainer.style.opacity = '0';
      const errMsg = err.message || err.toString() || 'Unknown error';
      alert('Error al generar la imagen: ' + errMsg);
    }
  }

  // Real-time polling for account balance and background sync
  setInterval(() => {
    if (authToken) {
      updateAccountCredits();
      if (adminSection && !adminSection.classList.contains('hidden') && authRole === 'admin') {
         // Only refresh admin table if user is not actively typing
         if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            loadAdminData();
         }
      }
      
      // Check catalog version for real-time sync
      fetch('/api/status').then(r => r.json()).then(data => {
        if (data.version && data.version > localCatalogVersion) {
          localCatalogVersion = data.version;
          if (!dashboardView.classList.contains('hidden')) {
            syncProducts(false); // Silent sync
          }
        }
      }).catch(e => {});
    }
  }, 15000);

});

// Recharges Logic
const btnRechargesHistory = document.getElementById('btnRechargesHistory');
const rechargesSection = document.getElementById('rechargesSection');
const rechargesBody = document.getElementById('rechargesBody');
const rechargesCount = document.getElementById('rechargesCount');
const btnSyncRecharges = document.getElementById('btnSyncRecharges');

let rechargesHistory = [];

function formatType(type) {
  if (type === 'SPEI') return '<span style="color:#10b981;">SPEI / Banco</span>';
  if (type === 'MANUAL_ADMIN') return '<span style="color:#8b5cf6;">Manual (Admin)</span>';
  if (type === 'MANUAL_BOT') return '<span style="color:#3b82f6;">Bot WhatsApp</span>';
  return escapeHtml(type);
}

async function fetchRecharges() {
  try {
    const url = authRole === 'admin' ? '/api/admin/recharges' : '/api/recharges';
    const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + authToken }});
    const data = await res.json();
    if (res.ok) {
      rechargesHistory = data;
      renderRecharges();
    }
  } catch (e) {
    console.error('Error fetching recharges', e);
  }
}

function renderRecharges() {
  if (!rechargesBody) return;
  rechargesBody.innerHTML = '';
  rechargesCount.textContent = rechargesHistory.length;
  
  if (authRole === 'admin') {
    document.querySelectorAll('.admin-col-recharge').forEach(e => e.classList.remove('hidden'));
  }

  if (rechargesHistory.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No hay recargas registradas.</td>`;
    rechargesBody.appendChild(tr);
    return;
  }

  rechargesHistory.forEach(item => {
    const tr = document.createElement('tr');
    const displayServer = item.serverId === '3' ? 'OMEGA' : (item.serverId === '2' ? 'ALPHA' : 'MEGA');
    const colorServer = item.serverId === '3' ? '#f59e0b' : (item.serverId === '2' ? '#3b82f6' : '#ec4899');
    
    tr.innerHTML = `
      <td>${new Date(item.date).toLocaleString()}</td>
      ${authRole === 'admin' ? `<td style="color:#a78bfa; font-weight:bold;">${escapeHtml(item.username)}</td>` : ''}
      <td style="color:#10b981; font-weight:bold;">$${parseFloat(item.amount).toFixed(2)} MXN</td>
      <td>${formatType(item.type)}</td>
      <td>${escapeHtml(item.adminUsername || 'Sistema')}</td>
      <td><span style="color:${colorServer}; font-weight:bold;">${displayServer}</span></td>
    `;
    rechargesBody.appendChild(tr);
  });
}

if (btnRechargesHistory) {
  btnRechargesHistory.addEventListener('click', () => {
    productsSection.classList.add('hidden');
    historySection.classList.add('hidden');
    if (typeof adminSection !== 'undefined' && adminSection) adminSection.classList.add('hidden');
    rechargesSection.classList.remove('hidden');
    fetchRecharges();
  });
}
if (btnSyncRecharges) {
  btnSyncRecharges.addEventListener('click', () => {
    fetchRecharges();
  });
}
