# 💰 Módulo Contable & Motor Financiero (mod-finanzas)

> **Repositorio:** `mod-finanzas`  
> **Rol:** Gestión de Billeteras, Balances Netos, Ganancias Brutas, Deudores y Gráficos Estadísticos.

---

## 📌 1. Descripción
Este módulo administra la contabilidad global del negocio:
- Cálculo automático de ganancia neta (`grossProfit - cost = netProfit`).
- Separación de caja operativa y caja de reinversión.
- Gestión de cuentas por cobrar (deudores) y transferencias entre cuentas propias con ganancia 0.
- Gráficos interactivos de torta y barras (ingresos vs gastos).

---

## 🚀 2. Instalación e Inicio

1. Iniciar en modo integrado dentro del Core o como microservicio independiente:
   ```bash
   cd packages/mod-finanzas
   npm install
   npm start
   ```
2. Acceder al panel web desde:
   `http://localhost:3000/finanzas`

---

## 🧩 3. Endpoints de la API Interna

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/finances/summary` | Balance de caja, utilidades del mes y saldos |
| `POST` | `/api/finances/transaction` | Registrar ingreso, gasto o transferencia |
| `GET` | `/api/finances/debts` | Lista de deudores y cuentas por cobrar |
| `POST` | `/api/finances/allowance` | Inyección de apoyo semanal / efectivo en caja |
