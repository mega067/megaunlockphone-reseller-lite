# 💳 Módulo de Recargas Bancarias & Validación SPEI (mod-recharge-spei)

> **Repositorio:** `mod-recharge-spei`  
> **Rol:** Conciliación bancaria, consulta CEP Banxico y acreditación de billeteras.

---

## 📌 1. Descripción
Módulo especializado en la gestión de pagos entrantes:
- Generación de referencias y cuentas CLABE para clientes.
- Validación de certificados CEP de Banxico en tiempo real mediante claves de rastreo de 18 a 30 caracteres.
- Acreditación de saldo inmediata en SQLite con prevención de pagos duplicados.

---

## 🚀 2. Configuración (`bankConfig.json`)
```json
{
  "accounts": [
    {
      "bankName": "NU MEXICO",
      "bankCode": "40638",
      "clabe": "638180000147867948",
      "beneficiary": "Nombre del Administrador",
      "minDeposit": 50
    }
  ],
  "banxicoValidation": true
}
```
