async function fetchOrderHistory() {
  if (!authToken) {
    const historyBody = document.getElementById('historyBody');
    if (historyBody) historyBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Debes iniciar sesión para ver tu historial.</td></tr>';
    const historyCount = document.getElementById('historyCount');
    if (historyCount) historyCount.textContent = '0';
    return;
  }
  try {
    const res = await fetch('/api/history', {
      headers: { 'X-Server-Id': currentServerId, 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) {
      orderHistory = await res.json();
      renderOrderHistory();

      const hasPending = Array.isArray(orderHistory) && orderHistory.some(o => o.status === 'pending' && o.orderId && o.orderId !== 'Error');
      if (hasPending) {
        startPendingOrdersPoller();
        autoSyncHistory(true); // Immediate background sync
      } else {
        stopPendingOrdersPoller();
      }
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
// ==========================================
// REGISTRATION & OTP LOGIC
// ==========================================
const btnShowRegister = document.getElementById('btnShowRegister');
const registerModalOverlay = document.getElementById('registerModalOverlay');
const btnRegisterClose = document.getElementById('btnRegisterClose');
const registerForm = document.getElementById('registerForm');
const regUsername = document.getElementById('regUsername');
const regPassword = document.getElementById('regPassword');
const regPhone = document.getElementById('regPhone');

const otpModalOverlay = document.getElementById('otpModalOverlay');
const otpForm = document.getElementById('otpForm');
const otpInput = document.getElementById('otpInput');
const otpDisplayPhone = document.getElementById('otpDisplayPhone');
let currentRegPhone = '';

if (btnShowRegister) {
  btnShowRegister.addEventListener('click', (e) => {
    e.preventDefault();
    registerModalOverlay.classList.remove('hidden');
  });
}

// --- FORGOT PASSWORD FLOW ---
if (btnShowForgotPassword) {
  btnShowForgotPassword.addEventListener('click', (e) => {
    e.preventDefault();
    fpUsername.value = '';
    fpCode.value = '';
    fpNewPassword.value = '';
    fpStep1.classList.remove('hidden');
    fpStep2.classList.add('hidden');
    forgotPasswordModal.classList.remove('hidden');
  });
}

if (btnCloseForgotPasswordModal) {
  btnCloseForgotPasswordModal.addEventListener('click', () => {
    forgotPasswordModal.classList.add('hidden');
  });
}

if (btnRequestRecoveryCode) {
  btnRequestRecoveryCode.addEventListener('click', async () => {
    const inputVal = fpUsername.value.trim();
    if (!inputVal) return showToast('Ingresa tu usuario o número de WhatsApp', 'error');

    const isDigits = /^\d{10,13}$/.test(inputVal.replace(/\D/g, ''));
    const payload = isDigits ? { phone: inputVal } : { username: inputVal };

    try {
      const res = await fetch(`${API_BASE_URL}/auth/request-recovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.success) {
        showToast(data.message, 'success');
        if (data.username) fpUsername.value = data.username;
        fpStep1.classList.add('hidden');
        fpStep2.classList.remove('hidden');
      } else {
        showToast(data.error || 'Error al solicitar código', 'error');
      }
    } catch (err) {
      showToast('Error de red al conectar con el servidor', 'error');
    }
  });
}

if (btnResetPassword) {
  btnResetPassword.addEventListener('click', async () => {
    const username = fpUsername.value.trim();
    const code = fpCode.value.trim();
    const newPassword = fpNewPassword.value.trim();

    if (!code || !newPassword) return showToast('Llena todos los campos', 'error');

    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, code, newPassword })
      });
      const data = await res.json();
      
      if (data.success) {
        showToast(data.message, 'success');
        forgotPasswordModal.classList.add('hidden');
        // Auto fill login form
        usernameInput.value = username;
        passwordInput.value = '';
        passwordInput.focus();
      } else {
        showToast(data.error || 'Error al restablecer contraseña', 'error');
      }
    } catch (err) {
      showToast('Error de red', 'error');
    }
  });
}

if (btnRegisterClose) {
  btnRegisterClose.addEventListener('click', () => {
    registerModalOverlay.classList.add('hidden');
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = regUsername.value.trim();
    const p = regPassword.value.trim();
    const pConfirm = document.getElementById('regPasswordConfirm').value.trim();
    const ph = regPhone.value.trim();
    const email = document.getElementById('regEmail').value.trim();
    
    if (p !== pConfirm) {
      alert('Las contraseñas no coinciden. Intenta de nuevo.');
      return;
    }

    const btn = document.getElementById('btnRegisterSubmit');
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="icon-spin"></i> Procesando...`;
    if (window.lucide) window.lucide.createIcons();

    try {
      const data = await window.ApiHelpers.register(u, p, ph, email);
      currentRegPhone = data.phone;
      otpDisplayPhone.textContent = data.phone;
      registerModalOverlay.classList.add('hidden');
      otpModalOverlay.classList.remove('hidden');
    } catch (err) {
      alert(err.message || 'Error al registrar.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="send"></i> Enviar Código por WhatsApp`;
      if (window.lucide) window.lucide.createIcons();
    }
  });
}

if (otpForm) {
  otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = otpInput.value.trim();
    const btn = document.getElementById('btnOtpSubmit');
    btn.disabled = true;
    btn.textContent = 'Verificando...';

    try {
      const data = await window.ApiHelpers.verifyOtp(currentRegPhone, code);
      
      // Success! Log them in
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
      otpModalOverlay.classList.add('hidden');
      loginView.classList.add('hidden');
      dashboardView.classList.remove('hidden');
      
      const btnLoginTop = document.getElementById('btnLoginTop');
      if (btnLoginTop) btnLoginTop.classList.add('hidden');
      
      initDashboard();
      updateSliderUI();
      alert(`¡Registro exitoso! Bienvenido ${authUsername}.`);
    } catch (err) {
      alert(err.message || 'Error al verificar el código.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Verificar y Entrar';
    }
  });
}

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
    const data = await window.ApiHelpers.login(username, password, currentServerId);
    
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
    if (window.clearFrontendCatalogCache) window.clearFrontendCatalogCache();

    loginView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    
    if (data.weakPassword) {
      setTimeout(() => {
        alert('⚠️ ATENCIÓN: Tu contraseña actual es muy débil o no cumple con los nuevos estándares de seguridad (mínimo 6 caracteres, una mayúscula y sin secuencias obvias). Por tu seguridad, te recomendamos cambiarla cuanto antes.');
      }, 500);
    }
    btnLogout.classList.remove('hidden');
    
    const btnLoginTop = document.getElementById('btnLoginTop');
    if (btnLoginTop) btnLoginTop.classList.add('hidden');

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
    if (window.MegaApp && window.MegaApp.Ticket) window.MegaApp.Ticket.fetchTicketConfig();
    
  } catch (err) {
    // El módulo ApiHelpers ya lanza un error limpio o el de la red
    alert(err.message || 'Error de red al iniciar sesión');
  }
});

// --- TICKET CONFIG LOGIC ---
if (window.MegaApp && window.MegaApp.Ticket) {
  window.MegaApp.Ticket.init({
    elements: {
      configNameInput: document.getElementById('configNameInput'),
      configWaInput: document.getElementById('configWaInput'),
      configFbInput: document.getElementById('configFbInput'),
      configLogoPreview: document.getElementById('configLogoPreview'),
      configLogoInput: document.getElementById('configLogoInput')
    },
    state: {
      getAuthToken: () => authToken,
      getAuthUserId: () => authUserId,
      getSettings: () => customTicketSettings,
      setSettings: (s) => customTicketSettings = s
    }
  });
}

// Setup back button
btnBackToCategories.addEventListener('click', () => {
  if (typeof globalProductSearch !== 'undefined' && globalProductSearch) {
    globalProductSearch.value = '';
  }
  if (typeof showCategoriesView === 'function') {
    showCategoriesView();
  } else if (categoriesGrid && productsBody) {
    categoriesGrid.classList.remove('hidden');
    productsBody.classList.add('hidden');
    btnBackToCategories.classList.add('hidden');
    if (catalogTitle) catalogTitle.textContent = 'Catálogo de Productos';
  }
});

// Setup Tabs
tabCatalog.addEventListener('click', () => {
  tabCatalog.classList.add('active');
  tabHistory.classList.remove('active');
  if (tabAdmin) tabAdmin.classList.remove('active');
  productsSection.classList.remove('hidden');
  const rechargeSection = document.getElementById('rechargeSection');
  if (rechargeSection) rechargeSection.classList.add('hidden');
  historySection.classList.add('hidden');
  if (adminSection) adminSection.classList.add('hidden');
  if (typeof rechargesSection !== 'undefined' && rechargesSection) rechargesSection.classList.add('hidden');
  
  // Cleanly return to main categories view
  if (typeof showCategoriesView === 'function') {
    showCategoriesView();
  } else if (categoriesGrid && productsBody) {
    categoriesGrid.classList.remove('hidden');
    productsBody.classList.add('hidden');
    if (btnBackToCategories) btnBackToCategories.classList.add('hidden');
    if (catalogTitle) catalogTitle.textContent = 'Catálogo de Productos';
  }
});

tabHistory.addEventListener('click', () => {
  tabHistory.classList.add('active');
  tabCatalog.classList.remove('active');
  if (tabAdmin) tabAdmin.classList.remove('active');
  historySection.classList.remove('hidden');
  const rechargeSection = document.getElementById('rechargeSection');
  if (rechargeSection) rechargeSection.classList.add('hidden');
  productsSection.classList.add('hidden');
  if (adminSection) adminSection.classList.add('hidden');
  if (typeof rechargesSection !== 'undefined' && rechargesSection) rechargesSection.classList.add('hidden');
  fetchOrderHistory(); // Refresh history every time the tab is opened
  setTimeout(() => historySection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
});

if (tabAdmin) {
  tabAdmin.addEventListener('click', async () => {
    tabAdmin.classList.add('active');
    tabCatalog.classList.remove('active');
    tabHistory.classList.remove('active');
    adminSection.classList.remove('hidden');
  const rechargeSection = document.getElementById('rechargeSection');
  if (rechargeSection) rechargeSection.classList.add('hidden');
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
  if (window.clearFrontendCatalogCache) window.clearFrontendCatalogCache();
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
    const currentPwd = document.getElementById('inputCurrentPasswordPwd').value;
    const pwd = inputNewPassword.value;
    const pwdConfirm = document.getElementById('inputConfirmNewPassword').value;
    
    if (!currentPwd) return alert('Debes ingresar tu contraseña actual.');
    if (!pwd || pwd.length < 6 || !/[A-Z]/.test(pwd)) return alert('La contraseña debe tener al menos 6 caracteres y una mayúscula.');
    if (pwd !== pwdConfirm) return alert('Las contraseñas nuevas no coinciden.');
    
    try {
      const res = await fetch(`/api/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: pwd })
      });
      if (res.ok) {
        alert('¡Contraseña actualizada con éxito!');
        document.getElementById('inputCurrentPasswordPwd').value = '';
        inputNewPassword.value = '';
        document.getElementById('inputConfirmNewPassword').value = '';
      } else {
        const err = await res.json();
        alert('Error: ' + err.error);
      }
    } catch (err) {
      alert('Error de conexión.');
    }
  });
}

const btnSaveNewPhone = document.getElementById('btnSaveNewPhone');
const inputNewPhone = document.getElementById('inputNewPhone');
if (btnSaveNewPhone) {
  btnSaveNewPhone.addEventListener('click', async () => {
    const currentPwd = document.getElementById('inputCurrentPasswordPhone').value;
    const phone = inputNewPhone.value;
    
    if (!currentPwd) return alert('Debes ingresar tu contraseña actual.');
    if (!phone) return alert('Por favor ingresa tu número.');
    
    try {
      const res = await fetch(`/api/change-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ currentPassword: currentPwd, newPhone: phone })
      });
      if (res.ok) {
        alert('¡WhatsApp actualizado con éxito!');
        document.getElementById('inputCurrentPasswordPhone').value = '';
        inputNewPhone.value = '';
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
if (btnClearConsole) {
  btnClearConsole.addEventListener('click', () => {
    consoleLogList = [];
    renderConsoleLogs();
  });
}

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

let pendingOrdersPollTimer = null;
let isSyncingPending = false;

function startPendingOrdersPoller() {
  if (pendingOrdersPollTimer) return;

  const checkPending = async () => {
    if (!authToken || isSyncingPending) return;

    const hasLocalPending = Array.isArray(orderHistory) && orderHistory.some(o => o.status === 'pending' && o.orderId && o.orderId !== 'Error');
    if (!hasLocalPending) {
      stopPendingOrdersPoller();
      return;
    }

    isSyncingPending = true;
    try {
      const res = await fetch('/api/orders/sync-pending', {
        method: 'POST',
        headers: {
          'X-Server-Id': currentServerId,
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.history && Array.isArray(data.history)) {
          orderHistory = data.history;
          renderOrderHistory();
        }
        if (typeof updateAccountCredits === 'function') {
          updateAccountCredits();
        }
        if (data.updated && data.count > 0) {
          if (window.showToast) {
            window.showToast(`Se actualizaron ${data.count} pedidos en tiempo real.`, 'success', 'Pedido Actualizado');
          }
        }
        if (data.remainingPending === 0) {
          stopPendingOrdersPoller();
        }
      }
    } catch (e) {
      console.warn('Pending orders poll error:', e);
    } finally {
      isSyncingPending = false;
    }
  };

  pendingOrdersPollTimer = setInterval(checkPending, 8000);
}

function stopPendingOrdersPoller() {
  if (pendingOrdersPollTimer) {
    clearInterval(pendingOrdersPollTimer);
    pendingOrdersPollTimer = null;
  }
}

window.startPendingOrdersPoller = startPendingOrdersPoller;
window.stopPendingOrdersPoller = stopPendingOrdersPoller;

async function autoSyncHistory(silent = false) {
  if (!authToken) {
    if (!silent) {
      if (window.showToast) window.showToast('Faltan credenciales en la sesión.', 'warning');
      else alert('Faltan credenciales en la sesión.');
    }
    return;
  }

  const pendingOrders = Array.isArray(orderHistory) ? orderHistory.filter(o => o.status === 'pending' && o.orderId && o.orderId !== 'Error') : [];
  if (pendingOrders.length === 0) {
    if (!silent) {
      if (window.showToast) window.showToast('No hay pedidos pendientes por sincronizar en el historial.', 'info');
      else alert('No hay pedidos pendientes por sincronizar en el historial.');
    }
    return;
  }

  if (!silent && btnSyncHistory) {
    btnSyncHistory.setAttribute('disabled', 'true');
    const span = btnSyncHistory.querySelector('span');
    if (span) span.textContent = 'Sincronizando...';
    const icon = btnSyncHistory.querySelector('svg');
    if (icon) icon.classList.add('icon-spin');
  }

  try {
    const res = await fetch('/api/orders/sync-pending', {
      method: 'POST',
      headers: {
        'X-Server-Id': currentServerId,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (res.status === 401) {
      if (!silent) alert('Sesión caducada (401). Por favor, vuelve a iniciar sesión.');
      if (typeof logout === 'function') logout();
      return;
    }

    if (res.ok) {
      const data = await res.json();
      if (data.history && Array.isArray(data.history)) {
        orderHistory = data.history;
        renderOrderHistory();
      }
      if (typeof updateAccountCredits === 'function') {
        updateAccountCredits();
      }

      if (!silent) {
        if (data.updated && data.count > 0) {
          if (window.showToast) window.showToast(`Sincronización completada. Se actualizaron ${data.count} pedidos.`, 'success');
          else alert(`Sincronización completada. Se actualizaron ${data.count} pedidos.`);
        } else {
          if (window.showToast) window.showToast('Sincronización completada. No hubo cambios en los estados.', 'info');
          else alert('Sincronización completada. No hubo cambios en los estados de los pedidos.');
        }
      } else if (data.updated && data.count > 0) {
        if (window.showToast) window.showToast(`Se actualizaron ${data.count} pedidos automáticamente.`, 'success');
      }

      if (data.remainingPending > 0) {
        startPendingOrdersPoller();
      } else {
        stopPendingOrdersPoller();
      }
    }
  } catch (err) {
    console.error('Error in autoSyncHistory:', err);
    if (!silent) {
      if (window.showToast) window.showToast('Error de conexión al sincronizar.', 'error');
    }
  } finally {
    if (!silent && btnSyncHistory) {
      btnSyncHistory.removeAttribute('disabled');
      const span = btnSyncHistory.querySelector('span');
      if (span) span.textContent = 'Sincronizar Pedidos';
      const icon = btnSyncHistory.querySelector('svg');
      if (icon) icon.classList.remove('icon-spin');
    }
  }
}

// Update Account Credits

// Password Live Validation
function bindPasswordValidation(pwdInputId, confirmInputId, prefix, btnSubmitId) {
  const pwdInput = document.getElementById(pwdInputId);
  const confirmInput = document.getElementById(confirmInputId);
  const btnSubmit = document.getElementById(btnSubmitId);
  if (!pwdInput || !confirmInput || !btnSubmit) return;

  const chkLength = document.getElementById(`${prefix}ChkLength`);
  const chkUpper = document.getElementById(`${prefix}ChkUpper`);
  const chkSeq = document.getElementById(`${prefix}ChkSeq`);
  const chkMatch = document.getElementById(`${prefix}ChkMatch`);

  function updateCheck(el, isValid, text) {
    if (!el) return;
    if (isValid) {
      el.style.color = '#10b981'; // green
      el.innerHTML = `<i data-lucide="check-circle" style="width:12px; height:12px; color: #10b981; margin-right: 4px; display: inline-block; vertical-align: text-bottom;"></i> ` + text;
    } else {
      el.style.color = '#64748b'; // default
      el.innerHTML = `<i data-lucide="x-circle" style="width:12px; height:12px; color: #ef4444; margin-right: 4px; display: inline-block; vertical-align: text-bottom;"></i> ` + text;
    }
    if (window.lucide) window.lucide.createIcons({ root: el });
  }

  function validate() {
    const val = pwdInput.value;
    const confirmVal = confirmInput.value;
    
    const validLength = val.length >= 6;
    const validUpper = /[A-Z]/.test(val);
    const validSeq = val.length > 0 && !/(.)\1{2,}/.test(val) && !/123|234|345|456|567|678|789|890|098|987|876|765|654|543|432|321/.test(val);
    const validMatch = val.length > 0 && val === confirmVal;
    
    updateCheck(chkLength, validLength, 'Mínimo 6 caracteres');
    updateCheck(chkUpper, validUpper, 'Al menos 1 mayúscula');
    updateCheck(chkSeq, validSeq, 'Sin repeticiones obvias (111, 123)');
    updateCheck(chkMatch, validMatch, 'Las contraseñas coinciden');

    if (validLength && validUpper && validSeq && validMatch) {
      btnSubmit.removeAttribute('disabled');
    } else {
      btnSubmit.setAttribute('disabled', 'true');
    }
  }

  pwdInput.addEventListener('input', validate);
  confirmInput.addEventListener('input', validate);
  
  // initial validation
  validate();
}

function initPasswordValidation() {
  bindPasswordValidation('regPassword', 'regPasswordConfirm', 'reg', 'btnRegisterSubmit');
  bindPasswordValidation('inputNewPassword', 'inputConfirmNewPassword', 'prof', 'btnSaveNewPassword');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(initPasswordValidation, 500));
} else {
  setTimeout(initPasswordValidation, 500);
}
