const fs = require('fs');
const express = require('express');
const app = express();
app.use(express.json());
app.post('/test', (req, res) => {
    const { userId } = req.body;
    const users = JSON.parse(fs.readFileSync('data/users.json'));
    const userIndex = users.findIndex(u => u.id === userId);
    res.json({ userId, type: typeof userId, index: userIndex, firstId: users[0].id, firstType: typeof users[0].id });
});
app.listen(3001, () => console.log('started'));
