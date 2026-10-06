// Sychronize Products implementation
async function syncProducts(shouldPersist = false) {
  // Capture the server ID we are syncing for!
  const targetServerId = currentServerId;

  setLoadingState(true);
  updateStatus('loading', 'Sincronizando...');
  
  const loadingOverlay = document.getElementById('globalLoadingOverlay');
  if (loadingOverlay) {
      loadingOverlay.classList.remove('hidden');
      lucide.createIcons(); // ensure the icon renders inside the modal
  }

  try {
    let data;
    
    // Use frontend cache if we aren't forcing a sync
    const cachedEntry = frontendCatalogCache[targetServerId];
    const isCacheValid = cachedEntry && (Date.now() - cachedEntry.timestamp < 15 * 60 * 1000);
    
    if (!shouldPersist && isCacheValid) {
      data = cachedEntry.data;
    } else {
      const url = shouldPersist ? `/api/products?forceSync=true&serverId=${targetServerId}` : `/api/products?serverId=${targetServerId}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'X-Server-Id': targetServerId,
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });

      data = await response.json();

      if (data.error_msg) {
          alert(data.error_msg);
          setLoadingState(false);
          if (document.getElementById('globalLoadingOverlay')) document.getElementById('globalLoadingOverlay').classList.add('hidden');
          updateStatus('offline', 'Error API');
          return;
      }

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

    // Yield to the event loop so the browser can render the loading overlay
    await new Promise(resolve => setTimeout(resolve, 50));
    renderProducts(productsList);

    // Restore view if user was inside a category or search
    if (q) {
      // Re-trigger the global search to update results for the new server
      globalProductSearch.dispatchEvent(new Event('input'));
    } else if (wasViewingProducts) {
      if (prevTitle === 'Resultados de Búsqueda') {
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
    if (document.getElementById('globalLoadingOverlay')) document.getElementById('globalLoadingOverlay').classList.add('hidden');

  } catch (err) {
    console.error(err);
    showError(err.message);
    updateStatus('offline', 'Error de conexión');
    setLoadingState(false);
    if (document.getElementById('globalLoadingOverlay')) document.getElementById('globalLoadingOverlay').classList.add('hidden');
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

// Search logic extracted to searchEngine.js
if (window.SearchEngine) {
  window.SearchEngine.init({
    elements: {
      btnAdvancedSearch,
      globalProductSearch,
      filterServiceSelect,
      filterTypeSelect,
      filterGroupSelect,
      productsBody,
      categoriesGrid,
      btnBackToCategories,
      catalogTitle,
      productCount,
      tsInstances
    },
    callbacks: {
      renderProductCards,
      renderProducts,
      populateGroupsFilter,
      syncTomSelect
    },
    getProducts: () => productsList
  });
}

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
          <form class="custom-price-form" data-id="${escapeHtml(p.serviceid)}" style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: end; width: 100%;">
            <div class="input-group" style="margin-bottom: 0; min-width: 0;">
              <label style="font-size: 0.75rem; margin-bottom: 3px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Precio Reseller</label>
              <input type="number" step="0.01" class="custom-reseller-input admin-price-input" data-id="${escapeHtml(p.serviceid)}" data-type="reseller" value="${p.rawItem._CUSTOM_RESELLER !== undefined ? escapeHtml(p.rawItem._CUSTOM_RESELLER) : ''}" placeholder="${escapeHtml(p.credit)}" style="padding: 6px; font-size: 0.85rem; width: 100%; box-sizing: border-box;" required>
            </div>
            <div class="input-group" style="margin-bottom: 0; min-width: 0;">
              <label style="font-size: 0.75rem; margin-bottom: 3px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Precio Cliente</label>
              <input type="number" step="0.01" class="custom-client-input admin-price-input" data-id="${escapeHtml(p.serviceid)}" data-type="client" value="${p.rawItem._CUSTOM_CLIENT !== undefined ? escapeHtml(p.rawItem._CUSTOM_CLIENT) : ''}" placeholder="${escapeHtml(p.rawItem._CLIENT_PRICE || '0')}" style="padding: 6px; font-size: 0.85rem; width: 100%; box-sizing: border-box;" required>
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
          
          <h4 style="margin-top: 15px; margin-bottom: 10px; color: #ef4444; font-size: 0.9rem; display: flex; align-items: center; gap: 5px;">
            <i data-lucide="alert-triangle" style="width: 14px; height: 14px;"></i> Advertencia de Servicio
          </h4>
          <button type="button" class="btn btn-secondary btn-admin-warning" data-id="${escapeHtml(p.serviceid)}" data-title="${escapeHtml(p.service)}" data-warning="${escapeHtml(p.rawItem._WARNING || '')}" style="width: 100%; display: flex; justify-content: center; align-items: center; gap: 6px; font-size: 0.85rem; padding: 8px; border-color: rgba(239,68,68,0.3); color: #fca5a5;">
            <i data-lucide="edit-2" style="width: 16px; height: 16px;"></i> Gestionar Advertencia
          </button>
        </div>
      `;
    }
    
    const card = document.createElement('div');
    card.className = 'product-card' + (p.rawItem._DISABLED ? ' disabled-card' : '');
    
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

    document.querySelectorAll('.btn-admin-warning').forEach(btn => {
      btn.addEventListener('click', () => {
        const serviceId = btn.getAttribute('data-id');
        const warningContentText = btn.getAttribute('data-warning');
        openWarningModal(serviceId, warningContentText);
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

