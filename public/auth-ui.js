function createModal(id, content) {
    const modal = document.createElement('div');
    modal.id = id;
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;";
    modal.innerHTML = `
        <div class="card" style="width:90%; max-width:400px; padding:20px; position:relative;">
            <button onclick="document.getElementById('${id}').remove()" style="position:absolute; top:10px; right:15px; background:transparent; border:none; color:white; font-size:20px; cursor:pointer;">&times;</button>
            ${content}
        </div>
    `;
    document.body.appendChild(modal);
}

// Global functions so index.js can call them
window.showEmailLinkModal = function(tempId) {
    createModal('emailModal', `
        <h3 style="margin-bottom:15px;">Vincular Correo (Requerido)</h3>
        <p style="font-size:14px; margin-bottom:15px; color:#aaa;">Por nueva política de seguridad, tu cuenta requiere un correo.</p>
        <form id="emailLinkForm">
            <div class="input-group">
                <label>Correo Electrónico</label>
                <input type="email" id="linkEmail" required style="width:100%; padding:10px; border-radius:5px; background:#222; border:1px solid #444; color:white;">
            </div>
            <div class="input-group" style="margin-top:10px;">
                <label>Confirma tu Contraseña</label>
                <input type="password" id="linkPass" required style="width:100%; padding:10px; border-radius:5px; background:#222; border:1px solid #444; color:white;">
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top:20px; width:100%;">Vincular y Continuar</button>
        </form>
    `);

    document.getElementById('emailLinkForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('linkEmail').value;
        const password = document.getElementById('linkPass').value;
        const res = await fetch('/api/link-email', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ tempId, email, password })
        });
        const data = await res.json();
        if(res.ok) {
            alert(data.message);
            document.getElementById('emailModal').remove();
        } else {
            alert(data.error);
        }
    });
};

window.showTotpModal = function(username, password) {
    createModal('totpModal', `
        <h3 style="margin-bottom:15px;">Verificación 2FA</h3>
        <p style="font-size:14px; margin-bottom:15px; color:#aaa;">Ingresa el código de Google Authenticator.</p>
        <form id="totpForm">
            <div class="input-group">
                <label>Código 6 dígitos</label>
                <input type="text" id="totpCode" required style="width:100%; padding:10px; border-radius:5px; background:#222; border:1px solid #444; color:white;">
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top:20px; width:100%;">Verificar</button>
        </form>
    `);

    document.getElementById('totpForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const totpCode = document.getElementById('totpCode').value;
        // Resubmit login with TOTP
        const res = await fetch('/api/login', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ username, password, totpCode })
        });
        const data = await res.json();
        if(res.ok) {
            document.getElementById('totpModal').remove();
            // Store tokens and proceed
            localStorage.setItem('dhru_token', data.token);
            localStorage.setItem('dhru_role', data.role);
            localStorage.setItem('dhru_username', data.username);
            localStorage.setItem('dhru_uid', data.uid);
            
            document.getElementById('loginView').classList.add('hidden');
            document.getElementById('dashboardView').classList.remove('hidden');
            document.getElementById('btnLogout').classList.remove('hidden');
        } else {
            alert(data.error);
        }
    });
};

function showRegisterModal() {
    createModal('registerModal', `
        <h3 style="margin-bottom:15px;">Crear Nueva Cuenta</h3>
        <form id="registerForm">
            <div class="input-group">
                <label>Usuario</label>
                <input type="text" id="regUser" required style="width:100%; padding:10px; background:#222; border:1px solid #444; color:white; border-radius:5px;">
            </div>
            <div class="input-group" style="margin-top:10px;">
                <label>Correo Electrónico</label>
                <input type="email" id="regEmail" required style="width:100%; padding:10px; background:#222; border:1px solid #444; color:white; border-radius:5px;">
            </div>
            <div class="input-group" style="margin-top:10px;">
                <label>Contraseña</label>
                <input type="password" id="regPass" required style="width:100%; padding:10px; background:#222; border:1px solid #444; color:white; border-radius:5px;">
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top:20px; width:100%;">Registrarse</button>
        </form>
    `);

    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('regUser').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPass').value;
        const res = await fetch('/api/register', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        if(res.ok) {
            alert(data.message);
            document.getElementById('registerModal').remove();
        } else {
            alert(data.error);
        }
    });
}

function showForgotModal() {
    createModal('forgotModal', `
        <h3 style="margin-bottom:15px;">Recuperar Contraseña</h3>
        <div id="forgotStep1">
            <p style="font-size:14px; margin-bottom:15px; color:#aaa;">Te enviaremos un código a tu correo.</p>
            <div class="input-group">
                <label>Correo Electrónico</label>
                <input type="email" id="forgotEmail" required style="width:100%; padding:10px; background:#222; border:1px solid #444; color:white; border-radius:5px;">
            </div>
            <button onclick="sendForgotCode()" class="btn btn-primary" style="margin-top:20px; width:100%;">Enviar Código</button>
        </div>
        <div id="forgotStep2" style="display:none;">
            <div class="input-group">
                <label>Código recibido</label>
                <input type="text" id="forgotCode" required style="width:100%; padding:10px; background:#222; border:1px solid #444; color:white; border-radius:5px;">
            </div>
            <div class="input-group" style="margin-top:10px;">
                <label>Nueva Contraseña</label>
                <input type="password" id="forgotPass" required style="width:100%; padding:10px; background:#222; border:1px solid #444; color:white; border-radius:5px;">
            </div>
            <button onclick="resetPassword()" class="btn btn-primary" style="margin-top:20px; width:100%;">Restablecer</button>
        </div>
    `);
}

window.sendForgotCode = async function() {
    const email = document.getElementById('forgotEmail').value;
    const res = await fetch('/api/forgot-password', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email })
    });
    const data = await res.json();
    alert(data.message);
    document.getElementById('forgotStep1').style.display = 'none';
    document.getElementById('forgotStep2').style.display = 'block';
}

window.resetPassword = async function() {
    const email = document.getElementById('forgotEmail').value;
    const code = document.getElementById('forgotCode').value;
    const newPassword = document.getElementById('forgotPass').value;
    const res = await fetch('/api/reset-password', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email, code, newPassword })
    });
    const data = await res.json();
    if(res.ok) {
        alert(data.message);
        document.getElementById('forgotModal').remove();
    } else {
        alert(data.error);
    }
}

// Add links to existing login form
setTimeout(() => {
    const form = document.getElementById('credentialsForm');
    if (form) {
        const div = document.createElement('div');
        div.style = "display:flex; justify-content:space-between; margin-top:15px; font-size:14px;";
        div.innerHTML = `
            <a href="#" onclick="showRegisterModal()" style="color:#22d3ee; text-decoration:none;">Crear cuenta</a>
            <a href="#" onclick="showForgotModal()" style="color:#22d3ee; text-decoration:none;">¿Olvidaste tu clave?</a>
        `;
        form.appendChild(div);
    }
}, 500);
