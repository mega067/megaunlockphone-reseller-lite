const axios = require('axios');
const { readDB } = require('../db');
const { getServerId, getServerSettings, getUserCredit } = require('../helpers');

exports.getAccount = async (req, res) => {
  const serverId = getServerId(req);
  const users = readDB('users.json') || [];
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  // Base response: local credits based on server
  const localCredit = getUserCredit(user, serverId);
  
  if (user.role === 'admin') {
    const settingsDb = readDB('settings.json');
    if (!settingsDb) return res.status(500).json({ error: 'Settings missing' });
    const settings = getServerSettings(settingsDb, serverId);
    if (!settings) return res.status(500).json({ error: 'Server misconfigured' });
    const { apiaccesskey, username, endpoint } = settings;
    
    let targetUrl = endpoint || 'https://latamgsm.com/dhru/';
    if (!targetUrl.endsWith('/')) targetUrl += '/';
    if (!targetUrl.includes('/api/')) targetUrl += 'api/index.php';
    else if (targetUrl.endsWith('/api/')) targetUrl += 'index.php';
    
    try {
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('apiaccesskey', apiaccesskey);
      params.append('action', 'accountinfo');
      params.append('requestformat', 'JSON');
      
      const response = await axios.post(targetUrl, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Dhru-Fusion-Web-Client/1.0' },
        timeout: 10000
      });
      
      const exchangeRate = parseFloat(settingsDb.exchangeRate || 17.60);
      const rate = serverId === '3' ? 1 : exchangeRate;
      const dhruCreditRaw = parseFloat(response.data?.SUCCESS?.[0]?.AccountInfo?.creditraw || 0);
      const dhruCredit = dhruCreditRaw * rate;
      
      // Calculate assigned credits based on server
      let assignedCredits = 0;
      users.forEach(u => {
        if (u.role !== 'admin') {
          assignedCredits += getUserCredit(u, serverId);
        }
      });
      const availableCredits = dhruCredit - assignedCredits;

      return res.json({
        SUCCESS: [{
          CREDIT: dhruCredit.toFixed(2),
          ASSIGNED: assignedCredits.toFixed(2),
          AVAILABLE: availableCredits.toFixed(2),
          IS_ADMIN: true
        }]
      });
    } catch (e) {
      // If Dhru fetch fails, still return local credit but indicate error
      return res.json({
        SUCCESS: [{
          CREDIT: "0"
        }]
      });
    }
  } else {
    // For normal resellers, just return their local virtual credit
    return res.json({
      SUCCESS: [{
        CREDIT: localCredit.toString()
      }]
    });
  }
};
