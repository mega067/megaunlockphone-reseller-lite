/**
 * Módulo de API (ApiHelpers)
 * 
 * Centraliza las llamadas a la API del backend para separar la capa de red
 * de la capa de interfaz de usuario (UI), facilitando el mantenimiento y 
 * manejo de errores.
 */

window.ApiHelpers = {
  /**
   * Realiza la petición de inicio de sesión.
   * @param {string} username - Nombre de usuario
   * @param {string} password - Contraseña
   * @param {string} serverId - ID del servidor actual
   * @returns {Promise<Object>} Datos de sesión (token, role, etc)
   */
  login: async function(username, password, serverId) {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 
        'X-Server-Id': serverId, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Error al iniciar sesión');
    }
    
    return data;
  }
};
