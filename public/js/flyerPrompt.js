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
      if (window.productsList && Array.isArray(window.productsList) && window.productsList.length > 0) {
        return window.productsList;
      }
      if (window.MegaApp && window.MegaApp.State && Array.isArray(window.MegaApp.State.productsList)) {
        return window.MegaApp.State.productsList;
      }
      return [];
    },

    handleSearch(query) {
      const container = document.getElementById('flyerProductSearchResults');
      if (!container) return;

      const q = (query || '').toLowerCase().trim();
      const all = this.getAllProducts();

      // Filtrar los primeros 25 que coincidan
      const filtered = all.filter(p => {
        const idMatch = String(p.serviceid).includes(q);
        const nameMatch = (p.service || '').toLowerCase().includes(q);
        const groupMatch = (p.group || '').toLowerCase().includes(q);
        return !q || idMatch || nameMatch || groupMatch;
      }).slice(0, 25);

      if (filtered.length === 0) {
        container.innerHTML = `<div style="color: #64748b; font-size: 0.8rem; padding: 8px; text-align: center;">No se encontraron servicios con "${query}"</div>`;
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
          time: prod.time || 'Inmediato',
          rawItem: raw
        });
      }

      this.openModal();
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
            time: match.time || 'Inmediato',
            rawItem: raw
          });
        }
      });

      // Si por alguna razón el catálogo no tiene esas palabras clave aún cargadas en memoria, inyectar el preset estándar
      if (this.selectedProducts.length === 0) {
        this.selectedProducts = [
          { serviceid: 'UT-6H', service: 'UnlockTool Renta 6 Horas', retailPrice: 50, resellerPrice: 25 },
          { serviceid: 'UT-3M', service: 'UnlockTool Licencia 3 Meses', retailPrice: 399, resellerPrice: 350 },
          { serviceid: 'UT-6M', service: 'UnlockTool Licencia 6 Meses', retailPrice: 666, resellerPrice: 580 },
          { serviceid: 'UT-12M', service: 'UnlockTool Licencia 12 Meses', retailPrice: 1050, resellerPrice: 940 },
          { serviceid: 'TSM-3H', service: 'TSM Tool Renta 3 Horas', retailPrice: 50, resellerPrice: 20 },
          { serviceid: 'TSM-6H', service: 'TSM Tool Renta 6 Horas', retailPrice: 70, resellerPrice: 32 },
          { serviceid: 'TSM-3M', service: 'TSM Tool Licencia 3 Meses', retailPrice: 680, resellerPrice: 590 },
          { serviceid: 'TSM-6M', service: 'TSM Tool Licencia 6 Meses', retailPrice: 975, resellerPrice: 850 },
          { serviceid: 'TSM-12M', service: 'TSM Tool Licencia 12 Meses', retailPrice: 1289, resellerPrice: 1150 }
        ];
      }

      this.renderSelectedProducts();
      this.generatePrompt();
    },

    renderSelectedProducts() {
      const container = document.getElementById('flyerSelectedList');
      const countEl = document.getElementById('flyerSelectedCount');
      if (!container) return;

      if (countEl) {
        countEl.textContent = `${this.selectedProducts.length} seleccionados`;
      }

      if (this.selectedProducts.length === 0) {
        container.innerHTML = `<span style="font-size: 0.8rem; color: #64748b;">No has seleccionado productos. Elige arriba o pulsa en cualquier tarjeta de la web.</span>`;
        return;
      }

      container.innerHTML = this.selectedProducts.map(p => `
        <div style="background: rgba(15, 23, 42, 0.9); border: 1px solid #38bdf8; border-radius: 6px; padding: 4px 8px; display: inline-flex; align-items: center; gap: 6px; font-size: 0.78rem;">
          <span style="color: #fff; font-weight: 600;">${p.service}</span>
          <span style="color: #34d399; font-weight: bold; background: rgba(52,211,153,0.15); padding: 1px 4px; border-radius: 4px;">$${p.retailPrice.toFixed(2)} MXN</span>
          <button type="button" onclick="MegaApp.FlyerPrompt.toggleProduct('${p.serviceid}')" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 0 2px; font-weight: bold;" title="Eliminar">✕</button>
        </div>
      `).join('');
    },

    generatePrompt() {
      const promptEl = document.getElementById('flyerGeneratedPrompt');
      const ratioEl = document.getElementById('flyerAspectRatio');
      const ratio = ratioEl ? ratioEl.value : '3:4';

      if (!promptEl) return;

      // Agrupar items por categorías o marcas principales
      const productLines = this.selectedProducts.map(p => {
        return `- ${p.service}: $${p.retailPrice.toFixed(0)} MXN (Entrega Automática / Inmediata)`;
      }).join('\n');

      const fullPrompt = 
`Genera una imagen publicitaria publicitaria de calidad ultra premium y comercial (Cyberpunk / Modern High-Tech Style) con relación de aspecto ${ratio}.

TEMÁTICA Y MARCA:
- Empresa: MegaUnlockPhone México (Servidor GSM & Licencias Oficiales)
- Ubicación / Origen: Tuxpan, Veracruz, México
- WhatsApp Oficial de Soporte y Activaciones: +52 221 693 6720
- Enlace Web Oficial: https://megaunlockphone-panel.alwaysdata.net/

ELEMENTOS VISUALES PRINCIPALES:
1. Encabezado Impactante: "MEGAUNLOCKPHONE - LICENCIAS & RENTAS OFICIALES AL INSTANTE".
2. Mostrar cajas 3D hiperrealistas de software profesional (UnlockTool y/o las herramientas listadas), con iluminación de borde neón (cian #00ffff, magenta #ec4899 y azul eléctrico) sobre un fondo tecnológico oscuro con sutiles circuitos brillantes y chispas de luz.
3. Lista de Precios y Servicios Claramente Legibles (renderizados con tipografía moderna, limpia y nítida):
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
