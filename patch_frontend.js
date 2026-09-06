const fs = require('fs');
let code = fs.readFileSync('public/index.js', 'utf8');

// 1. Add currentServerId and Slider Logic at the top
const sliderLogic = `
let currentServerId = localStorage.getItem('currentServerId') || '1';

function updateSliderUI() {
  const btn1 = document.getElementById('btnServer1');
  const btn2 = document.getElementById('btnServer2');
  const indicator = document.getElementById('serverSwitchIndicator');
  
  if (currentServerId === '1') {
    btn1.classList.add('active');
    btn1.style.color = 'white';
    btn2.classList.remove('active');
    btn2.style.color = 'rgba(255,255,255,0.6)';
    indicator.style.transform = 'translateX(0)';
  } else {
    btn2.classList.add('active');
    btn2.style.color = 'white';
    btn1.classList.remove('active');
    btn1.style.color = 'rgba(255,255,255,0.6)';
    indicator.style.transform = 'translateX(100%)';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const switchContainer = document.getElementById('serverSwitchContainer');
  if (switchContainer) {
    updateSliderUI();
    
    document.getElementById('btnServer1').addEventListener('click', () => {
      if (currentServerId !== '1') {
        currentServerId = '1';
        localStorage.setItem('currentServerId', '1');
        updateSliderUI();
        if (authToken) {
          fetchBalance();
          fetchProducts();
          if (!document.getElementById('historyView').classList.contains('hidden')) {
            loadHistory();
          }
        }
      }
    });

    document.getElementById('btnServer2').addEventListener('click', () => {
      if (currentServerId !== '2') {
        currentServerId = '2';
        localStorage.setItem('currentServerId', '2');
        updateSliderUI();
        if (authToken) {
          fetchBalance();
          fetchProducts();
          if (!document.getElementById('historyView').classList.contains('hidden')) {
            loadHistory();
          }
        }
      }
    });
  }
});
`;

// Insert after let authToken
code = code.replace(/let authToken = localStorage\.getItem\('authToken'\);/, "let authToken = localStorage.getItem('authToken');\n" + sliderLogic);

// Make sure serverSwitchContainer is unhidden on login
code = code.replace(/document\.getElementById\('creditsBadgeContainer'\)\.classList\.remove\('hidden'\);/, "document.getElementById('creditsBadgeContainer').classList.remove('hidden');\n    const ssc = document.getElementById('serverSwitchContainer');\n    if (ssc) ssc.classList.remove('hidden');");

// 2. Add X-Server-Id to every fetch call
code = code.replace(/headers: \{/g, "headers: { 'X-Server-Id': currentServerId,");
// Also add to fetch calls that don't have headers yet:
// fetch('/api/login', { method: 'POST', headers: { ... } }) -> This has headers already.
// fetch('/api/debug/history' -> This might not have headers, but we don't care.

// 3. Fix Admin settings loading
const adminLoadSettings = `const set = await settingsRes.json();
        const currentSet = currentServerId === '2' ? set.server2 : set.server1;
        if (currentSet) {
          inputResellerMarkup.value = parseFloat(currentSet.resellerMarkup || 0).toFixed(2);
          inputClientMarkup.value = parseFloat(currentSet.clientMarkup || 0).toFixed(2);
        }`;
code = code.replace(/const set = await settingsRes\.json\(\);\n\s*inputResellerMarkup\.value = [^;]+;\n\s*inputClientMarkup\.value = [^;]+;/, adminLoadSettings);

// 4. Fix Admin settings saving
const adminSaveSettings = `const payload = currentServerId === '2' 
          ? { server2: { resellerMarkup: resellerMarkup, clientMarkup: clientMarkup } }
          : { server1: { resellerMarkup: resellerMarkup, clientMarkup: clientMarkup } };
        
        const res = await fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'X-Server-Id': currentServerId, 'Content-Type': 'application/json', 'Authorization': \`Bearer \${authToken}\` },
          body: JSON.stringify(payload)`;
code = code.replace(/const res = await fetch\('\/api\/admin\/settings', \{\n\s*method: 'POST',\n\s*headers: \{ 'X-Server-Id': currentServerId, 'Content-Type': 'application\/json', 'Authorization': `Bearer \$\{authToken\}` \},\n\s*body: JSON\.stringify\(\{ resellerMarkup, clientMarkup \}\)/, adminSaveSettings);

fs.writeFileSync('public/index.js', code);
console.log('Frontend index.js patched.');
