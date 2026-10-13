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

    // Ensure Marquee contains pure Streaming & AI brand chips
    function applyDigitalPassMarquee() {
      const marquees = document.querySelectorAll('.header-marquee .marquee-item');
      if (!marquees || marquees.length === 0) return;

      const brandsHtml = `
        <span class="brand-chip"><img src="/digitalpass/brands/gemini.svg" alt="Gemini"> Gemini</span>
        <span class="brand-chip"><img src="/digitalpass/brands/chatgpt.svg" alt="ChatGPT"> ChatGPT</span>
        <span class="brand-chip"><img src="/digitalpass/brands/netflix.svg" alt="Netflix"> Netflix</span>
        <span class="brand-chip"><img src="/digitalpass/brands/disney.svg" alt="Disney+"> Disney+</span>
        <span class="brand-chip"><img src="/digitalpass/brands/prime.svg" alt="Prime Video"> Prime Video</span>
        <span class="brand-chip"><img src="/digitalpass/brands/max.svg" alt="Max"> Max</span>
        <span class="brand-chip"><img src="/digitalpass/brands/spotify.svg" alt="Spotify"> Spotify</span>
        <span class="brand-chip"><img src="/digitalpass/brands/youtube.svg" alt="YouTube"> YouTube</span>
        <span class="brand-chip"><img src="/digitalpass/brands/claude.svg" alt="Claude AI"> Claude</span>
        <span class="brand-chip"><img src="/digitalpass/brands/canva.svg" alt="Canva"> Canva</span>
        <span class="brand-chip"><img src="/digitalpass/brands/playstation.svg" alt="PlayStation"> PlayStation</span>
        <span class="brand-chip"><img src="/digitalpass/brands/xbox.svg" alt="Xbox"> Xbox</span>
        <span class="brand-chip"><img src="/digitalpass/brands/crunchyroll.svg" alt="Crunchyroll"> Crunchyroll</span>
        <span class="brand-chip"><img src="/digitalpass/brands/steam.svg" alt="Steam"> Steam</span>
      `;

      marquees.forEach(m => {
        // Only update if it doesn't already have our brand-chips or if index.js replaced it
        if (!m.querySelector('.brand-chip') || m.querySelector('img[src*="fullbrand"]')) {
          m.innerHTML = brandsHtml;
        }
      });
    }

    applyDigitalPassMarquee();
    // Protect marquee against late async updates from /api/public_settings
    setTimeout(applyDigitalPassMarquee, 500);
    setTimeout(applyDigitalPassMarquee, 1500);
    setTimeout(applyDigitalPassMarquee, 3000);

    // Theme Manager (Light by default, Dark mode toggle)
    function setupThemeToggle() {
      const savedTheme = localStorage.getItem('digitalpass_theme') || 'light';
      applyTheme(savedTheme);

      const btnToggle = document.getElementById('btnThemeToggle');
      if (btnToggle && !btnToggle._boundTheme) {
        btnToggle._boundTheme = true;
        btnToggle.addEventListener('click', () => {
          const isDark = document.body.classList.contains('dark-mode');
          const nextTheme = isDark ? 'light' : 'dark';
          applyTheme(nextTheme);
          localStorage.setItem('digitalpass_theme', nextTheme);
        });
      }
    }

    function applyTheme(theme) {
      const toggleText = document.getElementById('themeToggleText');
      const toggleIcon = document.getElementById('themeToggleIcon');

      if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        if (toggleText) toggleText.textContent = 'Claro';
        if (toggleIcon) {
          toggleIcon.setAttribute('data-lucide', 'sun');
        }
      } else {
        document.body.classList.remove('dark-mode');
        if (toggleText) toggleText.textContent = 'Oscuro';
        if (toggleIcon) {
          toggleIcon.setAttribute('data-lucide', 'moon');
        }
      }

      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }

    setupThemeToggle();
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
