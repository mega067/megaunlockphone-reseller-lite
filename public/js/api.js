/**
 * Módulo de API (ApiHelpers)
 * 
 * Centraliza las llamadas a la API del backend para separar la capa de red
 * de la capa de interfaz de usuario (UI), facilitando el mantenimiento y 
 * manejo de errores.
 */

  /**
   * Helper para manejar las respuestas JSON de forma segura.
   */
  async function handleResponse(res) {
    let data;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch(e) {
      throw new Error('Respuesta no válida del servidor.');
    }
    if (!res.ok) {
      throw new Error(data.error || 'Ocurrió un error en la solicitud.');
    }
    return data;
  }

  window.ApiHelpers = {
    /**
     * Realiza la petición de inicio de sesión.
     */
    login: async function(username, password, serverId) {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Server-Id': serverId || '1'
        },
        body: JSON.stringify({ username, password })
      });
      return handleResponse(res);
    },

    /**
     * Inicia el registro enviando el OTP por WhatsApp.
     */
    register: async function(username, password, phone) {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password, phone })
      });
      return handleResponse(res);
    },

    /**
     * Verifica el código OTP y activa la cuenta.
     */
    verifyOtp: async function(phone, otp) {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone, otp })
      });
      return handleResponse(res);
    }
  };
