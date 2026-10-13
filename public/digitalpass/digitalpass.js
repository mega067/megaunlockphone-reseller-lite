/**
 * DigitalPass Client Controller & Interceptors
 * 
 * Configures the application into DigitalPass mode:
 * 1. Sets x-digital-pass headers on API requests so only Streaming, AI, and Custom Digital groups load.
 * 2. Overrides window.fetch to automatically append &digitalPass=true to /api/products requests.
 * 3. Customizes UI text, brand names, and page metadata for DigitalPass.
 * 4. Preserves full integration with WhatsApp Bot, Orders, History, and Balance wallets.
 */

window.IS_DIGITAL_PASS = true;

(function() {
  // 1. Intercept native fetch to append digitalPass=true & header
  const originalFetch = window.fetch;
  window.fetch = function(url, options = {}) {
    let finalUrl = url;
    options = options || {};
    options.headers = options.headers || {};

    if (typeof finalUrl === 'string') {
      if (finalUrl.includes('/api/products')) {
        const sep = finalUrl.includes('?') ? '&' : '?';
        if (!finalUrl.includes('digitalPass=')) {
          finalUrl = `${finalUrl}${sep}digitalPass=true`;
        }
      }
    }

    if (options.headers instanceof Headers) {
      options.headers.set('X-Digital-Pass', 'true');
    } else if (typeof options.headers === 'object') {
      options.headers['X-Digital-Pass'] = 'true';
    }

    return originalFetch.call(this, finalUrl, options);
  };

  // 2. Adjust default server if none selected (Server 3 has hundreds of streaming/AI services)
  if (!localStorage.getItem('currentServerId')) {
    localStorage.setItem('currentServerId', '3');
  }

  // 3. Update Title & UI Branding when DOM is ready
  function customizeDigitalPassUI() {
    document.title = 'DigitalPass - Entretenimiento y Cuentas Premium';

    // Update catalog title
    const catalogTitle = document.getElementById('catalogTitle');
    if (catalogTitle && catalogTitle.textContent.includes('Catálogo')) {
      catalogTitle.textContent = 'Catálogo DigitalPass (Streaming & AI)';
    }

    // Update login modal / branding text if present
    const loginHeading = document.querySelector('.login-header h2');
    if (loginHeading) {
      loginHeading.textContent = 'Bienvenido a DigitalPass';
    }

    const loginDesc = document.querySelector('.login-header p');
    if (loginDesc) {
      loginDesc.textContent = 'Entretenimiento sin límites, precios sin exceso.';
    }

    // Marquee brand replacement or subtitle
    const brandSpan = document.querySelector('.logo-text h1 span');
    if (brandSpan) {
      brandSpan.textContent = 'Streaming & AI';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', customizeDigitalPassUI);
  } else {
    customizeDigitalPassUI();
  }

  // Hook into lucide icons re-renders
  window.addEventListener('load', () => {
    setTimeout(customizeDigitalPassUI, 200);
  });
})();
