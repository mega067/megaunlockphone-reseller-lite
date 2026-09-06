const { Transferencia, configure } = require('cep-banxico');

// Configurar entorno de producción (false = producción)
configure(false);

// Parche en caliente para Banxico (AlwaysData usa la librería sin modificar porque deploy.sh excluye node_modules)
try {
  const mod = require('cep-banxico/src/banks');
  if (mod && mod.BANKS) {
    if (!mod.BANKS['40638']) mod.BANKS['40638'] = 'NU MEXICO';
    if (!mod.BANKS['90646']) mod.BANKS['90646'] = 'STP';
  }
} catch (e) {
  console.error("No se pudo parchear cep-banxico", e);
}

/**
 * Valida un pago SPEI mediante la API de Banxico (CEP).
 * 
 * @param {string} dateStr - Fecha en formato 'DD-MM-YYYY'
 * @param {string} claveRastreo - Clave de rastreo alfanumérica
 * @param {string} emisorBankCode - Código de Banxico del banco desde donde se envió (ej. 40012 para BBVA)
 * @param {string} receptorBankCode - Código de Banxico del banco destino (ej. 40638 para NU)
 * @param {string} receptorAccount - Cuenta CLABE destino (18 dígitos)
 * @param {number} montoPesos - Monto de la recarga solicitada en pesos (ej. 150.00)
 * @returns {object|null} - Devuelve los datos del CEP si es válido, o null si no se encontró
 */
async function validarPagoBanxico(dateStr, claveRastreo, emisorBankCode, receptorBankCode, receptorAccount, montoPesos) {
  try {
    // La librería requiere el monto en centavos
    const montoCentavos = Math.round(montoPesos * 100);
    
    // Consultar a Banxico
    const transferencia = await Transferencia.validar(
      dateStr,
      claveRastreo,
      emisorBankCode,
      receptorBankCode,
      receptorAccount,
      montoCentavos
    );

    if (transferencia) {
      // Retornar los datos relevantes para nuestro sistema
      return {
        valido: true,
        nombreEmisor: transferencia.ordenante.nombre,
        rfcEmisor: transferencia.ordenante.rfc,
        montoValidado: transferencia.montoPesos,
        fecha: transferencia.fechaOperacion,
        concepto: transferencia.conceptoPago
      };
    }
    
    return null;

  } catch (error) {
    console.error(`Error validando SPEI en Banxico [${claveRastreo}]:`, error.message);
    
    // Manejar el caso donde no se encontró la transferencia
    // cep-banxico arroja un error cuando no existe
    return null;
  }
}

/**
 * Función auxiliar para intentar validar con la fecha de hoy, y si falla, probar con ayer.
 * Esto es útil cuando los depósitos se hacen cerca de la medianoche.
 */
async function validarPagoInteligente(claveRastreo, emisorBankCode, receptorBankCode, receptorAccount, montoPesos) {
  const formatearFecha = (date) => {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  };

  const hoy = new Date();
  const fechaHoyStr = formatearFecha(hoy);

  let result = await validarPagoBanxico(fechaHoyStr, claveRastreo, emisorBankCode, receptorBankCode, receptorAccount, montoPesos);
  
  if (!result) {
    // Intentar con el día anterior
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    const fechaAyerStr = formatearFecha(ayer);
    
    result = await validarPagoBanxico(fechaAyerStr, claveRastreo, emisorBankCode, receptorBankCode, receptorAccount, montoPesos);
  }

  return result;
}

module.exports = {
  validarPagoBanxico,
  validarPagoInteligente
};
