const express = require('express');
const app = express();
app.use(express.json());

app.post('/search', (req, res) => {
    let resellerCost = 11;
    let s = { SERVICENAME: "Test" };
    let serviceid = 123;
    let results = [];
    results.push({ id: serviceid, name: s.SERVICENAME, price: isNaN(resellerCost) ? 0 : resellerCost });
    res.json({ results: results });
});
app.listen(3002, () => console.log('started mock'));
