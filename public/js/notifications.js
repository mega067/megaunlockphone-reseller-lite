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
   * @param {string} [type='info'] - 'success', 'error', 'warning', 'info'
   * @param {string} [title=null] - El título de la notificación.
   */
  window.showToast = function(message, type = 'info', title = null) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.style.background = '#1e293b';
    
    let borderColor = '#0ea5e9';
    let iconName = 'info';
    let defaultTitle = 'Aviso';

    if (type === 'success') {
      borderColor = '#10b981';
      iconName = 'check-circle-2';
      defaultTitle = 'Éxito';
    } else if (type === 'error') {
      borderColor = '#ef4444';
      iconName = 'alert-circle';
      defaultTitle = 'Error';
    } else if (type === 'warning') {
      borderColor = '#f59e0b';
      iconName = 'alert-triangle';
      defaultTitle = 'Atención';
    }

    toast.style.borderLeft = `4px solid ${borderColor}`;
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 10px 25px -3px rgba(0, 0, 0, 0.6), 0 4px 6px -4px rgba(0, 0, 0, 0.4)';
    toast.style.padding = '12px 16px';
    toast.style.width = '320px';
    toast.style.maxWidth = '90vw';
    toast.style.display = 'flex';
    toast.style.alignItems = 'flex-start';
    toast.style.gap = '12px';
    toast.style.pointerEvents = 'auto';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    toast.style.cursor = 'pointer';

    toast.innerHTML = `
      <div style="flex-shrink: 0; margin-top: 2px;">
        <i data-lucide="${iconName}" style="color: ${borderColor}; width: 20px; height: 20px;"></i>
      </div>
      <div style="flex-grow: 1;">
        <h4 style="margin: 0 0 4px 0; color: #f8fafc; font-size: 0.9rem; font-weight: 600;">${title || defaultTitle}</h4>
        <p style="margin: 0; color: #cbd5e1; font-size: 0.85rem; line-height: 1.4; white-space: pre-line;">${message}</p>
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
  };

  /**
   * Muestra una notificación tipo Modal o Toast según el contexto.
   * @param {string} message - El mensaje a mostrar.
   * @param {string} [title='Aviso'] - El título de la notificación.
   */
  window.alert = function(message, title = 'Aviso') {
    const isSyncMessage = message && (message.includes('Sincronización completada') || message.includes('pedidos pendientes por sincronizar'));
    
    if (isSyncMessage) {
      window.showToast(message, 'success', title);
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
