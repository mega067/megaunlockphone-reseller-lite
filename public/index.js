// DOMContentLoaded Wrapper Removed
let localCatalogVersion = 1;
let localHistoryVersion = 1;

// Initialize Lucide icons
lucide.createIcons();

// DOM Elements - Views
const loginView = document.getElementById('loginView');
const btnLoginTop = document.getElementById('btnLoginTop');
const dashboardView = document.getElementById('dashboardView');

// DOM Elements - Auth & Header
const credentialsForm = document.getElementById('credentialsForm');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const btnTogglePass = document.getElementById('btnTogglePass');

// Forgot Password Elements
const btnShowForgotPassword = document.getElementById('btnShowForgotPassword');
const forgotPasswordModal = document.getElementById('forgotPasswordModal');
const btnCloseForgotPasswordModal = document.getElementById('btnCloseForgotPasswordModal');
const fpStep1 = document.getElementById('fpStep1');
const fpStep2 = document.getElementById('fpStep2');
const fpUsername = document.getElementById('fpUsername');
const fpCode = document.getElementById('fpCode');
const fpNewPassword = document.getElementById('fpNewPassword');
const btnRequestRecoveryCode = document.getElementById('btnRequestRecoveryCode');
const btnResetPassword = document.getElementById('btnResetPassword');
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
const orderFormBtnGroup = document.getElementById('orderFormBtnGroup');
const btnProcessOrder = document.getElementById('btnProcessOrder');
const orderForm = document.getElementById('orderForm');

// Warning Modal Elements
const warningModal = document.getElementById('warningModal');
const btnWarningClose = document.getElementById('btnWarningClose');
const warningTemplateSelect = document.getElementById('warningTemplateSelect');
const btnDeleteWarningTemplate = document.getElementById('btnDeleteWarningTemplate');
const warningContent = document.getElementById('warningContent');
const btnSaveAsWarningTemplate = document.getElementById('btnSaveAsWarningTemplate');
const btnWarningClear = document.getElementById('btnWarningClear');
const btnWarningSave = document.getElementById('btnWarningSave');

let currentWarningServiceId = null;
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

// Legacy server tabs removed (handled by btn-server-switch)





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

const btnCustomTicket = document.getElementById('btnCustomTicket');
const customTicketModal = document.getElementById('customTicketModal');
const btnCustomTicketClose = document.getElementById('btnCustomTicketClose');
const btnCancelCustomTicket = document.getElementById('btnCancelCustomTicket');
const btnGenerateCustomTicket = document.getElementById('btnGenerateCustomTicket');
const customTicketFormat = document.getElementById('customTicketFormat');
const customTicketRawContainer = document.getElementById('customTicketRawContainer');
const customTicketLoginContainer = document.getElementById('customTicketLoginContainer');
const customTicketTitle = document.getElementById('customTicketTitle');
const customTicketOrderId = document.getElementById('customTicketOrderId');
const customTicketRaw = document.getElementById('customTicketRaw');
const customTicketUser = document.getElementById('customTicketUser');
const customTicketPass = document.getElementById('customTicketPass');
const customTicketPrice = document.getElementById('customTicketPrice');

// New ticket template elements
const ticketFormatType = document.getElementById('ticketFormatType');
const ticketParsedBox = document.getElementById('ticketParsedBox');
const ticketRawBox = document.getElementById('ticketRawBox');
const ticketRawTextVal = document.getElementById('ticketRawTextVal');

const configNameInput = document.getElementById('configNameInput');
const configWaInput = document.getElementById('configWaInput');
const configFbInput = document.getElementById('configFbInput');
const configLogoInput = document.getElementById('configLogoInput');
const configLogoPreview = document.getElementById('configLogoPreview');
let customTicketSettings = { nombre: '', whatsapp: '', facebook: '', logoExt: '' };

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
        
        // Cleanly switch back to catalog view if user was elsewhere
        if (tabCatalog && (!tabCatalog.classList.contains('active') || (productsSection && productsSection.classList.contains('hidden')))) {
          tabCatalog.click();
        } else if (typeof showCategoriesView === 'function') {
          showCategoriesView();
        }

        if (filterTypeSelect && tsInstances[filterTypeSelect.id]) { tsInstances[filterTypeSelect.id].clear(true); window.lastSelectedType = 'all'; }
        if (typeof populateGroupsFilter === 'function') populateGroupsFilter('all');
        if (typeof populateServicesFilter === 'function') populateServicesFilter('all', 'all');
        if (filterGroupSelect && tsInstances[filterGroupSelect.id]) { tsInstances[filterGroupSelect.id].clear(true); window.lastSelectedGroup = 'all'; }
        if (filterServiceSelect && tsInstances[filterServiceSelect.id]) { tsInstances[filterServiceSelect.id].clear(true); window.lastSelectedServiceId = ''; }
        
        updateAccountCredits();
        syncProducts(false); // DO NOT force sync when switching tabs
        if (historySection && !historySection.classList.contains('hidden')) {
          fetchOrderHistory();
        }
        if (authToken && adminSection && !adminSection.classList.contains('hidden')) {
          loadAdminData();
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
    if (btnUserProfile) btnUserProfile.classList.add('hidden');
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
      if (btnCustomTicket) btnCustomTicket.classList.remove('hidden');
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
      if (btnUserProfile) btnUserProfile.classList.remove('hidden');
      if (btnCustomTicket) btnCustomTicket.classList.add('hidden');
      if (btnImportOrder) btnImportOrder.classList.remove('hidden');
      if (btnRechargesHistory) btnRechargesHistory.classList.remove('hidden');
    }

    if (btnUserProfile) btnUserProfile.classList.remove('hidden');
    
    btnRechargeBalance.classList.remove('hidden'); // Shown for EVERYONE now
    btnWhatsappBot.classList.remove('hidden');

    // Populate header profile button data immediately
    const headerUserName = document.getElementById('headerUserName');
    const headerAvatarLetter = document.getElementById('headerUserAvatarLetter');
    if (headerUserName) headerUserName.textContent = authUsername || 'Usuario';
    if (headerAvatarLetter) headerAvatarLetter.textContent = (authUsername || 'U').charAt(0).toUpperCase();
    
    // Check WhatsApp bot link status and user profile avatar for the button
    if (authToken) {
      fetch('/api/me', { headers: { 'Authorization': `Bearer ${authToken}` } })
        .then(r => r.ok ? r.json() : null)
        .then(meData => {
          if (meData) {
            if (typeof updateBotButtonStatus === 'function') {
              updateBotButtonStatus(Boolean(meData.isLinkedToBot));
            }
            if (headerUserName && meData.username) headerUserName.textContent = meData.username;
            const headerAvatarImg = document.getElementById('headerUserAvatarImg');
            if (meData.logoUrl && headerAvatarImg && headerAvatarLetter) {
              headerAvatarImg.src = `${meData.logoUrl}?t=${Date.now()}`;
              headerAvatarImg.style.display = 'block';
              headerAvatarLetter.style.display = 'none';
            }
          }
        })
        .catch(() => {});
    }
    
    syncProducts(false); // Utilizar caché instantánea en recargas para máxima velocidad
    updateAccountCredits();
    fetchOrderHistory();
    if (typeof fetchRecharges === 'function') fetchRecharges();
    if (window.MegaApp && window.MegaApp.Ticket) window.MegaApp.Ticket.fetchTicketConfig();
    
    document.getElementById('creditsBadgeContainer').classList.remove('hidden');
    const ssc = document.getElementById('serverSwitchContainer');
    if (ssc) ssc.classList.remove('hidden');
    
    if (btnLoginTop) btnLoginTop.classList.add('hidden');

    // Impersonation Banner Logic
    const impersonationBanner = document.getElementById('impersonationBanner');
    const impersonatedUserLabel = document.getElementById('impersonatedUserLabel');
    const btnExitImpersonation = document.getElementById('btnExitImpersonation');
    const impersonatorBackupRaw = localStorage.getItem('admin_impersonator_backup');

    if (impersonatorBackupRaw && impersonationBanner && impersonatedUserLabel) {
      impersonatedUserLabel.textContent = authUsername || 'Usuario';
      impersonationBanner.classList.remove('hidden');

      if (btnExitImpersonation && !btnExitImpersonation.dataset.bound) {
        btnExitImpersonation.dataset.bound = 'true';
        btnExitImpersonation.addEventListener('click', () => {
          try {
            const backup = JSON.parse(impersonatorBackupRaw);
            localStorage.setItem('dhru_token', backup.token);
            localStorage.setItem('dhru_role', backup.role);
            localStorage.setItem('dhru_username', backup.username);
            localStorage.setItem('dhru_uid', backup.uid);
            localStorage.removeItem('admin_impersonator_backup');
            window.location.reload();
          } catch (e) {
            console.error('Error restaurando sesión de admin:', e);
            localStorage.removeItem('admin_impersonator_backup');
            window.location.reload();
          }
        });
      }
    } else if (impersonationBanner) {
      impersonationBanner.classList.add('hidden');
    }
  } else {
    // Unauthenticated state (No session / Session dropped)
    if (btnLoginTop) btnLoginTop.classList.remove('hidden');
    btnLogout.classList.add('hidden');
    btnAdminManage.classList.add('hidden');
    if (typeof btnAdminCoupons !== 'undefined' && btnAdminCoupons) btnAdminCoupons.classList.add('hidden');
    if (typeof btnCustomTicket !== 'undefined' && btnCustomTicket) btnCustomTicket.classList.add('hidden');
    if (typeof btnImportOrder !== 'undefined' && btnImportOrder) btnImportOrder.classList.add('hidden');
    if (typeof btnBulkSavePrices !== 'undefined' && btnBulkSavePrices) btnBulkSavePrices.classList.add('hidden');
    btnRechargeBalance.classList.add('hidden');
    btnWhatsappBot.classList.add('hidden');
    if (btnUserProfile) btnUserProfile.classList.add('hidden');
    
    // Always show 0 credits when outside of session
    globalApiCreditRaw = 0;
    creditsBalanceText.textContent = 'Créditos: $0.00 MXN';
    creditsBadgeContainer.classList.remove('hidden');
    
    const ssc = document.getElementById('serverSwitchContainer');
    if (ssc) ssc.classList.remove('hidden');
    
    // Switch to catalog view by default
    loginView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    if (historySection) historySection.classList.add('hidden');
    if (adminSection) adminSection.classList.add('hidden');
    const profileSectionEl = document.getElementById('profileSection');
    if (profileSectionEl) profileSectionEl.classList.add('hidden');
    if (productsSection) productsSection.classList.remove('hidden');
    if (tabCatalog) tabCatalog.classList.add('active');
    if (tabHistory) tabHistory.classList.remove('active');
    if (tabAdmin) tabAdmin.classList.remove('active');
    const tabProfileEl = document.getElementById('tabProfile');
    if (tabProfileEl) {
      tabProfileEl.classList.remove('active');
      tabProfileEl.classList.add('hidden');
    }
    
    syncProducts(false); // Fetch products as guest
  }
}

// Add event listener for top login button
if (btnLoginTop) {
  btnLoginTop.addEventListener('click', () => {
    dashboardView.classList.add('hidden');
    loginView.classList.remove('hidden');
  });
}

const btnBackToCatalog = document.getElementById('btnBackToCatalog');
if (btnBackToCatalog) {
  btnBackToCatalog.addEventListener('click', (e) => {
    e.preventDefault();
    loginView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    lucide.createIcons();
  });
}

// checkPersistedSession moved to the bottom of the script

async function updateAccountCredits() {
  if (!authToken) {
    globalApiCreditRaw = 0;
    creditsBalanceText.textContent = 'Créditos: $0.00 MXN';
    creditsBadgeContainer.classList.remove('hidden');
    return;
  }
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
          window.adminAccountMetrics = {
            credit: rawCredits,
            assigned: parseFloat(assigned),
            available: parseFloat(available)
          };
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
          window.adminAccountMetrics = null;
          creditsBalanceText.textContent = `Créditos: $${rawCredits.toFixed(2)} MXN`;
        }
        if (typeof updateRechargesSummary === 'function') {
          updateRechargesSummary();
        }
      }
    } else if (res.status === 401) {
      // Session expired or logged out from server
      authToken = null;
      authRole = null;
      authUsername = null;
      authUserId = null;
      localStorage.removeItem('dhru_token');
      localStorage.removeItem('dhru_role');
      localStorage.removeItem('dhru_username');
      localStorage.removeItem('dhru_uid');
      globalApiCreditRaw = 0;
      creditsBalanceText.textContent = 'Créditos: $0.00 MXN';
      creditsBadgeContainer.classList.remove('hidden');
      checkPersistedSession();
    }
  } catch (e) {
    console.warn('Failed to fetch account credits balance', e);
  }
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
  if (window.AppUtils) return window.AppUtils.formatPrice(credits);
  return `$${(parseFloat(credits)||0).toFixed(2)} MXN`;
}

// Smart Parser for Credentials
function parseCredentials(text) {
  if (window.AppUtils && window.AppUtils.parseCredentials) {
    return window.AppUtils.parseCredentials(text);
  }
  return { user: 'N/A', pass: 'N/A' };
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
      if (bulkData[serviceId].resellerPrice !== '' && bulkData[serviceId].clientPrice !== '') {
        bulkArray.push({
          serviceId: serviceId,
          resellerPrice: bulkData[serviceId].resellerPrice,
          clientPrice: bulkData[serviceId].clientPrice
        });
      }
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
  if (!connectionStatus) return;
  const dot = connectionStatus.querySelector('.status-dot');
  const label = connectionStatus.querySelector('.status-text');
  if (dot) dot.className = 'status-dot ' + type;
  if (label) label.textContent = text;
  connectionStatus.setAttribute('title', `Estado del Servidor: ${text}`);
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
  if (unsafe === null || unsafe === undefined) return '';
  if (window.AppUtils && typeof window.AppUtils.escapeHtml === 'function') return window.AppUtils.escapeHtml(unsafe);
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
    if (window.AppUtils) return window.AppUtils.colorizeServerResponse(text);
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
    
    // Detect URLs (including Dhru split 'https: //', www, and common TLDs) and make them clickable (ignoring email addresses)
    const urlRegex = /(https?:\s*\/\/[^\s<]+|https?:\/\/[^\s<]+|www\.[a-zA-Z0-9-]+\.[^\s<]+|(?<![@a-zA-Z0-9._%+-])(?:[a-zA-Z0-9-]+\.)+(?:com|net|org|mx|io|app|dev)(?:\/[^\s<]*)?)/gi;
    safeText = safeText.replace(urlRegex, (matched, p1, offset, fullStr) => {
      const beforeChar = offset > 0 ? fullStr[offset - 1] : '';
      if (beforeChar === '@') return matched;
      let trailing = '';
      const trailMatch = matched.match(/[.,;:)]+$/);
      if (trailMatch) {
        trailing = trailMatch[0];
        matched = matched.slice(0, -trailing.length);
      }
      let cleanHref = matched.replace(/\s+/g, '');
      if (!/^https?:\/\//i.test(cleanHref)) cleanHref = 'https://' + cleanHref;
      return `<a href="${cleanHref}" target="_blank" rel="noopener noreferrer" class="auto-detected-link" style="color: #00f0ff; text-decoration: underline; word-break: break-all; font-weight: 600;"><i data-lucide="external-link" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 3px;"></i>${matched}</a>${trailing}`;
    });

    // Match Key: Value pattern and wrap in spans for coloring (exclude http/https)
    safeText = safeText.replace(/^([a-zA-Z0-9_ \-\.]+):\s*(.*)$/gm, (match, p1, p2) => {
      if (p1.toLowerCase() === 'http' || p1.toLowerCase() === 'https') {
        return match; 
      }
      const lowerP1 = p1.toLowerCase();
      let valColor = '#34d399'; // default emerald
      if (lowerP1.includes('status') || lowerP1.includes('estado')) {
        if (/activat|success|exito|complet|aprob/i.test(p2)) valColor = '#10b981';
        else if (/reject|fail|error|rechaz/i.test(p2)) valColor = '#ef4444';
        else valColor = '#f59e0b';
      } else if (lowerP1.includes('user') || lowerP1.includes('usuario')) {
        valColor = '#38bdf8'; // sky blue
      } else if (lowerP1.includes('email') || lowerP1.includes('correo')) {
        valColor = '#a78bfa'; // violet purple
      } else if (lowerP1.includes('pass') || lowerP1.includes('contra') || lowerP1.includes('pin') || lowerP1.includes('code')) {
        valColor = '#f43f5e'; // rose/pink
      } else if (lowerP1.includes('date') || lowerP1.includes('fecha') || lowerP1.includes('time')) {
        valColor = '#cbd5e1'; // light slate
      }
      return `<span style="color: #f59e0b; font-weight: 700;">${p1}:</span> <span style="color: ${valColor}; font-weight: 600;">${p2}</span>`;
    });

    return safeText;
  }
  
  // Compute overall counters for the order status summary boxes (always relative to full orderHistory)
  const totalOrdersCount = Array.isArray(orderHistory) ? orderHistory.length : 0;
  let successCount = 0;
  let pendingCount = 0;
  let failedCount = 0;

  if (Array.isArray(orderHistory)) {
    orderHistory.forEach(item => {
      const st = String(item.status || '').toLowerCase();
      if (st === 'success') successCount++;
      else if (st === 'pending' || st === 'processing' || st === 'in_process') pendingCount++;
      else if (st === 'failed' || st === 'rejected' || st === 'error') failedCount++;
    });
  }

  const statSuccessCountEl = document.getElementById('orderStatSuccessCount');
  const statSuccessTotalEl = document.getElementById('orderStatSuccessTotal');
  const statPendingCountEl = document.getElementById('orderStatPendingCount');
  const statPendingTotalEl = document.getElementById('orderStatPendingTotal');
  const statFailedCountEl = document.getElementById('orderStatFailedCount');
  const statFailedTotalEl = document.getElementById('orderStatFailedTotal');

  const statSuccessBar = document.getElementById('orderStatSuccessBar');
  const statPendingBar = document.getElementById('orderStatPendingBar');
  const statFailedBar = document.getElementById('orderStatFailedBar');

  const statSuccessPct = document.getElementById('orderStatSuccessPct');
  const statPendingPct = document.getElementById('orderStatPendingPct');
  const statFailedPct = document.getElementById('orderStatFailedPct');

  const pctSuccess = totalOrdersCount > 0 ? ((successCount / totalOrdersCount) * 100).toFixed(1) : '0';
  const pctPending = totalOrdersCount > 0 ? ((pendingCount / totalOrdersCount) * 100).toFixed(1) : '0';
  const pctFailed = totalOrdersCount > 0 ? ((failedCount / totalOrdersCount) * 100).toFixed(1) : '0';

  if (statSuccessCountEl) statSuccessCountEl.textContent = successCount;
  if (statSuccessTotalEl) statSuccessTotalEl.textContent = `/ ${totalOrdersCount}`;
  if (statPendingCountEl) statPendingCountEl.textContent = pendingCount;
  if (statPendingTotalEl) statPendingTotalEl.textContent = `/ ${totalOrdersCount}`;
  if (statFailedCountEl) statFailedCountEl.textContent = failedCount;
  if (statFailedTotalEl) statFailedTotalEl.textContent = `/ ${totalOrdersCount}`;

  // Pintar ancho proporcional de la barra según el porcentaje
  if (statSuccessBar) statSuccessBar.style.width = `${pctSuccess}%`;
  if (statPendingBar) statPendingBar.style.width = `${pctPending}%`;
  if (statFailedBar) statFailedBar.style.width = `${pctFailed}%`;

  // Mostrar porcentaje numérico en chip
  if (statSuccessPct) statSuccessPct.textContent = `${pctSuccess}%`;
  if (statPendingPct) statPendingPct.textContent = `${pctPending}%`;
  if (statFailedPct) statFailedPct.textContent = `${pctFailed}%`;

  const limit = parseInt(historyLimitFilter.value) || 10;
  const query = historySearchInput.value.toLowerCase().trim();
  const currentStatusFilter = window.historyStatusFilter || 'all';

  let filteredHistory = [...orderHistory];

  // Filter by status if selected
  if (currentStatusFilter !== 'all') {
    filteredHistory = filteredHistory.filter(item => {
      const st = String(item.status || '').toLowerCase();
      if (currentStatusFilter === 'success') return st === 'success';
      if (currentStatusFilter === 'pending') return st === 'pending' || st === 'processing' || st === 'in_process';
      if (currentStatusFilter === 'failed') return st === 'failed' || st === 'rejected' || st === 'error';
      return true;
    });
  }

  // Filter by search query (Service, IMEI, OrderID, Username)
  if (query) {
    filteredHistory = filteredHistory.filter(item => {
      const sId = String(item.serviceId || '').toLowerCase();
      const sName = String(item.serviceName || item.service || '').toLowerCase();
      const imei = String(item.imei || '').toLowerCase();
      const oId = String(item.orderId || '').toLowerCase();
      const uName = String(item.username || '').toLowerCase();
      return sId.includes(query) || sName.includes(query) || imei.includes(query) || oId.includes(query) || uName.includes(query);
    });
  }

  historyCount.textContent = filteredHistory.length;

  const colspanCount = authRole === 'admin' ? 7 : 6;
  const theadTr = document.querySelector('.reseller-history-table thead tr');
  if (theadTr) {
    if (authRole === 'admin') {
      theadTr.innerHTML = `
        <th style="min-width: 130px;">ORDEN</th>
        <th style="min-width: 220px;">SERVICIO / CATEGORÍA</th>
        <th>USUARIO</th>
        <th>DETALLES / IMEI</th>
        <th>ESTADO</th>
        <th style="min-width: 170px;">RESULTADO / CÓDIGO</th>
        <th>COSTO / MARGEN</th>
      `;
    } else {
      theadTr.innerHTML = `
        <th style="min-width: 130px;">ORDEN</th>
        <th style="min-width: 220px;">SERVICIO / CATEGORÍA</th>
        <th>DETALLES / IMEI</th>
        <th>ESTADO</th>
        <th style="min-width: 170px;">RESULTADO / CÓDIGO</th>
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

    const isWarranty = Boolean(
      item.isImported || 
      (item.serviceName && (item.serviceName.toLowerCase().includes('garant') || item.serviceName.toLowerCase().includes('importad'))) ||
      (item.notes && item.notes.toLowerCase().includes('garant'))
    );

    if (isWarranty) {
      trHeader.classList.add('history-row-imported');
    }

    // Determine category (IMEI, SERVER, REMOTE, GARANTÍA)
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
    if (isWarranty) {
      categoryClass = 'badge-category-imported';
      category = 'GARANTÍA';
    } else if (category === 'SERVER') {
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
    let rawString = String(item.statusText || item.msg || '');
    let strippedText = rawString.replace(/<br\s*\/?>/gi, ' ').replace(/<\/div>/gi, ' ').replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
    let displayCodeContent = strippedText;
    if (displayCodeContent.length > 55) {
      displayCodeContent = displayCodeContent.substring(0, 52) + '...';
    }

    const costValue = parseFloat(item.costCharged || item.costInCredits || 0);
    const isRefundedOrder = Boolean(item.isRefunded || item.status === 'failed' || item.status === 'rejected');
    
    let costDisplay = '';
    if (isWarranty) {
      costDisplay = `<span class="badge-zero-cost" title="Pedido de Garantía (No descuenta saldo)">$0.00 <span style="font-size: 0.65rem; opacity: 0.8;">(GARANTÍA)</span></span>`;
    } else if (isRefundedOrder) {
      costDisplay = `
        <div style="display: flex; flex-direction: column; align-items: flex-end; line-height: 1.2;">
          <strong class="order-cost-val" style="color: #ef4444; text-decoration: line-through; opacity: 0.85; font-size: 0.95rem;">$${costValue.toFixed(2)}</strong>
          <span style="color: #10b981; font-size: 0.68rem; font-weight: 700; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 4px; padding: 1px 4px; margin-top: 2px;">REEMBOLSADO</span>
        </div>
      `;
    } else {
      costDisplay = `<strong class="order-cost-val" style="color: #34d399;">$${costValue.toFixed(2)}</strong>`;
    }

    trHeader.innerHTML = `
      <td style="white-space: nowrap;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <button type="button" class="btn-expand-row" title="Clic para expandir">+</button>
          <div>
            <div class="product-id" title="ID de Orden: Clic para expandir detalles" style="font-weight: 700; font-size: 0.85rem; color: ${item.orderId ? 'var(--text-primary)' : 'var(--text-muted)'};">
              ${item.orderId ? escapeHtml(item.orderId) : '[Sin ID]'}
            </div>
            <span class="expand-hint-badge" title="Clic en la fila para ver detalles" style="margin-left: 0; margin-top: 2px;"><i data-lucide="chevron-down" style="width: 10px; height: 10px;"></i> Detalle</span>
          </div>
        </div>
      </td>
      <td>
        <div style="display: flex; flex-direction: column; gap: 3px; max-width: 250px;">
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <strong style="font-size: 0.86rem; color: var(--text-primary); line-height: 1.3;">${escapeHtml(item.serviceName || item.service || 'Servicio')}</strong>
            ${isWarranty ? `<span class="badge-warranty-tag" style="font-size: 0.65rem; padding: 1px 5px;"><i data-lucide="shield-check" style="width: 9px; height: 9px;"></i> GARANTÍA</span>` : ''}
          </div>
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span class="status-badge ${categoryClass}" style="padding: 0.12rem 0.45rem; font-size: 0.64rem; font-weight: 700; border-radius: 4px;">${category}</span>
            <span style="font-size: 0.72rem; color: var(--text-muted);">ID: ${escapeHtml(item.serviceId || 'N/A')}</span>
          </div>
        </div>
      </td>
      ${authRole === 'admin' ? `
      <td>
        <div style="font-size: 0.82rem; color: #a78bfa; font-weight: 600;">${escapeHtml(item.username || 'N/A')}</div>
      </td>
      ` : ''}
      <td>${displayImeiNum}</td>
      <td><span class="${statusClass}">${statusLabel}</span></td>
      <td>
        <div title="${escapeHtml(strippedText)}" style="font-family: 'Fira Code', monospace; font-size: 0.74rem; color: #94a3b8; max-width: 180px; max-height: 38px; overflow: hidden; text-overflow: ellipsis; white-space: normal; line-height: 1.25; background: rgba(0,0,0,0.35); padding: 0.3rem 0.5rem; border-radius: 5px; border: 1px solid rgba(255,255,255,0.06); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
          ${escapeHtml(displayCodeContent)}
        </div>
      </td>
      <td>
        ${authRole === 'admin' ? `
        <div style="display: flex; flex-direction: column; align-items: flex-end; line-height: 1.2;">
          ${costDisplay}
          <span style="font-size: 0.7rem; color: ${isWarranty ? '#94a3b8' : '#10b981'}; font-weight: 600; margin-top: 2px;">
            ${isWarranty ? 'Margen: $0.00' : 'Gan: +$' + parseFloat(item.profit || 0).toFixed(2)}
          </span>
        </div>
        ` : `
        ${costDisplay}
        `}
      </td>
    `;

    // Expandable details sub-row
    const trDetails = document.createElement('tr');
    trDetails.className = 'history-detail-row hidden';
    trDetails.id = `details_row_${item.id}`;
    trDetails.innerHTML = `
      <td colspan="${colspanCount}" class="history-detail-cell">
        <div class="order-card-details" style="padding: 1rem 0; overflow-y: auto;">
          ${isWarranty ? `
          <div style="margin-bottom: 0.85rem; padding: 0.6rem 0.85rem; border-radius: 8px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 8px; color: #fbbf24; font-size: 0.82rem; font-weight: 700;">
              <i data-lucide="shield-alert" style="width: 16px; height: 16px;"></i>
              <span>PEDIDO DE GARANTÍA / REEMPLAZO</span>
            </div>
            <span style="font-size: 0.75rem; color: #94a3b8;">No afecta tu balance de créditos ($0.00 MXN descontados).</span>
          </div>
          ` : ''}
          <div class="details-grid">
            <div class="details-col">
              <span class="detail-label">CANAL DE ORIGEN</span>
              <strong class="detail-val" style="display: flex; align-items: center; gap: 5px;">
                ${item.isApiBridge || item.source === 'API_BRIDGE' ? 
                  `<span style="color: #38bdf8; background: rgba(56, 189, 248, 0.15); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 0.75rem;"><i data-lucide="cpu" style="width: 11px; height: 11px; vertical-align: middle;"></i> API PUENTE</span>` : 
                  (isWarranty ? 'GARANTÍA / IMPORTADO' : '<span style="color: #a78bfa; background: rgba(167, 139, 250, 0.15); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(167, 139, 250, 0.3); font-size: 0.75rem;"><i data-lucide="globe" style="width: 11px; height: 11px; vertical-align: middle;"></i> WEB PANEL</span>')}
              </strong>
            </div>
            <div class="details-col">
              <span class="detail-label">DIRECCIÓN IP</span>
              <strong class="detail-val" style="font-family: 'Fira Code', monospace; color: #94a3b8;">${escapeHtml(item.ip || '127.0.0.1')}</strong>
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
                ${authRole === 'admin' ? `<button type="button" class="btn btn-sm btn-delete-single-order" style="background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.4); padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 0.3rem; font-weight: bold;" data-id="${item.id}" data-orderid="${item.orderId || ''}"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Eliminar</button>` : ''}
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
      if (e.target.closest('a') || e.target.closest('.btn-copy-raw') || e.target.closest('.btn-ticket') || e.target.closest('.btn-refund') || e.target.closest('.btn-delete-single-order')) {
        return; // Don't collapse if clicking buttons/links
      }
      
      const detailsRow = document.getElementById(`details_row_${item.id}`);
      const btnExpand = trHeader.querySelector('.btn-expand-row');
      const hintBadge = trHeader.querySelector('.expand-hint-badge');
      
      const isHidden = detailsRow.classList.contains('hidden');
      if (isHidden) {
        detailsRow.classList.remove('hidden');
        trHeader.classList.add('row-expanded');
        if (btnExpand) {
          btnExpand.textContent = '-';
          btnExpand.style.background = 'var(--status-offline)';
          btnExpand.style.color = '#fff';
          btnExpand.style.borderColor = 'var(--status-offline)';
        }
        if (hintBadge) {
          hintBadge.innerHTML = `<i data-lucide="chevron-up" style="width: 11px; height: 11px;"></i> Cerrar`;
          if (window.lucide) window.lucide.createIcons({ root: hintBadge });
        }
      } else {
        detailsRow.classList.add('hidden');
        trHeader.classList.remove('row-expanded');
        if (btnExpand) {
          btnExpand.textContent = '+';
          btnExpand.style.background = 'rgba(34, 211, 238, 0.1)';
          btnExpand.style.color = '#22d3ee';
          btnExpand.style.borderColor = 'rgba(34, 211, 238, 0.3)';
        }
        if (hintBadge) {
          hintBadge.innerHTML = `<i data-lucide="chevron-down" style="width: 11px; height: 11px;"></i> Detalle`;
          if (window.lucide) window.lucide.createIcons({ root: hintBadge });
        }
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

          // Remember user's preferred template for this specific service / product
          const serviceKey = String(item.serviceId || item.serviceName || item.service || 'default').trim();
          let savedTemplates = {};
          try {
            savedTemplates = JSON.parse(localStorage.getItem('dhru_ticket_templates') || '{}');
          } catch(e) {}

          const preferredTemplate = savedTemplates[serviceKey] || 'raw';
          if (ticketFormatType) {
            ticketFormatType.value = preferredTemplate;
          }

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

    // Delete Single Order Button Event Listener (Admin Only)
    const btnDeleteSingle = trDetails.querySelector('.btn-delete-single-order');
    if (btnDeleteSingle) {
      btnDeleteSingle.addEventListener('click', async () => {
        const orderIdentifier = item.orderId || item.id;
        const confirmMsg = `¿Eliminar la orden #${orderIdentifier} (${item.serviceName || 'Servicio'}) solo de tu historial?\n\nEsta acción quitará el registro del historial sin alterar créditos ni las demás órdenes.`;
        if (!confirm(confirmMsg)) return;

        btnDeleteSingle.disabled = true;
        btnDeleteSingle.innerHTML = 'Eliminando...';

        try {
          const targetId = encodeURIComponent(item.id || item.orderId);
          const res = await fetch(`/api/history/item/${targetId}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + authToken,
              'X-Server-Id': currentServerId
            }
          });
          const data = await res.json();
          if (res.ok && data.success) {
            if (typeof showToast === 'function') {
              showToast(`Orden #${orderIdentifier} eliminada del historial.`, 'success');
            } else {
              alert('Orden eliminada correctamente.');
            }
            // Eliminar localmente de orderHistory y re-renderizar
            orderHistory = orderHistory.filter(h => h.id !== item.id && String(h.orderId) !== String(item.orderId));
            renderOrderHistory();
          } else {
            alert(data.error || 'Error al eliminar la orden');
            btnDeleteSingle.disabled = false;
            btnDeleteSingle.innerHTML = '<i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Eliminar';
            if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
          }
        } catch (err) {
          alert('Error de conexión al eliminar la orden');
          btnDeleteSingle.disabled = false;
          btnDeleteSingle.innerHTML = '<i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Eliminar';
          if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        }
      });
    }
  });

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

function addOrderToHistory(orderRecord) {
  orderRecord.localUniqueId = 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  orderRecord.id = orderRecord.id || orderRecord.localUniqueId;
  orderRecord.serverId = currentServerId;
  if (!Array.isArray(orderHistory)) orderHistory = [];
  orderHistory.unshift(orderRecord);
  if (orderHistory.length > 500) {
    orderHistory.pop();
  }
  renderOrderHistory();
}

// Hook history limit and search filter listeners
historyLimitFilter.addEventListener('change', renderOrderHistory);
historySearchInput.addEventListener('input', renderOrderHistory);

// Status Quick Filter Pills click events
document.querySelectorAll('#historyStatusPills .status-pill').forEach(pill => {
  pill.addEventListener('click', (e) => {
    document.querySelectorAll('#historyStatusPills .status-pill').forEach(p => p.classList.remove('active'));
    e.currentTarget.classList.add('active');
    window.historyStatusFilter = e.currentTarget.dataset.status || 'all';

    // Sync box outline
    document.querySelectorAll('.order-stat-box').forEach(b => {
      b.classList.toggle('active-filter', b.dataset.filter === window.historyStatusFilter);
    });

    renderOrderHistory();
  });
});

// Order Stat Boxes click events (Exitosos, En Proceso, Fallidos)
document.querySelectorAll('.order-stat-box').forEach(box => {
  box.addEventListener('click', (e) => {
    const filter = e.currentTarget.dataset.filter;
    if (window.historyStatusFilter === filter) {
      window.historyStatusFilter = 'all';
    } else {
      window.historyStatusFilter = filter;
    }

    // Sync pills
    document.querySelectorAll('#historyStatusPills .status-pill').forEach(p => {
      p.classList.toggle('active', (p.dataset.status || 'all') === window.historyStatusFilter);
    });

    // Sync boxes
    document.querySelectorAll('.order-stat-box').forEach(b => {
      b.classList.toggle('active-filter', b.dataset.filter === window.historyStatusFilter);
    });

    renderOrderHistory();
  });
});

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
  if (!consoleCount || !consoleEmpty || !consoleList) return;
  
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
  if (!authToken) {
    alert("Debes iniciar sesión para hacer un pedido.");
    dashboardView.classList.add('hidden');
    loginView.classList.remove('hidden');
    return;
  }

  const product = productsList.find(p => p.serviceid.toString() === serviceId.toString());
  if (!product) return;

  const isFreeAllowed = !!(product.rawItem && (product.rawItem._ALLOW_FREE || product.rawItem._IS_FREE));
  const hasCustomPrice = product.rawItem && (product.rawItem._CUSTOM_RESELLER !== undefined || product.rawItem._CUSTOM_CLIENT !== undefined);
  const creditVal = parseFloat(product.credit) || 0;
  
  if (product.rawItem._NO_PRICE && !isFreeAllowed && !hasCustomPrice) {
    alert('Este servicio requiere confirmación de precio previa. Por favor haz clic en "Consultar" para contactar a soporte.');
    return;
  }

  if (creditVal <= 0 && !isFreeAllowed && !hasCustomPrice) {
    alert('Este servicio requiere confirmación de precio previa. Por favor haz clic en "Consultar" para contactar a soporte.');
    return;
  }

  selectedProductForOrder = product;

  modalServiceId.textContent = `ID: ${product.serviceid}`;
  modalServiceName.textContent = product.service;
  // Mostrar el grupo REAL del proveedor en el modal de pedido
  modalServiceGroup.textContent = product.originalGroup || (product.rawItem && product.rawItem._ORIGINAL_GROUP) || product.group || 'General';
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

  // Service Warning
  const modalServiceWarningBlock = document.getElementById('modalServiceWarningBlock');
  const modalServiceWarningText = document.getElementById('modalServiceWarningText');
  if (product.rawItem && product.rawItem._WARNING) {
    modalServiceWarningBlock.style.display = 'block';
    modalServiceWarningText.innerHTML = product.rawItem._WARNING;
  } else {
    modalServiceWarningBlock.style.display = 'none';
    modalServiceWarningText.innerHTML = '';
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

  let adminDisableHtml = '';
  if (authRole === 'admin') {
    adminDisableHtml = `<div style="margin-top: 10px; background: rgba(139,92,246,0.1); padding: 8px; border-radius: 6px; border: 1px dashed rgba(139,92,246,0.3); display: flex; align-items: center; justify-content: space-between;"><span style="color:#c4b5fd; font-size: 0.8rem;">[Admin] Ocultar IMEI</span><input type="checkbox" id="adminToggleImei" ${raw && raw._NO_IMEI ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;"></div>`;
  }

  if (raw && raw._NO_IMEI) {
    imeiInputGroup.classList.add('hidden');
    imeiInput.removeAttribute('required');
    imeiInput.removeAttribute('minlength');
    imeiInput.removeAttribute('maxlength');
    imeiAutoGenerate.checked = true;
  } else if (!hasCustomImeiName && (!needsImei || (raw && (raw.requires_imei === false || raw.requires_imei === '0' || raw['Requires.Imei'] === false || raw['Requires.Imei'] === '0' || raw['Requires.IMEI'] === '0')))) {
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
  imeiLabel.style = '';
  imeiInput.style.border = '';
  if (raw && (raw.IMEINAME || raw.CUSTOM_IMEI)) {
    const customName = raw.IMEINAME || raw.CUSTOM_IMEI;
    imeiLabel.innerHTML = `<span style="font-size: 1.2rem; color: #ef4444; font-weight: 900; background: rgba(239, 68, 68, 0.1); padding: 4px 8px; border-radius: 4px; display: inline-block;">⚠️ ${customName} *</span>`;
    imeiInput.placeholder = '👉 ¡ATENCIÓN! INGRESA ' + customName.toUpperCase() + ' AQUÍ 👈';
    imeiInput.style.border = '2px solid #ef4444';
  } else if (raw && raw.CUSTOM && raw.CUSTOM.customname) {
    const customName = raw.CUSTOM.customname;
    imeiLabel.innerHTML = `<span style="font-size: 1.2rem; color: #ef4444; font-weight: 900; background: rgba(239, 68, 68, 0.1); padding: 4px 8px; border-radius: 4px; display: inline-block;">⚠️ ${customName} *</span>`;
    imeiInput.placeholder = '👉 ¡ATENCIÓN! INGRESA ' + customName.toUpperCase() + ' AQUÍ 👈';
    imeiInput.style.border = '2px solid #ef4444';
  } else if (raw && raw.SERVICETYPE === 'IMEI' && (!raw.CUSTOM || !raw.CUSTOM.isalpha)) {
    imeiLabel.textContent = 'IMEI del Dispositivo *';
    imeiInput.placeholder = 'Ingresa el IMEI del equipo';
    imeiInput.removeAttribute('minlength');
    imeiInput.removeAttribute('maxlength');
  }
  
  // Apply Advanced validations if any
  imeiInput.removeAttribute('pattern'); // reset
  if (raw && raw.CUSTOM) {
    if (raw.CUSTOM.customlen) imeiInput.setAttribute('minlength', raw.CUSTOM.customlen);
    if (raw.CUSTOM.maxlength) imeiInput.setAttribute('maxlength', raw.CUSTOM.maxlength);
    if (raw.CUSTOM.regex) imeiInput.setAttribute('pattern', raw.CUSTOM.regex);
  }
  
  imeiAutoGenerate.dispatchEvent(new Event('change'));

  if (authRole === 'admin') {
    const headerDiv = document.querySelector('#purchaseModal .modal-header');
    let existingAdminToggle = document.getElementById('adminToggleImeiContainer');
    if (existingAdminToggle) existingAdminToggle.remove();
    
    if (adminDisableHtml) {
      const container = document.createElement('div');
      container.id = 'adminToggleImeiContainer';
      container.style.width = '100%';
      container.innerHTML = adminDisableHtml;
      headerDiv.appendChild(container);
      
      document.getElementById('adminToggleImei').addEventListener('change', async (e) => {
        try {
          if (e.target.checked) {
            imeiInputGroup.classList.add('hidden');
            imeiInput.removeAttribute('required');
            imeiInput.removeAttribute('minlength');
            imeiInput.removeAttribute('maxlength');
            imeiAutoGenerate.checked = true;
          } else {
            imeiInputGroup.classList.remove('hidden');
            imeiInput.setAttribute('required', 'true');
            imeiAutoGenerate.checked = false;
          }
          imeiAutoGenerate.dispatchEvent(new Event('change'));

          await fetch('/api/admin/disable-imei', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Server-Id': currentServerId,
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ serviceId: product.serviceid.toString(), disabled: e.target.checked })
          });
          syncProducts(false);
        } catch (err) {}
      });
    }
  }

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
  const custom_fields = {};
  document.querySelectorAll('.custom-field-input').forEach(input => {
    const name = input.getAttribute('data-fieldname');
    if (name) {
      custom_fields[name] = input.value.trim();
    }
  });

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
    // If a custom field provides a phone number, reference, or user ID, use it directly as IMEI/reference!
    const targetFieldKeys = ['numero', 'referencia', 'telefono', 'linea', 'celular', 'phone', 'number', 'ref', 'playerid', 'id'];
    const customKeys = Object.keys(custom_fields);
    const matchedKey = customKeys.find(k => targetFieldKeys.includes(k.toLowerCase().replace(/[^a-z0-9]/g, '')));
    const matchedVal = matchedKey ? String(custom_fields[matchedKey]).trim() : '';

    if (matchedVal && matchedVal.length <= 15) {
      imei = matchedVal;
      imeiDataString = matchedVal;
    } else {
      // Generate a valid 15-digit Luhn IMEI with a standard TAC (Apple iPhone 35301409)
      const tac = '35301409';
      let body = tac;
      while (body.length < 14) {
        body += Math.floor(Math.random() * 10).toString();
      }
      let luhnSum = 0;
      for (let i = 0; i < 14; i++) {
        let digit = parseInt(body.charAt(i), 10);
        if (i % 2 === 1) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        luhnSum += digit;
      }
      const checkDigit = (10 - (luhnSum % 10)) % 10;
      imei = body + checkDigit;
      imeiDataString = 'N/A';
    }
  }

  if (!authToken) {
    alert('Faltan sesión del portal. Inicia sesión nuevamente.');
    return;
  }

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

    closePurchaseModal();
    if (window.showToast) {
      window.showToast(`ID de Orden: #${orderId}\n${msg}`, 'success', '¡Pedido Realizado!');
    } else {
      alert(`¡Pedido Exitoso!\n\nID de Orden: ${orderId}\nMensaje: ${msg}`);
    }
    
    // Update credits immediately
    if (typeof updateAccountCredits === 'function') {
      updateAccountCredits();
    }

    // Navigate to history tab automatically
    tabHistory.click();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Start smart real-time pending poller immediately
    if (typeof startPendingOrdersPoller === 'function') {
      startPendingOrdersPoller();
    }

    // Trigger initial silent check after 2 seconds
    setTimeout(() => {
      if (typeof autoSyncHistory === 'function') {
        autoSyncHistory(true);
      }
    }, 2000);

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

function applyTicketSettings() {
  if (typeof customTicketSettings !== 'undefined' && customTicketSettings) {
    const dynamicLogo = document.getElementById('ticketDynamicLogo');
    const previewLogo = document.getElementById('configLogoPreview');
    if (dynamicLogo) {
      if (previewLogo && previewLogo.src && previewLogo.src.startsWith('data:image')) {
        // Use local base64 preview immediately for perfect sync
        dynamicLogo.src = previewLogo.src;
      } else if (customTicketSettings.logoExt) {
        dynamicLogo.src = `/logos/${authUserId}${customTicketSettings.logoExt}?t=${Date.now()}`;
      } else {
        dynamicLogo.src = 'logo.png';
      }
    }
    
    const fbWrapper = document.getElementById('ticketFbWrapper');
    const fbText = document.getElementById('ticketFbText');
    if (fbWrapper && fbText) {
      fbText.textContent = customTicketSettings.facebook || 'Mega Unlock Phone';
      fbWrapper.style.display = 'flex';
    }
    
    const waWrapper = document.getElementById('ticketWaWrapper');
    const waText = document.getElementById('ticketWaText');
    if (waWrapper && waText) {
      waText.textContent = customTicketSettings.whatsapp || '+52 2216936720';
      waWrapper.style.display = 'flex';
    }
    
    const resellerNode = document.getElementById('ticketResellerId');
    if (resellerNode) {
      const uId = (currentTicketData && currentTicketData.userId) || authUserId || localStorage.getItem('dhru_uid') || '';
      const brand = customTicketSettings.nombre || 'MegaUnlockPhone';
      if (uId) {
        resellerNode.innerHTML = `<span class="reseller-brand">${escapeHtml(brand)}</span><span class="reseller-badge">ID: ${escapeHtml(uId)}</span>`;
      } else {
        resellerNode.innerHTML = `<span class="reseller-brand">${escapeHtml(brand)}</span>`;
      }
    }
  }
}

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

const btnToggleTicketConfig = document.getElementById('btnToggleTicketConfig');
const ticketConfigGrid = document.getElementById('ticketConfigGrid');
const ticketConfigChevron = document.getElementById('ticketConfigChevron');
const btnResetTicketConfig = document.getElementById('btnResetTicketConfig');

if (btnToggleTicketConfig && ticketConfigGrid) {
  btnToggleTicketConfig.addEventListener('click', () => {
    if (ticketConfigGrid.style.display === 'none') {
      ticketConfigGrid.style.display = 'grid';
      if (ticketConfigChevron) ticketConfigChevron.style.transform = 'rotate(180deg)';
    } else {
      ticketConfigGrid.style.display = 'none';
      if (ticketConfigChevron) ticketConfigChevron.style.transform = 'rotate(0deg)';
    }
  });
}

if (btnResetTicketConfig) {
  btnResetTicketConfig.addEventListener('click', async () => {
    if (!confirm('¿Estás seguro de que quieres restablecer tus datos y eliminar tu logo?')) return;
    
    // Reset visual inputs to defaults
    const nameInput = document.getElementById('configNameInput');
    const waInput = document.getElementById('configWaInput');
    const fbInput = document.getElementById('configFbInput');
    const logoInput = document.getElementById('configLogoInput');
    const logoPreview = document.getElementById('configLogoPreview');
    const dynamicLogo = document.getElementById('ticketDynamicLogo');
    
    if (nameInput) nameInput.value = 'MegaUnlockPhone';
    if (waInput) waInput.value = '+52 2216936720';
    if (fbInput) fbInput.value = 'MegaUnlockPhone';
    if (logoInput) logoInput.value = '';
    if (logoPreview) {
      logoPreview.src = 'logo.png';
      logoPreview.style.display = 'none';
    }
    if (dynamicLogo) dynamicLogo.src = 'logo.png';
    
    // Send API request to clear everything
    try {
      if (window.MegaApp && window.MegaApp.Ticket && window.MegaApp.Ticket.state) {
        const token = window.MegaApp.Ticket.state.getAuthToken();
        await fetch('/api/ticket_config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            nombre: 'MegaUnlockPhone',
            whatsapp: '+52 2216936720',
            facebook: 'MegaUnlockPhone',
            clearLogo: true
          })
        });
        await window.MegaApp.Ticket.fetchTicketConfig();
        alert('Configuración restablecida por defecto.');
      }
    } catch (e) {
      console.error(e);
      alert('Error al restablecer la configuración.');
    }
  });
}

btnGenerateTicketFinal.addEventListener('click', async () => {
  if (!currentTicketData) return;
  
  // Set UI State to loading
  const originalBtnHTML = btnGenerateTicketFinal.innerHTML;
  btnGenerateTicketFinal.innerHTML = '<i data-lucide="loader" class="lucide-spin"></i><span>Generando...</span>';
  lucide.createIcons();
  btnGenerateTicketFinal.setAttribute('disabled', 'true');

  try {
    if (window.MegaApp && window.MegaApp.Ticket) await window.MegaApp.Ticket.saveTicketConfig();
    // Populate Template
    const title = String(currentTicketData.serviceName || 'UNLOCK TOOL').split('[')[0].trim();
    ticketTitle.textContent = title;

    const orderIdNode = document.getElementById('ticketOrderId');
    if (orderIdNode) {
      orderIdNode.textContent = `ID: #${currentTicketData.orderId || 'N/A'}`;
    }

    const dateTimeNode = document.getElementById('ticketDateTime');
    if (dateTimeNode) {
      // Fallback to timestamp if date is missing
      const fallbackDate = currentTicketData.timestamp ? new Date(currentTicketData.timestamp) : new Date();
      const orderDate = currentTicketData.date ? new Date(currentTicketData.date) : fallbackDate;
      dateTimeNode.textContent = `Fecha: ${orderDate.toLocaleString('es-MX')}`;
    }
    
    const serverNode = document.getElementById('ticketServerName');
    if (serverNode) {
      const sid = currentTicketData.serverId || currentServerId;
      serverNode.textContent = `Servidor: ${sid === '1' ? 'MEGA' : (sid === '2' ? 'ALPHA' : 'OMEGA')}`;
    }
    
    const resellerNode = document.getElementById('ticketResellerId');
    if (resellerNode) {
      const uId = currentTicketData.userId || authUserId || localStorage.getItem('dhru_uid') || 'N/A';
      const brand = customTicketSettings.nombre || (authRole === 'admin' ? 'ADMINISTRADOR' : 'MegaUnlockPhone');
      resellerNode.innerHTML = `<span class="reseller-brand">${escapeHtml(brand)}</span><span class="reseller-badge">ID: ${escapeHtml(uId)}</span>`;
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
    const ticketTemplateEl = document.getElementById('ticketTemplate');
    if (ticketTemplateEl) {
      ticketTemplateEl.classList.remove('template-minimal', 'template-vip', 'template-cyberpunk');
      if (formatType === 'minimal') ticketTemplateEl.classList.add('template-minimal');
      else if (formatType === 'vip') ticketTemplateEl.classList.add('template-vip');
      else if (formatType === 'cyberpunk') ticketTemplateEl.classList.add('template-cyberpunk');
    }

    // Save selection to remember for next time for this product
    if (currentTicketData) {
      const serviceKey = String(currentTicketData.serviceId || currentTicketData.serviceName || currentTicketData.service || 'default').trim();
      try {
        const savedTemplates = JSON.parse(localStorage.getItem('dhru_ticket_templates') || '{}');
        savedTemplates[serviceKey] = formatType;
        localStorage.setItem('dhru_ticket_templates', JSON.stringify(savedTemplates));
      } catch(e) {}
    }

    let rawText = String(currentTicketData.statusText || '');
    
    let cleanedRawText = rawText.replace(/<br\s*\/?>/gi, '\n')
                                .replace(/<\/div>/gi, '\n')
                                .replace(/<[^>]*>?/gm, '')
                                .replace(/\n\s*\n/g, '\n')
                                .trim();

    ticketRawTextVal.textContent = cleanedRawText;
    const ticketStreamingBox = document.getElementById('ticketStreamingBox');

    // Helper: Extraer pares Clave: Valor de las respuestas de las APIs
    function parseKeyValuesFromText(text) {
      const items = [];
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      
      for (const line of lines) {
        // Detectar si la línea tiene formato "Clave: Valor" o "Clave = Valor" o "Clave - Valor"
        const separatorIdx = line.indexOf(':');
        if (separatorIdx > 0 && separatorIdx < 45) {
          const k = line.substring(0, separatorIdx).trim();
          const v = line.substring(separatorIdx + 1).trim();
          if (k && v) {
            items.push({ key: k, value: v });
            continue;
          }
        }
        
        // Detectar si la clave y el valor están en líneas consecutivas (ej: "Usuario" en línea 1 y "correo@gmail.com" en línea 2)
        // Se manejará en el loop si no coincide con separador
        items.push({ raw: line });
      }
      return items;
    }

    if (formatType === 'raw' || formatType === 'minimal' || formatType === 'vip' || formatType === 'cyberpunk') {
      ticketParsedBox.classList.add('hidden');
      if (ticketStreamingBox) ticketStreamingBox.classList.add('hidden');
      ticketRawBox.classList.remove('hidden');
    } else if (formatType === 'license' || formatType === 'recharge' || formatType === 'streaming' || formatType === 'checker' || formatType === 'smart') {
      // Plantillas estructuradas de Acomodo de API basadas en las respuestas reales del servidor
      ticketParsedBox.classList.add('hidden');
      ticketRawBox.classList.add('hidden');
      if (ticketStreamingBox) {
        ticketStreamingBox.classList.remove('hidden');
        const boxTitle = ticketStreamingBox.querySelector('.ticket-box-title');
        if (boxTitle) {
          if (formatType === 'license') boxTitle.textContent = 'DETALLES DE ACTIVACIÓN / LICENCIA';
          else if (formatType === 'recharge') boxTitle.textContent = 'COMPROBANTE DE RECARGA / TRANSACCIÓN';
          else if (formatType === 'streaming') boxTitle.textContent = 'DETALLES DE LA CUENTA / SERVICIO';
          else if (formatType === 'checker') boxTitle.textContent = 'REPORTE Y DIAGNÓSTICO DEL DISPOSITIVO';
          else boxTitle.textContent = 'DETALLES DEL SERVICIO';
        }

        const container = document.getElementById('streamingFieldsContainer');
        container.innerHTML = '';
        
        let html = '';
        const lines = cleanedRawText.split('\n').map(l => l.trim()).filter(Boolean);
        const remainingNotes = [];

        // CASO 1: Formato especial de rentas: "12=✨toolrent54@gmail.com✨980064✨" o "Rentmart10✅KDJT4377"
        if (cleanedRawText.includes('✨') || (cleanedRawText.includes('✅') && !cleanedRawText.includes('\n'))) {
          const parts = cleanedRawText.split(/[✨✅=]+/).map(s => s.trim()).filter(Boolean);
          if (parts.length >= 2) {
            const userPart = parts.find(p => p.includes('@')) || parts[0];
            const passPart = parts.find(p => p !== userPart && p.length > 3) || parts[1];
            html += `
              <div class="ticket-field">
                <span class="ticket-label">Usuario / Login:</span>
                <span class="ticket-value" style="color: #38bdf8;">${escapeHtml(userPart)}</span>
              </div>
              <div class="ticket-field">
                <span class="ticket-label">Contraseña:</span>
                <span class="ticket-value" style="color: #f43f5e; font-weight: bold;">${escapeHtml(passPart)}</span>
              </div>
            `;
            container.innerHTML = html;
            return;
          }
        }

        // CASO 2: Enlace directo (PDF de Actas de Nacimiento o QR Mediafire)
        const isOnlyUrl = lines.length === 1 && (lines[0].startsWith('http://') || lines[0].startsWith('https://'));
        if (isOnlyUrl) {
          const url = lines[0];
          html += `
            <div style="text-align: center; padding: 0.5rem 0;">
              <span class="ticket-label" style="display: block; margin-bottom: 0.5rem; text-align: center;">DOCUMENTO / ENLACE GENERADO:</span>
              <a href="${escapeHtml(url)}" target="_blank" style="color: #38bdf8; font-family: monospace; word-break: break-all; text-decoration: underline; font-size: 0.85rem;">${escapeHtml(url)}</a>
            </div>
          `;
          container.innerHTML = html;
          return;
        }

        // CASO 3: Formato Clave: Valor (UnlockTool, Recargas, Free Fire, Chequeos GSX/T-Mobile)
        const hasColonLines = lines.filter(l => {
          const c = l.indexOf(':');
          return c > 0 && c < 45 && !l.startsWith('http:') && !l.startsWith('https:');
        });

        if (hasColonLines.length >= 2 || formatType === 'license' || formatType === 'recharge' || formatType === 'checker') {
          lines.forEach(line => {
            const colonPos = line.indexOf(':');
            const isHttp = line.startsWith('http:') || line.startsWith('https:');

            if (colonPos > 0 && colonPos < 45 && !isHttp) {
              const k = line.substring(0, colonPos).trim();
              const v = line.substring(colonPos + 1).trim();
              if (v) {
                // Coloración de valor según semántica
                let valColor = '#f8fafc';
                const lowerV = v.toLowerCase();
                if (lowerV.includes('success') || lowerV.includes('exitosa') || lowerV.includes('clean') || lowerV.includes('unlocked') || lowerV.includes('yes') || lowerV.includes('paid')) {
                  valColor = '#34d399';
                } else if (lowerV.includes('locked') || lowerV.includes('rejected') || lowerV.includes('expired') || lowerV.includes('no') || lowerV.includes('on')) {
                  valColor = '#f87171';
                } else if (lowerV.includes('@')) {
                  valColor = '#38bdf8';
                }

                html += `
                  <div class="ticket-field">
                    <span class="ticket-label">${escapeHtml(k)}:</span>
                    <span class="ticket-value" style="color: ${valColor}; overflow-wrap: break-word; word-break: normal; white-space: normal;">${escapeHtml(v)}</span>
                  </div>
                `;
                return;
              }
            } else if (line.toLowerCase().startsWith('unlocktool') || line.toLowerCase().startsWith('licencia') || line.toLowerCase().startsWith('paquete') || line.toLowerCase().startsWith('product:')) {
              html += `<div style="text-align: center; color: var(--accent); font-weight: bold; margin-bottom: 0.6rem; border-bottom: 1px dashed rgba(255,255,255,0.15); padding-bottom: 0.5rem; font-size: 1.05rem;">${escapeHtml(line)}</div>`;
              return;
            }
            remainingNotes.push(line);
          });
        } else {
          // CASO 4: Formato Streaming / Cuentas con bloques y líneas alternas
          let i = 0;
          let titleLines = [];
          while (i < lines.length && !['usuario', 'email', 'correo', 'contraseña', 'password', 'pass', 'pin', 'perfil'].includes(lines[i].toLowerCase())) {
            titleLines.push(lines[i]);
            i++;
          }
          if (titleLines.length > 0) {
            html += `<div style="text-align: center; color: var(--accent); font-weight: bold; margin-bottom: 0.5rem; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 0.5rem;">${escapeHtml(titleLines.join(' '))}</div>`;
          }
          
          while (i < lines.length) {
            const currentLine = lines[i];
            const lower = currentLine.toLowerCase();
            
            if (['usuario', 'email', 'correo', 'contraseña', 'password', 'pass', 'pin', 'perfil', 'garantía', 'garantia', 'vigencia', 'duracion'].includes(lower)) {
              const key = currentLine;
              const val = lines[i+1] || '';
              html += `
                <div class="ticket-field">
                  <span class="ticket-label">${escapeHtml(key)}:</span>
                  <span class="ticket-value" style="overflow-wrap: break-word; word-break: normal; white-space: normal; color: ${lower.includes('correo') || lower.includes('usuario') || lower.includes('email') ? '#38bdf8' : '#f8fafc'};">${escapeHtml(val)}</span>
                </div>
              `;
              i += 2;
            } else {
              remainingNotes.push(lines.slice(i).join('\n'));
              break;
            }
          }
        }

        if (remainingNotes.length > 0) {
          html += `
            <div style="margin-top: 0.5rem; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 0.5rem; display: flex; flex-direction: column; gap: 4px;">
              <span class="ticket-label" style="width: 100%; text-align: left;">Información Adicional:</span>
              <span class="ticket-value" style="width: 100%; text-align: left; white-space: pre-wrap; overflow-wrap: break-word; word-break: normal; font-size: 0.85rem; color: #10b981;">${escapeHtml(remainingNotes.join('\n'))}</span>
            </div>
          `;
        }

        container.innerHTML = html;
      }
    } else {
      // Formato 'parsed' clásico (USER & PASS)
      ticketParsedBox.classList.remove('hidden');
      if (ticketStreamingBox) ticketStreamingBox.classList.add('hidden');
      
      // Parse Credentials
      const creds = parseCredentials(currentTicketData.statusText);
      ticketUserVal.textContent = creds.user;
      ticketPassVal.textContent = creds.pass;

      if (ticketRawTextVal.textContent.trim()) {
        ticketRawBox.classList.remove('hidden');
      } else {
        ticketRawBox.classList.add('hidden');
      }
    }

    // Bring template to view momentarily
    applyTicketSettings();
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

// --- CUSTOM TICKET LOGIC ---
if (btnCustomTicket) {
  btnCustomTicket.addEventListener('click', () => {
    customTicketTitle.value = '';
    customTicketOrderId.value = '';
    customTicketRaw.value = '';
    customTicketUser.value = '';
    customTicketPass.value = '';
    customTicketPrice.value = '';
    customTicketFormat.value = 'raw';
    customTicketRawContainer.classList.remove('hidden');
    customTicketLoginContainer.classList.add('hidden');
    customTicketModal.classList.remove('hidden');
  });
}

if (btnCustomTicketClose) {
  btnCustomTicketClose.addEventListener('click', () => {
    customTicketModal.classList.add('hidden');
  });
}

if (btnCancelCustomTicket) {
  btnCancelCustomTicket.addEventListener('click', () => {
    customTicketModal.classList.add('hidden');
  });
}

if (customTicketFormat) {
  customTicketFormat.addEventListener('change', (e) => {
    if (e.target.value === 'login') {
      customTicketRawContainer.classList.add('hidden');
      customTicketLoginContainer.classList.remove('hidden');
    } else {
      customTicketRawContainer.classList.remove('hidden');
      customTicketLoginContainer.classList.add('hidden');
    }
  });
}

if (btnGenerateCustomTicket) {
  btnGenerateCustomTicket.addEventListener('click', async () => {
    const originalBtnHTML = btnGenerateCustomTicket.innerHTML;
    btnGenerateCustomTicket.innerHTML = '<i data-lucide="loader" class="lucide-spin"></i><span>Generando...</span>';
    lucide.createIcons();
    btnGenerateCustomTicket.setAttribute('disabled', 'true');

    try {
      if (window.MegaApp && window.MegaApp.Ticket) await window.MegaApp.Ticket.saveTicketConfig();
      const title = customTicketTitle.value.trim() || 'UNLOCK TOOL';
      ticketTitle.textContent = title;

      const orderIdNode = document.getElementById('ticketOrderId');
      if (orderIdNode) {
        const manualId = customTicketOrderId.value.trim();
        orderIdNode.textContent = `ID: #${manualId ? manualId : Math.floor(Math.random() * 90000) + 10000}`;
      }

      const dateTimeNode = document.getElementById('ticketDateTime');
      if (dateTimeNode) {
        dateTimeNode.textContent = `Fecha: ${new Date().toLocaleString('es-MX')}`;
      }
      
      const serverNode = document.getElementById('ticketServerName');
      if (serverNode) {
        serverNode.textContent = `Servidor: ${currentServerId === '1' ? 'MEGA' : (currentServerId === '2' ? 'ALPHA' : 'OMEGA')}`;
      }
      
      const resellerNode = document.getElementById('ticketResellerId');
      if (resellerNode && !customTicketSettings.nombre) {
        const brand = authRole === 'admin' ? 'ADMINISTRADOR' : 'MegaUnlockPhone';
        const uid = authUserId || 'N/A';
        resellerNode.innerHTML = `<span class="reseller-brand">${brand}</span><span class="reseller-badge">ID: ${escapeHtml(uid)}</span>`;
      }

      const price = customTicketPrice.value.trim();
      if (price && !isNaN(price)) {
        ticketPriceVal.textContent = parseFloat(price).toLocaleString('es-MX', { minimumFractionDigits: 2 });
        ticketPricePill.classList.remove('hidden');
      } else {
        ticketPricePill.classList.add('hidden');
      }

      const formatType = customTicketFormat.value;
      const ticketStreamingBox = document.getElementById('ticketStreamingBox');
      
      if (formatType === 'raw') {
        ticketParsedBox.classList.add('hidden');
        if (ticketStreamingBox) ticketStreamingBox.classList.add('hidden');
        
        let rawText = customTicketRaw.value.trim();
        ticketRawTextVal.textContent = rawText;
        if (rawText) {
           ticketRawBox.classList.remove('hidden');
        } else {
           ticketRawBox.classList.add('hidden');
        }
      } else if (formatType === 'login') {
        ticketRawBox.classList.add('hidden');
        if (ticketStreamingBox) ticketStreamingBox.classList.add('hidden');
        ticketParsedBox.classList.remove('hidden');
        
        ticketUserVal.textContent = customTicketUser.value.trim() || '---';
        ticketPassVal.textContent = customTicketPass.value.trim() || '---';
      }

      applyTicketSettings();
      ticketTemplateContainer.style.opacity = '1';

      const makeImagePromise = async () => {
        const blob = await htmlToImage.toBlob(ticketTemplate, {
          backgroundColor: '#111116',
          pixelRatio: 2,
          skipFonts: true,
          style: { transform: 'scale(1)', transformOrigin: 'top left' }
        });
        ticketTemplateContainer.style.opacity = '0';
        return blob;
      };
      
      const clipboardItem = new ClipboardItem({ 'image/png': makeImagePromise() });
      await navigator.clipboard.write([clipboardItem]);
      
      btnGenerateCustomTicket.innerHTML = '<i data-lucide="check"></i><span>¡Copiado!</span>';
      lucide.createIcons();
      
      // Cierra el modal de custom ticket y muestra el preview normal para que lo vean
      setTimeout(() => {
         btnGenerateCustomTicket.removeAttribute('disabled');
         btnGenerateCustomTicket.innerHTML = originalBtnHTML;
         lucide.createIcons();
         customTicketModal.classList.add('hidden');
         
         // Show Preview using ticketPreviewModal if available or standard ticketModal
         ticketModal.classList.remove('hidden');
         
         // Run makeImagePromise again just for the preview src
         htmlToImage.toBlob(ticketTemplate, { backgroundColor: '#111116', pixelRatio: 2, skipFonts: true })
           .then(blob => {
             const ticketPreviewContainer = document.getElementById('ticketPreviewContainer');
             const ticketPreviewImg = document.getElementById('ticketPreviewImg');
             if (ticketPreviewContainer && ticketPreviewImg) {
               ticketPreviewImg.src = URL.createObjectURL(blob);
               ticketPreviewContainer.classList.remove('hidden');
             }
           });
      }, 1500);
      
    } catch (clipboardErr) {
      console.error('Clipboard copy failed:', clipboardErr);
      alert('Copia exitosa, pero el navegador bloqueó el portapapeles. El ticket se mostrará en pantalla.');
      btnGenerateCustomTicket.removeAttribute('disabled');
      btnGenerateCustomTicket.innerHTML = originalBtnHTML;
      lucide.createIcons();
    }
  });
}

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
const btnClearCustomPrices = document.getElementById('btnClearCustomPrices');
const inputResellerTier1 = document.getElementById('inputResellerTier1');
const inputResellerTier2 = document.getElementById('inputResellerTier2');
const inputResellerTier3 = document.getElementById('inputResellerTier3');
const inputClientTier1 = document.getElementById('inputClientTier1');
const inputClientTier2 = document.getElementById('inputClientTier2');
const inputClientTier3 = document.getElementById('inputClientTier3');

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

// Función global para actualizar estado visual de vinculación del botón Bot WhatsApp
window.updateBotButtonStatus = function(isLinked) {
  if (!btnWhatsappBot) return;
  if (isLinked) {
    btnWhatsappBot.innerHTML = `
      <i data-lucide="message-circle" style="width: 14px; height: 14px;"></i>
      <span style="font-weight: 700;">BOT</span>
      <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 6px #22c55e;" title="WhatsApp Conectado"></span>
    `;
    btnWhatsappBot.style.background = 'rgba(34, 197, 94, 0.18)';
    btnWhatsappBot.style.borderColor = 'rgba(34, 197, 94, 0.45)';
    btnWhatsappBot.style.color = '#4ade80';
    btnWhatsappBot.title = 'MegaBOOT 2.0: Conectado a tu cuenta (Clic para ver info y comandos)';
  } else {
    btnWhatsappBot.innerHTML = `
      <i data-lucide="message-circle" style="width: 14px; height: 14px;"></i>
      <span style="font-weight: 700;">BOT</span>
      <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 6px #38bdf8;" title="WhatsApp Bot Activo"></span>
    `;
    btnWhatsappBot.style.background = 'rgba(14, 165, 233, 0.15)';
    btnWhatsappBot.style.borderColor = 'rgba(14, 165, 233, 0.4)';
    btnWhatsappBot.style.color = '#38bdf8';
    btnWhatsappBot.title = 'MegaBOOT 2.0: Clic para abrir chat y ver comandos';
  }
  if (window.lucide) window.lucide.createIcons();
};

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


if (btnAdminManage) {
  btnAdminManage.addEventListener('click', () => {
    if (tabAdmin) tabAdmin.click();
    const adminSection = document.getElementById('adminSection');
    if (adminSection) setTimeout(() => adminSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  });
}

btnCreateUserFormToggle.addEventListener('click', () => {
  createUserFormContainer.classList.toggle('hidden');
});

btnCancelCreateUser.addEventListener('click', () => {
  createUserFormContainer.classList.add('hidden');
  createUserForm.reset();
});

// Real-time polling for account balance and background sync
setInterval(() => {
  // If the user is on another tab or browser minimized, do not waste network & CPU cycles
  if (document.hidden) return;

  if (authToken) {
    updateAccountCredits();
    if (adminSection && !adminSection.classList.contains('hidden') && authRole === 'admin') {
       const settingsTab = document.getElementById('adminTabSettingsContent');
       const groupsTab = document.getElementById('adminTabGroupsContent');
       const isFormTabActive = (settingsTab && !settingsTab.classList.contains('hidden')) || (groupsTab && !groupsTab.classList.contains('hidden'));
       const hasExpandedRows = Boolean(document.querySelector('.admin-user-detail-row:not(.hidden)'));
       
       // Only refresh admin table if user is not actively typing, not in a form tab, and not inspecting an expanded user
       if (!isFormTabActive && !hasExpandedRows && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'SELECT') {
          loadAdminData();
       }
    }
    
    // Check catalog version and history version for real-time sync
    fetch('/api/status').then(r => r.json()).then(data => {
      if (data.version && data.version > localCatalogVersion) {
        localCatalogVersion = data.version;
        if (typeof window.clearFrontendCatalogCache === 'function') {
          window.clearFrontendCatalogCache();
        }
        if (!dashboardView.classList.contains('hidden')) {
          syncProducts(false); // Silent sync with fresh version
        }
      }
      if (data.historyVersion && data.historyVersion > localHistoryVersion) {
        localHistoryVersion = data.historyVersion;
        if (typeof fetchOrderHistory === 'function') {
          fetchOrderHistory();
        }
        if (typeof updateAccountCredits === 'function') {
          updateAccountCredits();
        }
        if (typeof fetchRecharges === 'function') {
          fetchRecharges();
        }
      }
    }).catch(e => {});
  }
}, 8000); // Smart sync polling every 8s (no F5 needed)

// When tab regains focus or visibility, perform immediate silent sync
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && authToken) {
    updateAccountCredits();
    if (typeof fetchOrderHistory === 'function') fetchOrderHistory();
    if (typeof fetchRecharges === 'function') fetchRecharges();
  }
});

async function fetchPublicSettings() {
  try {
    const res = await fetch('/api/public_settings');
    if (res.ok) {
      const data = await res.json();
      const marqueeImages = data.marqueeImages;
      if (marqueeImages) {
        const urls = marqueeImages.split(',').map(u => u.trim()).filter(Boolean);
        if (urls.length > 0) {
          const marquees = document.querySelectorAll('.header-marquee .marquee-item');
          marquees.forEach(item => {
            item.innerHTML = '';
            
            // Re-build array injecting logo.png between each URL
            let finalUrls = [];
            for (let i = 0; i < urls.length; i++) {
              finalUrls.push(urls[i]);
              if (i < urls.length - 1) {
                finalUrls.push('logo.png'); // Inject logo between images
              }
            }

            finalUrls.forEach((url, i) => {
              const img = document.createElement('img');
              img.src = url;
              img.alt = 'Logo ' + (i+1);
              
              if (url === 'logo.png') {
                 img.style.height = '42px';
                 img.style.width = '42px';
                 img.style.aspectRatio = '1 / 1';
                 img.style.objectFit = 'cover';
                 img.style.borderRadius = '50%';
                 img.style.border = '1px solid rgba(34, 211, 238, 0.6)';
                 img.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))';
              } else {
                 img.style.height = '38px';
                 img.style.width = 'auto';
                 img.style.objectFit = 'contain';
              }
              
              if (i > 0) img.style.marginLeft = '1.75rem';
              item.appendChild(img);
            });
          });
        }
      }
    }
  } catch (err) {
    console.error('Error fetching public settings:', err);
  }
}

// Run initial session check after all event listeners and initializers are attached
document.addEventListener('DOMContentLoaded', () => {
  if (window.initRechargeModule) window.initRechargeModule({ fetchUserData: updateAccountCredits });
  fetchPublicSettings();
  checkPersistedSession();
});
// End Wrapper Removed
