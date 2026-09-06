module.exports = {
  // Configuración de la cuenta bancaria del administrador (Tu cuenta NU MEXICO)
  ADMIN_ACCOUNTS: [
    {
      id: 'admin_nu',
      bankName: 'NU MEXICO',
      bankCode: '40638', // Código CEP Banxico para NU
      clabe: '638180000147867948',
      ownerName: 'Angel de Jesus Juarez Roman',
      minDeposit: 50, // Monto mínimo sugerido para transferencias
    },
    {
      id: 'admin_revolut',
      bankName: 'STP',
      bankCode: '90646', // Código CEP Banxico para STP (CLABE empieza con 646)
      clabe: '646990404027924404',
      ownerName: 'Angel de Jesus Juarez Roman',
      minDeposit: 50,
    }
  ],

  // Cuentas de los proveedores (LatamGSM y Unlockerfast)
  PROVIDER_ACCOUNTS: {
    'latamgsm': {
      apiKey: 'W5ut-4xC7-ISx5-51Jv', // Extraído de autopay.php
      apiUrl: 'https://payerlatam.com/api/comprobarpago/transferencia/',
      accounts: [
        {
          id: 'latam_banco',
          bankName: 'HSBC', 
          bankCode: '40021', // Código Banxico para HSBC
          clabe: '021260064377971724', 
          ownerName: 'Jesus Becerril',
          tarjetaId: '15' // El ID de la tarjeta en su SaaS (actualizado desde autopay.php)
        }
      ]
    },
    'unlockerfast': {
      apiKey: 'qHZr-9roe-mESb-76rs', // Extraído de autopayv2.php
      apiUrl: 'https://autopay.automatizaciondepagos.com/api/comprobarpago/transferencia/',
      accounts: [
        {
          id: 'unlocker_afirme',
          bankName: 'Afirme',
          bankCode: '40062',
          clabe: '062180008425137159',
          ownerName: 'David ulloa',
          tarjetaId: '8' // El ID en el SaaS para David Ulloa (062...)
        },
        {
          id: 'unlocker_banregio',
          bankName: 'Banregio',
          bankCode: '40058',
          clabe: '058597000073916071',
          ownerName: 'Jose Luis',
          tarjetaId: '19' // El ID en el SaaS para Jose Luis (058...)
        }
      ]
    }
  },

  // Umbral mínimo de liquidez: si tienes MENOS de esto, pediremos depositar al proveedor
  MIN_LIQUIDITY_THRESHOLD: 0 
};
