let realCost = 9;
let resellerCost = NaN; // simulated from activeMarkup=NaN or customPrices=""

if (isNaN(resellerCost) || resellerCost < realCost) resellerCost = Math.ceil(realCost);

let price = isNaN(resellerCost) ? 0 : resellerCost;

console.log("FINAL PRICE:", price);
