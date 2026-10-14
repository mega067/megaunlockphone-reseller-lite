const fs = require('fs');
let code = fs.readFileSync('public/index.js', 'utf8');

code = code.replace(
    /document\.getElementById\('adminToggleImei'\)\.addEventListener\('change', async \(e\) => {[\s\S]*?}\);/,
    `document.getElementById('adminToggleImei').addEventListener('change', async (e) => {
        try {
          if (e.target.checked) {
            imeiInputGroup.classList.add('hidden');
            imeiInput.removeAttribute('required');
            imeiInput.removeAttribute('minlength');
            imeiInput.removeAttribute('maxlength');
            imeiAutoGenerate.checked = true;
          } else {
            imeiInputGroup.classList.remove('hidden');
            imeiInput.setAttribute('required', 'true');
            imeiAutoGenerate.checked = false;
          }
          imeiAutoGenerate.dispatchEvent(new Event('change'));
          
          await fetch('/api/admin/disable-imei', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Server-Id': currentServerId,
              'Authorization': \`Bearer \${authToken}\`
            },
            body: JSON.stringify({ serviceId: product.serviceid.toString(), disabled: e.target.checked })
          });
          syncProducts(false);
        } catch (err) {}
      });`
);

fs.writeFileSync('public/index.js', code);
