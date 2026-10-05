const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');
html = html.replace('<button type="submit" class="btn btn-primary" id="btnSaveAdminSettings" style="width: 100%; justify-content: center;">', 
`<div class="input-group" style="flex-direction: row; align-items: center; gap: 8px;">
                  <input type="checkbox" id="inputDisableImei" style="width: 18px; height: 18px; accent-color: #8b5cf6;">
                  <label for="inputDisableImei" style="margin: 0; cursor: pointer;">Deshabilitar Campo IMEI Globalmente (Auto-generar)</label>
                </div>
                <button type="submit" class="btn btn-primary" id="btnSaveAdminSettings" style="width: 100%; justify-content: center; margin-top: 10px;">`);
html = html.replace('<i data-lucide="save"></i> Guardar Precios', '<i data-lucide="save"></i> Guardar Ajustes');
fs.writeFileSync('public/index.html', html);
