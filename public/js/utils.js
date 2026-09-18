/**
 * Módulo de Utilidades (Utils)
 * 
 * Contiene funciones puras de formateo, sanitización y parseo que no dependen 
 * del estado global de la aplicación. Extraídas para aligerar el archivo principal.
 */

window.AppUtils = {
  /**
   * Formatea un número o string a formato de moneda (MXN)
   * @param {number|string} credits - Cantidad a formatear
   * @returns {string} String formateado (ej. $10.00 MXN)
   */
  formatPrice: function(credits) {
    const rawVal = parseFloat(credits) || 0;
    return `$${rawVal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
  },

  /**
   * Sanitiza un string para prevenir ataques XSS al inyectarlo en el DOM
   * @param {string} unsafe - Texto introducido por el usuario
   * @returns {string} Texto sanitizado
   */
  escapeHtml: function(unsafe) {
    if (!unsafe) return '';
    return unsafe
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  /**
   * Procesa un string crudo del servidor y le añade color HTML para 
   * resaltar errores, éxitos o advertencias.
   * @param {string} text - Texto plano del servidor
   * @returns {string} HTML con estilos de colores
   */
  colorizeServerResponse: function(text) {
    if (!text) return 'Sin comentarios';

    if (typeof text === 'object') {
        try {
            text = JSON.stringify(text, null, 2);
        } catch(e) {
            text = String(text);
        }
    }

    let cleaned = String(text);
    cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
    cleaned = cleaned.replace(/<\/div>/gi, '\n');
    cleaned = cleaned.replace(/<\/p>/gi, '\n');
    cleaned = cleaned.replace(/<\/li>/gi, '\n');
    cleaned = cleaned.replace(/<[^>]*>?/gm, '');
    cleaned = cleaned.replace(/\n\s*\n/g, '\n').trim();

    // Use its own escapeHtml
    let safeText = window.AppUtils.escapeHtml(cleaned);

    // Match Key: Value pattern and wrap in spans for coloring (exclude http/https)
    safeText = safeText.replace(/^([a-zA-Z0-9_ \-\.]+):\s*(.*)$/gm, (match, p1, p2) => {
      if (p1.toLowerCase() === 'http' || p1.toLowerCase() === 'https') {
        return match;
      }
      return `<span style="color: var(--secondary-color); font-weight: 600;">${p1}:</span> <span style="color: #10b981;">${p2}</span>`;
    });

    // Detect URLs and make them clickable
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    safeText = safeText.replace(urlRegex, '<a href="$1" target="_blank" style="color: #00f0ff; text-decoration: underline;">$1</a>');

    return safeText;
  },

  /**
   * Extrae usuario y contraseña (o credenciales) de un string devuelto por la API.
   * @param {string} text - Texto en bruto del servidor.
   * @returns {Object} Objeto con propiedades user y pass.
   */
  parseCredentials: function(text) {
    if (!text) return { user: 'N/A', pass: 'N/A' };

    let preCleanText = String(text).replace(/<br\s*\/?>/gi, ' ').replace(/<\/div>/gi, ' ').replace(/<[^>]*>?/gm, '').trim();

    if (preCleanText.includes('✅')) {
      let parts = preCleanText.split('✅').map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return { user: parts[0], pass: parts[parts.length - 1] };
      }
    }

    let cleanText = preCleanText
      .replace(/[✨⭐★=|,;]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    let match = cleanText.match(/(?:username|user|usuario|login|email|correo)\s*[:=-]?\s*(\S+)\s+(?:password|pass|contraseña|clave|pin)\s*[:=-]?\s*(\S+)/i);
    if (match) {
      let u = match[1].replace(/[:=-]+$/, '');
      let p = match[2].replace(/[:=-]+$/, '');
      return { user: u, pass: p };
    }

    let emailMatch = cleanText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);

    let tokens = cleanText.split(/\s+/).filter(t =>
      t.length > 2 &&
      !t.toLowerCase().includes('login') &&
      !t.toLowerCase().includes('detail') &&
      !t.toLowerCase().includes('success') &&
      !/^[=]+$/.test(t)
    );

    if (emailMatch && tokens.length >= 2) {
      const email = emailMatch[1];
      const otherTokens = tokens.filter(t => t !== email && !/^[0-9]{1,3}$/.test(t));
      if (otherTokens.length > 0) {
        return { user: email, pass: otherTokens[otherTokens.length - 1] };
      }
    }

    if (tokens.length >= 2) {
      return { user: tokens[tokens.length - 2], pass: tokens[tokens.length - 1] };
    }

    return { user: 'VER_HISTORIAL', pass: 'VER_HISTORIAL' };
  }
};
