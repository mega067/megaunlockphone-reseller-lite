const fs = require('fs');

let content = fs.readFileSync('public/index.js', 'utf8');

// 1. Update syncProducts catch block
content = content.replace(
`      let errMsg = err.message || 'Error desconocido';
      if (errMsg.toLowerCase().includes('failed to fetch') || errMsg.toLowerCase().includes('networkerror') || errMsg.includes('500') || errMsg.includes('503') || errMsg.includes('502')) {
        errMsg = '⚠️ El servidor está caído o fuera de servicio temporalmente, se está revisando. Por favor, intenta más tarde.';
      }

      showError(errMsg);`,
`      let errMsg = err.message || 'Error desconocido';
      let isServerDown = false;
      if (errMsg.toLowerCase().includes('failed to fetch') || errMsg.toLowerCase().includes('networkerror') || errMsg.includes('500') || errMsg.includes('503') || errMsg.includes('502')) {
        errMsg = 'El servidor está en mantenimiento o bajo revisión.';
        isServerDown = true;
      }

      showError(errMsg, isServerDown);`
);

// 2. Update showError function
const oldShowError = `  // Error messaging helper
  function showError(message) {
    feedbackArea.innerHTML = \`
      <div class="empty-state" style="color: var(--status-offline)">
        <i data-lucide="alert-triangle"></i>
        <h3>Error al Sincronizar</h3>
        <p style="color: var(--text-secondary)">\${escapeHtml(message)}</p>
        <div class="error-details">
          Sugerencia: Asegúrate de que el endpoint sea correcto, que tu IP no esté bloqueada/no requiera lista blanca (whitelist) en el panel de Dhru Fusion, y que las credenciales ingresadas sean correctas. 
          <br><br>
          <button type="button" class="btn btn-secondary btn-small" style="margin: 0 auto; display: block;" id="btnErrorGoBack">
            Volver a Credenciales
          </button>
        </div>
      </div>
    \`;
    feedbackArea.classList.remove('hidden');
    productsBody.parentElement.classList.add('hidden');
    lucide.createIcons();

    document.getElementById('btnErrorGoBack').addEventListener('click', () => {
      btnLogout.click();
    });
  }`;

const newShowError = `  // Error messaging helper
  function showError(message, isServerDown = false) {
    if (isServerDown) {
      feedbackArea.innerHTML = \`
        <div class="empty-state" style="color: var(--status-offline); text-align: center;">
          <div style="display: flex; justify-content: center; margin-bottom: 20px;">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide-spin" style="animation: spin 3s linear infinite;">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              <circle cx="12" cy="12" r="10" stroke="var(--primary-color)" stroke-width="2" stroke-dasharray="8 4"></circle>
              <path d="M14.7 9.3 12 12l2.7 2.7" stroke="var(--text-color)"></path>
            </svg>
          </div>
          <h3 style="color: #ef4444; font-size: 1.5rem; margin-bottom: 10px;">¡Servidor en Mantenimiento! 🛠️</h3>
          <p style="color: var(--text-secondary); font-size: 1.1rem; margin-bottom: 15px;">\${escapeHtml(message)}</p>
          <div class="error-details" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 15px;">
            <strong style="color: #ef4444; font-size: 1.2rem;">Por favor, CAMBIA A OMEGA SERVER para continuar tus operaciones.</strong>
            <br><br>
            <p style="color: var(--text-secondary);">Selecciona otro servidor en la parte superior izquierda.</p>
          </div>
        </div>
      \`;
    } else {
      feedbackArea.innerHTML = \`
        <div class="empty-state" style="color: var(--status-offline)">
          <i data-lucide="alert-triangle"></i>
          <h3>Error al Sincronizar</h3>
          <p style="color: var(--text-secondary)">\${escapeHtml(message)}</p>
          <div class="error-details">
            Sugerencia: Revisa tu conexión, tu IP y tus credenciales de acceso.
            <br><br>
            <button type="button" class="btn btn-secondary btn-small" style="margin: 0 auto; display: block;" id="btnErrorGoBack">
              Volver a Credenciales
            </button>
          </div>
        </div>
      \`;
    }
    
    feedbackArea.classList.remove('hidden');
    productsBody.parentElement.classList.add('hidden');
    lucide.createIcons();

    const btnGoBack = document.getElementById('btnErrorGoBack');
    if (btnGoBack) {
      btnGoBack.addEventListener('click', () => {
        btnLogout.click();
      });
    }
  }`;

content = content.replace(oldShowError, newShowError);
fs.writeFileSync('public/index.js', content);
