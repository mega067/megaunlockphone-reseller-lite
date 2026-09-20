/**
 * Search Engine Module
 * Handles all search and filtering logic for the product catalog.
 */

window.SearchEngine = {
  currentSearchResults: [],
  config: null,
  
  init: function(config) {
    this.config = config;
    this.bindEvents();
    window.showAllSearchResults = this.showAllSearchResults.bind(this);
  },

  getProducts: function() {
    return this.config.getProducts();
  },

  bindEvents: function() {
    const { 
      btnAdvancedSearch, 
      globalProductSearch, 
      filterServiceSelect, 
      filterTypeSelect, 
      filterGroupSelect,
      tsInstances
    } = this.config.elements;

    // Handle Search Button Click
    if (btnAdvancedSearch) {
      btnAdvancedSearch.addEventListener('click', () => {
        let typeFilter = window.lastSelectedType || filterTypeSelect.value || 'all';
        let groupFilter = window.lastSelectedGroup || filterGroupSelect.value || 'all';
        let serviceIdFilter = window.lastSelectedServiceId || filterServiceSelect.value || '';
        
        const globalSearchQuery = globalProductSearch ? globalProductSearch.value.toLowerCase().trim() : '';
        
        let filtered = this.getProducts();

        // Global search input overrides filters if typed
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
        
        this.renderResults(filtered, `Resultados (T:${typeFilter} G:${groupFilter})`);
      });
    }

    // Handle direct Service selection trigger
    if (filterServiceSelect) {
      filterServiceSelect.addEventListener('change', (e) => { 
        window.lastSelectedServiceId = e.target ? e.target.value : filterServiceSelect.value;
        if (filterServiceSelect.value !== '') {
           btnAdvancedSearch.click();
        }
      });
    }

    // Handle Global Text Search (debounce)
    if (globalProductSearch) {
      let searchTimeout;
      globalProductSearch.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          const q = e.target.value.toLowerCase().trim();
          if (q === '') {
             // Reset to initial state
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
               this.config.callbacks.populateGroupsFilter('all');
             }
             if (filterServiceSelect) {
               filterServiceSelect.innerHTML = '<option value="">Seleccione un grupo primero...</option>';
               if (tsInstances[filterServiceSelect.id]) {
                  tsInstances[filterServiceSelect.id].destroy();
                  tsInstances[filterServiceSelect.id] = null;
               }
               this.config.callbacks.syncTomSelect(filterServiceSelect);
             }
             this.config.callbacks.renderProducts(this.getProducts());
             return;
          }
          const queryWords = q.split(/\s+/);
          let filtered = this.getProducts().filter(p => {
             const searchString = (String(p.service) + " " + String(p.serviceid) + " " + (p.group || "")).toLowerCase();
             return queryWords.every(word => searchString.includes(word));
          });
          
          // Sort by relevance (exact matches first)
          filtered.sort((a, b) => {
             const strA = (String(a.service) + " " + String(a.serviceid)).toLowerCase();
             const strB = (String(b.service) + " " + String(b.serviceid)).toLowerCase();
             const exactA = strA.includes(q) ? 1 : 0;
             const exactB = strB.includes(q) ? 1 : 0;
             return exactB - exactA;
          });
          
          this.renderResults(filtered, `Resultados para "${q}"`);
        }, 300);
      });
    }
  },

  renderResults: function(filtered, titleStr) {
    const { productsBody, categoriesGrid, btnBackToCategories, catalogTitle, productCount } = this.config.elements;
    
    this.currentSearchResults = filtered;
    window.currentSearchResults = filtered; // Backwards compatibility if used elsewhere
    
    if (filtered.length === 0) {
      productsBody.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <i data-lucide="search-code"></i>
          <h3>No se encontraron productos</h3>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    } else {
      let truncated = false;
      let combined = filtered;
      if (combined.length > 50) {
        combined = combined.slice(0, 50);
        truncated = true;
      }
      
      this.config.callbacks.renderProductCards(combined);
      
      if (truncated) {
        const warningHtml = `
          <div id="search-truncated-warning" style="grid-column: 1 / -1; text-align: center; margin-top: 1rem; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
            <p style="color: var(--text-secondary); margin-bottom: 0.75rem; font-size: 0.95rem;">Mostrando los primeros 50 resultados de ${filtered.length} encontrados.</p>
            <button type="button" class="btn btn-primary" onclick="window.showAllSearchResults()" style="font-size: 0.85rem; padding: 8px 16px;">
              <i data-lucide="list"></i> Mostrar todos los resultados
            </button>
          </div>
        `;
        productsBody.insertAdjacentHTML('beforeend', warningHtml);
        if (window.lucide) window.lucide.createIcons();
      }
    }
    
    if (productCount) {
      productCount.textContent = filtered.length;
    }

    if (categoriesGrid) categoriesGrid.classList.add('hidden');
    if (productsBody) productsBody.classList.remove('hidden');
    if (btnBackToCategories) btnBackToCategories.classList.remove('hidden');
    if (catalogTitle) catalogTitle.textContent = titleStr;
  },

  showAllSearchResults: function() {
    if (this.currentSearchResults && this.currentSearchResults.length > 0) {
        this.config.callbacks.renderProductCards(this.currentSearchResults);
        const warning = document.getElementById('search-truncated-warning');
        if (warning) warning.remove();
    }
  }
};
