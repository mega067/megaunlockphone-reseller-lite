window.MegaApp = window.MegaApp || {};

window.MegaApp.Ticket = {
  elements: {},
  state: {},
  
  init: function(deps) {
    this.elements = deps.elements;
    this.state = deps.state;
    this.bindEvents();
  },

  bindEvents: function() {
    if (this.elements.configLogoInput) {
      this.elements.configLogoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          if (file.size > 2 * 1024 * 1024) {
            alert('El archivo es demasiado grande. El límite es de 2 MB.');
            this.elements.configLogoInput.value = '';
            return;
          }
          const reader = new FileReader();
          reader.onload = (evt) => { this.elements.configLogoPreview.src = evt.target.result; };
          reader.readAsDataURL(file);
        }
      });
    }
  },

  fetchTicketConfig: async function() {
    const token = this.state.getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/ticket_config?t=${Date.now()}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        }
      });
      if (res.ok) {
        const settings = await res.json();
        this.state.setSettings(settings);
        if (this.elements.configNameInput && settings.nombre) this.elements.configNameInput.value = settings.nombre;
        if (this.elements.configWaInput && settings.whatsapp) this.elements.configWaInput.value = settings.whatsapp;
        if (this.elements.configFbInput && settings.facebook) this.elements.configFbInput.value = settings.facebook;
        if (this.elements.configLogoPreview) {
          if (settings.logoExt) {
            this.elements.configLogoPreview.src = `/logos/${this.state.getAuthUserId()}${settings.logoExt}?t=${Date.now()}`;
          } else {
            this.elements.configLogoPreview.src = 'logo.png';
          }
        }
      }
    } catch (e) {
      console.error('Error fetching ticket config:', e);
    }
  },

  saveTicketConfig: async function() {
    if (!this.elements.configWaInput || !this.elements.configFbInput || !this.elements.configNameInput) return;
    const nombre = this.elements.configNameInput.value.trim();
    const wa = this.elements.configWaInput.value.trim();
    const fb = this.elements.configFbInput.value.trim();
    
    const settings = this.state.getSettings();
    // Only save if something changed
    if (nombre === (settings.nombre || '') && 
        wa === (settings.whatsapp || '') && 
        fb === (settings.facebook || '') && 
        (!this.elements.configLogoInput || !this.elements.configLogoInput.files[0])) {
      return;
    }

    let base64 = null;
    const file = this.elements.configLogoInput.files[0];
    if (file) {
      base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxDim = 300;
            if (width > height) {
              if (width > maxDim) { height *= maxDim / width; width = maxDim; }
            } else {
              if (height > maxDim) { width *= maxDim / height; height = maxDim; }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          };
          img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
      });
    }
    
    try {
      const payload = { nombre, whatsapp: wa, facebook: fb };
      if (base64) payload.logoBase64 = base64;
      
      const res = await fetch('/api/ticket_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.state.getAuthToken()}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        // Optimistically update local state
        settings.nombre = nombre;
        settings.whatsapp = wa;
        settings.facebook = fb;
        this.state.setSettings(settings);
        await this.fetchTicketConfig(); // update local state fully
      }
    } catch (err) {
      console.error('Error auto-saving ticket config:', err);
    }
  }
};
