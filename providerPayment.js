const axios = require('axios');

/**
 * Reporta un pago SPEI directamente a la API de automatizaciondepagos.com del proveedor.
 * 
 * @param {object} providerAccount - Objeto de cuenta del proveedor (del bankConfig.js)
 * @param {string} claveRastreo - La clave de rastreo de la transferencia SPEI
 * @param {string} emisorBankCode - El código del banco desde el que el usuario transfirió
 * @param {number} monto - El monto exacto de la transferencia
 * @param {string} userEmail - El correo electrónico del administrador (tu correo en Dhru)
 * @returns {object} - Resultado de la operación
 */
async function reportarPagoProveedor(providerAccount, claveRastreo, emisorBankCode, monto, userEmail) {
  try {
    let currentTarjetaId = providerAccount.tarjetaId;
    
    // RASPADO EN VIVO: Obtener el ID actual de la tarjeta desde la página del proveedor usando la CLABE
    try {
      const pageUrl = providerAccount.providerApiUrl.includes('unlockerfast') ? 'https://www.unlockerfast.com.mx/autopayv2.php' : 'https://latamgsm.com/autopay.php';
      const { data: html } = await axios.get(pageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      // Buscar: seleccionarTarjetaDestino(15, 'Jesus Becerril', '021260064377971724'
      const regex = new RegExp(`seleccionarTarjetaDestino\\(\\s*(\\d+),\\s*[^,]+,\\s*['"]?${providerAccount.clabe}['"]?`);
      const match = html.match(regex);
      if (match && match[1]) {
        console.log(`[ProviderPayment] Raspado exitoso: tarjetaId ${match[1]} para CLABE ${providerAccount.clabe}`);
        currentTarjetaId = match[1];
      } else {
        console.warn(`[ProviderPayment] No se encontró el tarjetaId en vivo para CLABE ${providerAccount.clabe}, usando default: ${currentTarjetaId}`);
      }
    } catch(err) {
      console.warn("[ProviderPayment] Error al raspar tarjetaId, usando default:", err.message);
    }

    // URL completa con la API KEY del proveedor
    const apiUrl = `${providerAccount.providerApiUrl}${providerAccount.providerApiKey}`;
    
    // Los datos exactos que envía el formulario autopay.php de LatamGSM
    const payload = {
      tarjeta: currentTarjetaId, // El ID interno de la cuenta destino en su SaaS
      tipoCriterio: 'T', // 'T' para Transferencia (SPEI)
      criterio: claveRastreo,
      emisor: emisorBankCode,
      monto: monto,
      correo: (userEmail && userEmail.includes('@')) ? userEmail : 'angeljuares067@gmail.com',
      banco: 1 // ID fijo usado en su frontend
    };

    console.log(`[ProviderPayment] Enviando a: ${apiUrl}`);
    console.log(`[ProviderPayment] Payload:`, JSON.stringify(payload));

    // Usamos axios para enviar un URL-encoded form data, ya que usan $.post en jQuery
    const response = await axios.post(apiUrl, new URLSearchParams(payload).toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    // La API de automatizaciondepagos suele responder con texto (ej. "Tu saldo fue actualizado")
    const respText = response.data ? (typeof response.data === 'string' ? response.data : JSON.stringify(response.data)) : '';
    
    if (respText.toLowerCase().includes("tu saldo fue actualizado") || (response.data && response.data.success)) {
      return {
        success: true,
        message: 'Pago reportado correctamente al proveedor. Saldo actualizado.',
        data: respText
      };
    } else {
      return {
        success: false,
        message: 'El proveedor rechazó el comprobante o no se encontró: ' + respText.substring(0, 150),
        data: respText
      };
    }

  } catch (error) {
    console.error(`Error reportando pago al proveedor [${providerAccount.providerKey}]:`, error.message);
    if (error.response) {
      console.error('Detalles del error:', error.response.data);
    }
    return {
      success: false,
      message: 'Error de conexión con el sistema de pagos del proveedor',
      error: error.message
    };
  }
}

module.exports = {
  reportarPagoProveedor
};
