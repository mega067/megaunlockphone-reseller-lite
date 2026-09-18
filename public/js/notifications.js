/**
 * Módulo de Notificaciones (Toasts / Sliders)
 * 
 * Este módulo sobrescribe window.alert para mostrar "toasts" (notificaciones pequeñas)
 * que se apilan en la esquina de la pantalla sin bloquear el uso de la app.
 */

(function() {
  if (!window.originalAlert) {
    window.originalAlert = window.alert;
  }

  /**
   * Muestra una notificación tipo Toast.
   * @param {string} message - El mensaje a mostrar.
   * @param {string} [title='Aviso'] - El título de la notificación.
   */
  window.alert = function(message, title = 'Aviso') {
    const isSyncMessage = message && message.includes('Sincronización completada');
    
    if (isSyncMessage) {
      // Usa el sistema Toast pequeño para la sincronización
      const container = document.getElementById('toastContainer');
      if (!container) return window.originalAlert(message);

      const toast = document.createElement('div');
      toast.style.background = '#1e293b';
      toast.style.borderLeft = `4px solid #10b981`; // Verde
      toast.style.borderRadius = '8px';
      toast.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.5)';
      toast.style.padding = '12px 16px';
      toast.style.width = '300px';
      toast.style.display = 'flex';
      toast.style.alignItems = 'flex-start';
      toast.style.gap = '12px';
      toast.style.pointerEvents = 'auto';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      toast.style.cursor = 'pointer';

      toast.innerHTML = `
        <div style="flex-shrink: 0; margin-top: 2px;">
          <i data-lucide="check-circle-2" style="color: #10b981; width: 20px; height: 20px;"></i>
        </div>
        <div style="flex-grow: 1;">
          <h4 style="margin: 0 0 4px 0; color: #f8fafc; font-size: 0.9rem; font-weight: 600;">${title}</h4>
          <p style="margin: 0; color: #cbd5e1; font-size: 0.85rem; line-height: 1.4;">${message}</p>
        </div>
      `;

      toast.addEventListener('click', () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
      });

      container.appendChild(toast);
      if (window.lucide) window.lucide.createIcons({ root: toast });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          toast.style.opacity = '1';
          toast.style.transform = 'translateX(0)';
        });
      });

      setTimeout(() => {
        if (toast.parentNode) {
          toast.style.opacity = '0';
          toast.style.transform = 'translateX(100%)';
          setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
        }
      }, 5000);
      
    } else {
      // Usa el Modal Grande oscuro para todo lo demás
      const overlay = document.getElementById('customAlertOverlay');
      const msgEl = document.getElementById('customAlertMessage');
      const titleEl = document.getElementById('customAlertTitle');
      const btn = document.getElementById('btnCustomAlertClose');
      const icon = document.getElementById('customAlertIcon');
      
      if (!overlay || !msgEl || !titleEl || !btn || !icon) {
        return window.originalAlert(message);
      }

      msgEl.textContent = message;
      titleEl.textContent = title;
      
      const lowerMsg = message ? message.toLowerCase() : '';
      if (lowerMsg.includes('error') || lowerMsg.includes('falló') || lowerMsg.includes('incorrecto')) {
        icon.setAttribute('data-lucide', 'alert-circle');
        icon.style.color = '#ef4444'; 
      } else if (lowerMsg.includes('éxito') || lowerMsg.includes('correctamente') || lowerMsg.includes('exitosamente')) {
        icon.setAttribute('data-lucide', 'check-circle-2');
        icon.style.color = '#10b981'; 
      } else {
        icon.setAttribute('data-lucide', 'info');
        icon.style.color = '#0ea5e9'; 
      }
      
      if (window.lucide) window.lucide.createIcons();
      overlay.classList.remove('hidden');
      
      const closeAlert = () => {
        overlay.classList.add('hidden');
        btn.removeEventListener('click', closeAlert);
      };
      btn.addEventListener('click', closeAlert);
    }
  };
})();
