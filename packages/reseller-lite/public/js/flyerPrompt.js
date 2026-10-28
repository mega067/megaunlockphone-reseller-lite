// public/js/flyerPrompt.js
// Generador Profesional de Prompts para Flyers con IA (Gemini / Imagen 3)
// Especializado para MegaUnlockPhone México - Tuxpan Veracruz

(function() {
  window.MegaApp = window.MegaApp || {};

  const FlyerPromptGen = {
    selectedProducts: [],
    
    init() {
      this.bindEvents();
    },

    bindEvents() {
      // Abrir modal desde botón del navbar
      const btnFlyerGen = document.getElementById('btnFlyerPromptGen');
      const modal = document.getElementById('flyerPromptModal');
      const btnClose = document.getElementById('btnCloseFlyerPromptModal');

      if (btnFlyerGen && modal) {
        btnFlyerGen.addEventListener('click', () => {
          this.openModal();
        });
      }

      if (btnClose && modal) {
        btnClose.addEventListener('click', () => {
          modal.classList.add('hidden');
        });
      }

      // Cerrar al dar click fuera del contenido
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.classList.add('hidden');
          }
        });
      }

      // Buscador dinámico de productos
      const searchInput = document.getElementById('flyerProductSearchInput');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.handleSearch(e.target.value);
        });
      }

      // Botón limpiar selección
      const btnClear = document.getElementById('btnClearFlyerSelection');
      if (btnClear) {
        btnClear.addEventListener('click', () => {
          this.selectedProducts = [];
          this.renderSelectedProducts();
          this.generatePrompt();
        });
      }

      // Cambiar formato de imagen
      const aspectRatioSelect = document.getElementById('flyerAspectRatio');
      if (aspectRatioSelect) {
        aspectRatioSelect.addEventListener('change', () => {
          this.generatePrompt();
        });
      }

      // Cambiar tipo de tarifa global (Minorista vs Reseller vs Personalizado)
      const priceTypeSelect = document.getElementById('flyerPriceType');
      if (priceTypeSelect) {
        priceTypeSelect.addEventListener('change', () => {
          const val = priceTypeSelect.value;
          if (val === 'retail' || val === 'reseller') {
            this.applyGlobalTariff(val);
          } else {
            this.renderSelectedProducts();
            this.generatePrompt();
          }
        });
      }

      // Copiar prompt al portapapeles
      const btnCopy = document.getElementById('btnCopyFlyerPrompt');
      if (btnCopy) {
        btnCopy.addEventListener('click', () => {
          this.copyPromptToClipboard();
        });
      }

      // Cargar defaults (UnlockTool + TSM)
      const btnDefaults = document.getElementById('btnApplyFlyerDefaults');
      if (btnDefaults) {
        btnDefaults.addEventListener('click', () => {
          this.loadDefaultBundle();
        });
      }
    },

    openModal() {
      const modal = document.getElementById('flyerPromptModal');
      if (!modal) return;
      modal.classList.remove('hidden');

      // Si no hay productos seleccionados, sugerir o cargar bundle inicial
      if (this.selectedProducts.length === 0) {
        this.loadDefaultBundle();
      } else {
        this.renderSelectedProducts();
        this.generatePrompt();
      }

      // Inicializar búsqueda
      this.handleSearch('');
      if (window.lucide) window.lucide.createIcons();
    },

    getAllProducts() {
      // 1. Si window.productsList está cargado
      if (window.productsList && Array.isArray(window.productsList) && window.productsList.length > 0) {
        return window.productsList;
      }
      // 2. Si MegaApp.State tiene la lista
      if (window.MegaApp && window.MegaApp.State && Array.isArray(window.MegaApp.State.productsList) && window.MegaApp.State.productsList.length > 0) {
        return window.MegaApp.State.productsList;
      }
      // 3. Si existe catálogo en frontendCatalogCache (de cualquier servidor 1, 2 o 3)
      if (typeof frontendCatalogCache === 'object' && frontendCatalogCache !== null) {
        for (const k in frontendCatalogCache) {
          const entry = frontendCatalogCache[k];
          if (entry && entry.data && Array.isArray(entry.data.SUCCESS)) {
            const listObj = entry.data.SUCCESS[0]?.LIST;
            if (listObj) {
              const extracted = [];
              for (const gk in listObj) {
                const grp = listObj[gk];
                const gName = grp.GROUPNAME || gk;
                if (grp.SERVICES && typeof grp.SERVICES === 'object') {
                  for (const sid in grp.SERVICES) {
                    const item = grp.SERVICES[sid];
                    extracted.push({
                      serviceid: item.SERVICEID || sid,
                      service: item.SERVICENAME || item.SERVICE || 'Sin nombre',
                      group: item._CUSTOM_GROUP || gName,
                      originalGroup: item._ORIGINAL_GROUP || gName,
                      credit: item.CREDIT || '0.00',
                      time: item.TIME || 'N/A',
                      rawItem: item
                    });
                  }
                }
              }
              if (extracted.length > 0) return extracted;
            }
          }
        }
      }
      return [];
    },

    handleSearch(query) {
      const container = document.getElementById('flyerProductSearchResults');
      if (!container) return;

      const rawQ = (query || '').trim();
      const q = rawQ.toLowerCase();
      const all = this.getAllProducts();

      // Si aún no hay catálogo cargado en memoria, avisar al usuario
      if (all.length === 0) {
        container.innerHTML = `<div style="color: #cbd5e1; font-size: 0.8rem; padding: 12px; text-align: center;">Cargando catálogo de productos... Si tarda, cambia de servidor o espera un segundo.</div>`;
        return;
      }

      // Filtrar los primeros 30 que coincidan por ID exacto, parcial o nombre/grupo
      const filtered = all.filter(p => {
        if (!q) return true;
        const sid = String(p.serviceid || '').toLowerCase();
        const rawSid = String(p.rawItem?.SERVICEID || '').toLowerCase();
        const sName = String(p.service || '').toLowerCase();
        const sGroup = String(p.group || '').toLowerCase();

        return sid === q || rawSid === q || sid.includes(q) || rawSid.includes(q) || sName.includes(q) || sGroup.includes(q);
      }).slice(0, 30);

      if (filtered.length === 0) {
        container.innerHTML = `<div style="color: #64748b; font-size: 0.8rem; padding: 12px; text-align: center;">No se encontraron servicios con "${escapeHtml(rawQ)}"</div>`;
        return;
      }

      container.innerHTML = filtered.map(p => {
        const raw = p.rawItem || {};
        const clientPrice = parseFloat(raw._CLIENT_PRICE) || 0;
        const resellerPrice = parseFloat(raw._RESELLER_COST || p.credit) || 0;
        const isSelected = this.selectedProducts.some(sp => String(sp.serviceid) === String(p.serviceid));

        return `
          <div style="display: flex; justify-content: space-between; align-items: center; background: ${isSelected ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.03)'}; border: 1px solid ${isSelected ? '#38bdf8' : 'rgba(255,255,255,0.05)'}; padding: 6px 10px; border-radius: 6px; font-size: 0.8rem;">
            <div style="flex: 1; min-width: 0; padding-right: 8px;">
              <div style="color: #fff; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.service}</div>
              <div style="color: #94a3b8; font-size: 0.72rem; display: flex; gap: 8px;">
                <span>ID: ${p.serviceid}</span>
                <span style="color: #f472b6; font-weight: bold;">🛒 Minorista: $${clientPrice > 0 ? clientPrice.toFixed(2) : resellerPrice.toFixed(2)} MXN</span>
                <span style="color: #38bdf8;">💼 Reseller: $${resellerPrice.toFixed(2)} MXN</span>
                <span>⏱️ ${p.time || 'Inmediato'}</span>
              </div>
            </div>
            <button type="button" class="btn btn-small ${isSelected ? 'btn-danger' : 'btn-primary'}" onclick="MegaApp.FlyerPrompt.toggleProduct('${p.serviceid}')" style="font-size: 0.72rem; padding: 3px 8px; white-space: nowrap;">
              ${isSelected ? 'Quitar' : '+ Agregar'}
            </button>
          </div>
        `;
      }).join('');
    },

    toggleProduct(serviceId) {
      const all = this.getAllProducts();
      const prod = all.find(p => String(p.serviceid) === String(serviceId));
      if (!prod) return;

      const idx = this.selectedProducts.findIndex(p => String(p.serviceid) === String(serviceId));
      if (idx >= 0) {
        this.selectedProducts.splice(idx, 1);
      } else {
        const raw = prod.rawItem || {};
        const clientPrice = parseFloat(raw._CLIENT_PRICE) || 0;
        const resellerPrice = parseFloat(raw._RESELLER_COST || prod.credit) || 0;
        
        this.selectedProducts.push({
          serviceid: prod.serviceid,
          service: prod.service,
          group: prod.group,
          retailPrice: clientPrice > 0 ? clientPrice : resellerPrice,
          resellerPrice: resellerPrice,
          chosenType: 'retail', // 'retail', 'reseller', o 'custom'
          customPrice: null,
          time: prod.time || 'Inmediato',
          rawItem: raw
        });
      }

      this.renderSelectedProducts();
      this.generatePrompt();
      const searchInput = document.getElementById('flyerProductSearchInput');
      this.handleSearch(searchInput ? searchInput.value : '');
    },

    addProductDirect(serviceId) {
      const all = this.getAllProducts();
      const prod = all.find(p => String(p.serviceid) === String(serviceId));
      if (!prod) return;

      if (!this.selectedProducts.some(p => String(p.serviceid) === String(serviceId))) {
        const raw = prod.rawItem || {};
        const clientPrice = parseFloat(raw._CLIENT_PRICE) || 0;
        const resellerPrice = parseFloat(raw._RESELLER_COST || prod.credit) || 0;
        
        this.selectedProducts.push({
          serviceid: prod.serviceid,
          service: prod.service,
          group: prod.group,
          retailPrice: clientPrice > 0 ? clientPrice : resellerPrice,
          resellerPrice: resellerPrice,
          chosenType: 'retail',
          customPrice: null,
          time: prod.time || 'Inmediato',
          rawItem: raw
        });
      }

      this.openModal();
    },

    setProductPriceType(serviceId, type) {
      const p = this.selectedProducts.find(item => String(item.serviceid) === String(serviceId));
      if (!p) return;
      p.chosenType = type;
      this.renderSelectedProducts();
      this.generatePrompt();
    },

    setProductCustomPrice(serviceId, customVal) {
      const p = this.selectedProducts.find(item => String(item.serviceid) === String(serviceId));
      if (!p) return;
      const val = parseFloat(customVal);
      if (!isNaN(val) && val >= 0) {
        p.customPrice = val;
        p.chosenType = 'custom';
      }
      this.generatePrompt();
    },

    loadDefaultBundle() {
      const all = this.getAllProducts();
      this.selectedProducts = [];

      // Buscar las opciones de UnlockTool y TSM calibradas en el catálogo
      const keywords = [
        'unlocktool 6h', 'unlocktool 3 meses', 'unlocktool 6 meses', 'unlocktool 12 meses',
        'tsm 3h', 'tsm 6h', 'tsm 3 meses', 'tsm 6 meses', 'tsm 12 meses'
      ];

      keywords.forEach(kw => {
        const match = all.find(p => (p.service || '').toLowerCase().includes(kw));
        if (match && !this.selectedProducts.some(sp => sp.serviceid === match.serviceid)) {
          const raw = match.rawItem || {};
          const clientPrice = parseFloat(raw._CLIENT_PRICE) || 0;
          const resellerPrice = parseFloat(raw._RESELLER_COST || match.credit) || 0;
          this.selectedProducts.push({
            serviceid: match.serviceid,
            service: match.service,
            group: match.group,
            retailPrice: clientPrice > 0 ? clientPrice : resellerPrice,
            resellerPrice: resellerPrice,
            chosenType: 'retail',
            customPrice: null,
            time: match.time || 'Inmediato',
            rawItem: raw
          });
        }
      });

      // Si por alguna razón el catálogo no tiene esas palabras clave aún cargadas en memoria, inyectar el preset estándar
      if (this.selectedProducts.length === 0) {
        this.selectedProducts = [
          { serviceid: 'UT-6H', service: 'UnlockTool Renta 6 Horas', retailPrice: 50, resellerPrice: 25, chosenType: 'retail' },
          { serviceid: 'UT-3M', service: 'UnlockTool Licencia 3 Meses', retailPrice: 399, resellerPrice: 350, chosenType: 'retail' },
          { serviceid: 'UT-6M', service: 'UnlockTool Licencia 6 Meses', retailPrice: 666, resellerPrice: 580, chosenType: 'retail' },
          { serviceid: 'UT-12M', service: 'UnlockTool Licencia 12 Meses', retailPrice: 1050, resellerPrice: 940, chosenType: 'retail' },
          { serviceid: 'TSM-3H', service: 'TSM Tool Renta 3 Horas', retailPrice: 50, resellerPrice: 20, chosenType: 'retail' },
          { serviceid: 'TSM-6H', service: 'TSM Tool Renta 6 Horas', retailPrice: 70, resellerPrice: 32, chosenType: 'retail' },
          { serviceid: 'TSM-3M', service: 'TSM Tool Licencia 3 Meses', retailPrice: 680, resellerPrice: 590, chosenType: 'retail' },
          { serviceid: 'TSM-6M', service: 'TSM Tool Licencia 6 Meses', retailPrice: 975, resellerPrice: 850, chosenType: 'retail' },
          { serviceid: 'TSM-12M', service: 'TSM Tool Licencia 12 Meses', retailPrice: 1289, resellerPrice: 1150, chosenType: 'retail' }
        ];
      }

      this.renderSelectedProducts();
      this.generatePrompt();
    },

    renderSelectedProducts() {
      const container = document.getElementById('flyerSelectedList');
      const countEl = document.getElementById('flyerSelectedCount');
      const globalPriceTypeEl = document.getElementById('flyerPriceType');
      const globalType = globalPriceTypeEl ? globalPriceTypeEl.value : 'manual';
      if (!container) return;

      if (countEl) {
        countEl.textContent = `${this.selectedProducts.length} seleccionados`;
      }

      if (this.selectedProducts.length === 0) {
        container.innerHTML = `<span style="font-size: 0.8rem; color: #64748b;">No has seleccionado productos. Elige arriba o pulsa en cualquier tarjeta de la web.</span>`;
        return;
      }

      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
          ${this.selectedProducts.map((p, idx) => {
            const activeType = p.chosenType || 'retail';
            let effectiveVal = p.retailPrice;
            if (activeType === 'reseller') effectiveVal = p.resellerPrice;
            else if (activeType === 'custom' && p.customPrice !== null) effectiveVal = p.customPrice;

            return `
              <div style="background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(56,189,248,0.3); border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 0.8rem;">
                <div style="flex: 1; min-width: 0;">
                  <div style="color: #fff; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.service}</div>
                  <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 2px;">
                    Base minorista: <strong style="color: #f472b6;">$${p.retailPrice.toFixed(0)}</strong> | Base reseller: <strong style="color: #38bdf8;">$${p.resellerPrice.toFixed(0)}</strong>
                  </div>
                </div>

                <!-- Selectores de Precio por Item -->
                <div style="display: flex; align-items: center; gap: 6px;">
                  <button type="button" onclick="MegaApp.FlyerPrompt.setProductPriceType('${p.serviceid}', 'retail')" style="background: ${activeType === 'retail' ? '#ec4899' : 'rgba(255,255,255,0.06)'}; color: ${activeType === 'retail' ? '#fff' : '#cbd5e1'}; border: 1px solid ${activeType === 'retail' ? '#ec4899' : 'rgba(255,255,255,0.1)'}; border-radius: 4px; padding: 3px 8px; font-size: 0.72rem; cursor: pointer; font-weight: 600;">
                    🛒 Minorista ($${p.retailPrice.toFixed(0)})
                  </button>
                  <button type="button" onclick="MegaApp.FlyerPrompt.setProductPriceType('${p.serviceid}', 'reseller')" style="background: ${activeType === 'reseller' ? '#0284c7' : 'rgba(255,255,255,0.06)'}; color: ${activeType === 'reseller' ? '#fff' : '#cbd5e1'}; border: 1px solid ${activeType === 'reseller' ? '#0284c7' : 'rgba(255,255,255,0.1)'}; border-radius: 4px; padding: 3px 8px; font-size: 0.72rem; cursor: pointer; font-weight: 600;">
                    💼 Reseller ($${p.resellerPrice.toFixed(0)})
                  </button>
                  
                  <!-- Input Precio Manual -->
                  <div style="display: flex; align-items: center; background: #090e17; border: 1px solid ${activeType === 'custom' ? '#10b981' : 'rgba(255,255,255,0.15)'}; border-radius: 4px; padding: 1px 4px;">
                    <span style="font-size: 0.72rem; color: #10b981; font-weight: bold;">$</span>
                    <input type="number" step="1" value="${effectiveVal.toFixed(0)}" onchange="MegaApp.FlyerPrompt.setProductCustomPrice('${p.serviceid}', this.value)" style="width: 58px; background: transparent; border: none; color: #fff; font-size: 0.75rem; font-weight: bold; padding: 2px 4px; outline: none;" title="Precio personalizado para este flyer">
                  </div>

                  <button type="button" onclick="MegaApp.FlyerPrompt.toggleProduct('${p.serviceid}')" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 2px 6px; font-weight: bold; font-size: 1rem;" title="Eliminar de anuncio">✕</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    },

    applyGlobalTariff(type) {
      if (!type) return;
      this.selectedProducts.forEach(p => {
        p.chosenType = type;
      });
      this.renderSelectedProducts();
      this.generatePrompt();
    },

    generatePrompt() {
      const promptEl = document.getElementById('flyerGeneratedPrompt');
      const ratioEl = document.getElementById('flyerAspectRatio');
      const ratio = ratioEl ? ratioEl.value : '3:4';
      const priceTypeEl = document.getElementById('flyerPriceType');
      const priceType = priceTypeEl ? priceTypeEl.value : 'custom';

      if (!promptEl) return;

      // Agrupar items y formatear según la tarifa individual elegida para cada uno
      const productLines = this.selectedProducts.map(p => {
        const activeType = p.chosenType || 'retail';
        let priceVal = p.retailPrice;
        let badge = '(Minorista)';
        if (activeType === 'reseller') {
          priceVal = p.resellerPrice;
          badge = '(Precio Mayorista / Reseller)';
        } else if (activeType === 'custom' && p.customPrice !== null) {
          priceVal = p.customPrice;
          badge = '(Oferta Especial)';
        }

        return `- ${p.service}: $${priceVal.toFixed(0)} MXN ${badge} (Entrega Automática / Inmediata)`;
      }).join('\n');

      const tariffHeader = priceType === 'reseller' 
        ? 'TABLA DE PRECIOS EXCLUSIVOS RESELLER / MAYORISTA' 
        : (priceType === 'retail' ? 'LISTA DE PRECIOS AL PÚBLICO / MINORISTA' : 'TABLA DE PRECIOS Y OFERTAS EXCLUSIVAS');

      const fullPrompt = 
`Genera una imagen publicitaria de calidad ultra premium y comercial (Cyberpunk / Modern High-Tech Style) con relación de aspecto ${ratio}.

TEMÁTICA Y MARCA:
- Empresa: MegaUnlockPhone México (Servidor GSM & Licencias Oficiales)
- Ubicación / Origen: Tuxpan, Veracruz, México
- WhatsApp Oficial de Soporte y Activaciones: +52 221 693 6720
- Enlace Web Oficial: https://megaunlockphone-panel.alwaysdata.net/

ELEMENTOS VISUALES PRINCIPALES:
1. Encabezado Impactante: "MEGAUNLOCKPHONE - LICENCIAS & RENTAS OFICIALES AL INSTANTE".
2. Mostrar cajas 3D hiperrealistas de software profesional (UnlockTool, AMT Android Multi Tool y/o las herramientas listadas), con iluminación de borde neón (cian #00ffff, magenta #ec4899 y azul eléctrico) sobre un fondo tecnológico oscuro con sutiles circuitos brillantes y chispas de luz.
3. ${tariffHeader} Claramente Legible (renderizado con tipografía moderna, limpia, nítida y perfectamente contrastada):
${productLines}
4. Badges de Confianza y Pagos:
   - "Aceptamos: Mercado Pago, Transferencias SPEI, OXXO, Tarjetas Débito y Crédito"
   - "Activación Inmediata 24/7 Automatizada"
   - "Soporte Técnico Especializado vía WhatsApp"

⚠️ REGLAS ESTRICTAS DE SEGURIDAD PARA EL CÓDIGO QR Y TEXTO (CRÍTICO):
1. NO DIBUJES NINGÚN CÓDIGO QR, NI PATRONES DE PÍXELES DE QR FALSOS NI TEXTURAS DE CÓDIGOS DE BARRAS. Los modelos de IA no generan hashes matemáticos escaneables y producen códigos rotos.
2. EN SU LUGAR, RESERVA UN RECUADRO TOTALMENTE VACÍO CON BORDES DE LUZ NEÓN CIAN PARA MONTAJE POSTERIOR.
3. MEDIDAS Y UBICACIÓN EXACTA DEL RECUADRO VACÍO:
   - Posición: Esquina inferior izquierda del afiche.
   - Dimensiones exactas del recuadro interior: 190x190 píxeles.
   - Margen exterior: 40 píxeles desde el borde izquierdo y 40 píxeles desde el borde inferior.
   - El interior del cuadro DEBE SER UN FONDO NEGRO O TRANSLÚCIDO COMPLETAMENTE LIMPIO, sin ninguna ilustración dentro, para permitir superponer el código QR real mediante software de diseño o script automatizado sin deformaciones.
4. Junto al recuadro vacío, incluye la leyenda con tipografía nítida: "ESCANEA PARA COMPRAR DIRECTO EN LA WEB".
5. No inventes URLs extrañas. Si incluyes el texto de la web, escribe únicamente: "megaunlockphone-panel.alwaysdata.net".`;

      promptEl.value = fullPrompt;
    },

    copyPromptToClipboard() {
      const promptEl = document.getElementById('flyerGeneratedPrompt');
      if (!promptEl || !promptEl.value) return;

      navigator.clipboard.writeText(promptEl.value).then(() => {
        if (window.showToast) {
          window.showToast('¡Prompt copiado al portapapeles con éxito!', 'success');
        } else {
          alert('¡Prompt copiado al portapapeles!');
        }
      }).catch(err => {
        promptEl.select();
        document.execCommand('copy');
        if (window.showToast) {
          window.showToast('Prompt copiado.', 'info');
        }
      });
    }
  };

  window.MegaApp.FlyerPrompt = FlyerPromptGen;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FlyerPromptGen.init());
  } else {
    FlyerPromptGen.init();
  }
})();
