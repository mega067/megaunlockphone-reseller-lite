const path = require('path');
const { readDB, writeDB } = require('../../src/db');

const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const WHATSAPP_USERS_FILE = path.join(DATA_DIR, 'whatsapp_users.json');

async function vincular(context) {
    const { sock, remoteJid, firstWord, text, sessionManager, wusers, isGroup } = context;

    const lowerWord = firstWord.toLowerCase();
    const isLinked = !!(wusers[remoteJid] || (remoteJid && Object.keys(wusers).some(k => k.split('@')[0].replace(/\D/g, '') === remoteJid.split('@')[0].replace(/\D/g, ''))));

    const vincularTriggers = ['/vincular', '!vincular', 'vincular'];
    const greetingTriggers = ['hola', 'buenas', 'buenos', 'saludos', 'inicio', 'start', '/start', 'vincularme', 'conectar'];

    // Si escribe vincular directamente, O si NO está vinculado y manda un saludo/inicio en privado:
    if (vincularTriggers.includes(lowerWord) || (!isLinked && !isGroup && greetingTriggers.includes(lowerWord))) {
        sessionManager.loginSessions = sessionManager.loginSessions || {};
        
        // Verificar si este número ya está registrado en la base de datos (incluso múltiples cuentas)
        const rawDigits = remoteJid.split('@')[0].replace(/\D/g, '');
        const users = readDB(USERS_FILE) || [];
        const matchingUsers = users.filter(u => {
            if (!u.phone) return false;
            const uClean = String(u.phone).replace(/\D/g, '');
            return uClean === rawDigits || (uClean.length >= 10 && rawDigits.endsWith(uClean.slice(-10)));
        });

        if (matchingUsers.length > 1) {
            sessionManager.loginSessions[remoteJid] = { 
                step: 'select_account', 
                availableUsers: matchingUsers 
            };
            let listTxt = '👋 *¡Hola! Cuentas encontradas con tu número*\n━━━━━━━━━━━━━━━━━━━━━━\nEncontramos más de una cuenta con tu teléfono. ¿A cuál deseas conectar este WhatsApp?\n\n';
            matchingUsers.forEach((u, idx) => {
                listTxt += `*${idx + 1}.* 👤 Usuario: *${u.username}* (Rol: ${u.role})\n`;
            });
            listTxt += `\n👉 Responde con el *número de la opción* (ej. 1 o 2). ¡No necesitas contraseña!`;
            await sock.sendMessage(remoteJid, { text: listTxt });
            return true;
        }

        if (matchingUsers.length === 1) {
            const matchedUser = matchingUsers[0];
            // Unlink any prior session for this user ID if needed
            Object.keys(wusers).forEach(jid => {
                if (wusers[jid] === matchedUser.id) delete wusers[jid];
            });
            wusers[remoteJid] = matchedUser.id;
            writeDB(WHATSAPP_USERS_FILE, wusers);

            delete sessionManager.loginSessions[remoteJid];
            await sock.sendMessage(remoteJid, { 
                text: `✨ *¡Bienvenido de nuevo, ${matchedUser.username}!* ✨\n━━━━━━━━━━━━━━━━━━━━━━\n🔗 Tu WhatsApp ha sido *vinculado automáticamente* a tu cuenta de MegaUnlockPhone.\n\n📱 Ahora recibirás aquí las notificaciones de tus pedidos y recargas.\n\n💡 *Comandos disponibles:*\n• *saldo* - Ver tus créditos\n• *pedir* - Realizar un pedido\n• *pedidos* - Ver tus órdenes\n• *desactivar* - Si deseas silenciar avisos\n• *ayuda* - Ver menú completo` 
            });
            return true;
        }

        sessionManager.loginSessions[remoteJid] = { step: 1 };
        await sock.sendMessage(remoteJid, { text: '👋 ¡Hola! Para comenzar y activar tu cuenta en WhatsApp:\n\n🔗 *Vincular Cuenta de MegaUnlockPhone*\nPor favor, responde con tu *nombre de usuario* (username) de la plataforma:' });
        return true;
    }

    sessionManager.loginSessions = sessionManager.loginSessions || {};
    if (sessionManager.loginSessions[remoteJid]) {
        const session = sessionManager.loginSessions[remoteJid];
        
        if (text.toLowerCase() === 'cancelar') {
            delete sessionManager.loginSessions[remoteJid];
            await sock.sendMessage(remoteJid, { text: '🚫 Operación cancelada.' });
            return true;
        }

        // Selección de cuenta si hay varias asociadas al número (sin contraseña requerida)
        if (session.step === 'select_account') {
            const choice = parseInt(text.trim(), 10);
            if (isNaN(choice) || choice < 1 || choice > session.availableUsers.length) {
                await sock.sendMessage(remoteJid, { text: `❌ Opción no válida. Por favor responde con un número del 1 al ${session.availableUsers.length} o escribe "cancelar".` });
                return true;
            }

            const chosenUser = session.availableUsers[choice - 1];
            Object.keys(wusers).forEach(jid => {
                if (wusers[jid] === chosenUser.id) delete wusers[jid];
            });
            wusers[remoteJid] = chosenUser.id;
            writeDB(WHATSAPP_USERS_FILE, wusers);

            delete sessionManager.loginSessions[remoteJid];
            await sock.sendMessage(remoteJid, { 
                text: `✅ *¡Cuenta vinculada con éxito!*\n━━━━━━━━━━━━━━━━━━━━━━\nConectado como: *${chosenUser.username}*.\n\n📱 Recibirás aquí tus notificaciones en tiempo real.\n💡 Escribe *saldo*, *pedidos* o *ayuda* para comenzar.` 
            });
            return true;
        }

        if (session.step === 1) {
            session.username = text.trim();
            session.step = 2;
            await sock.sendMessage(remoteJid, { text: '🔑 Ahora ingresa tu *contraseña*:' });
            return true;
        } else if (session.step === 2) {
            const password = text.trim();
            const username = session.username;
            
            const users = readDB(USERS_FILE) || [];
            const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

            if (!user) {
                await sock.sendMessage(remoteJid, { text: '❌ Usuario no encontrado. Por favor revisa y vuelve a iniciar con /vincular' });
                delete sessionManager.loginSessions[remoteJid];
                return true;
            }

            if (user.password !== password) {
                await sock.sendMessage(remoteJid, { text: '❌ Contraseña incorrecta.\n\n_¿La olvidaste? Puedes escribir */recuperar* para recibir un código de restablecimiento aquí mismo._' });
                delete sessionManager.loginSessions[remoteJid];
                return true;
            }

            // Unlink any old numbers associated with this user
            Object.keys(wusers).forEach(jid => {
                if (wusers[jid] === user.id) {
                    delete wusers[jid];
                }
            });

            // Success, link new account
            wusers[remoteJid] = user.id;
            writeDB(WHATSAPP_USERS_FILE, wusers);
            
            delete sessionManager.loginSessions[remoteJid];
            await sock.sendMessage(remoteJid, { text: `✅ ¡Cuenta vinculada exitosamente!\n\nBienvenido, *${user.username}*.\nAhora puedes usar comandos como /saldo, /recargar, /pedir, etc.` });
            return true;
        }
    }
    
    // FLUJO DE RECUPERACIÓN DE CONTRASEÑA DIRECTO POR BOT
    const recoveryTriggers = ['/recuperar', '!recuperar', 'recuperar'];
    if (recoveryTriggers.includes(lowerWord)) {
        sessionManager.recoverySessions = sessionManager.recoverySessions || {};
        const rawDigits = remoteJid.split('@')[0].replace(/\D/g, '');
        const users = readDB(USERS_FILE) || [];
        
        // Buscar cuentas asociadas a este JID o a este teléfono
        const matchingUsers = users.filter(u => {
            if (wusers[remoteJid] === u.id) return true;
            if (!u.phone) return false;
            const uClean = String(u.phone).replace(/\D/g, '');
            return uClean === rawDigits || (uClean.length >= 10 && rawDigits.endsWith(uClean.slice(-10)));
        });

        if (matchingUsers.length === 0) {
            await sock.sendMessage(remoteJid, { 
                text: '❌ No encontramos ninguna cuenta vinculada o registrada con este número de WhatsApp.\n\nSi necesitas ayuda, puedes contactar al administrador directamente.' 
            });
            return true;
        }

        let targetUser = matchingUsers[0];
        if (matchingUsers.length > 1) {
            sessionManager.recoverySessions[remoteJid] = {
                step: 'select_account',
                availableUsers: matchingUsers
            };
            let listTxt = '🔐 *Recuperación de Contraseña*\n\nTienes más de una cuenta con este teléfono. ¿Cuál deseas restablecer?\n\n';
            matchingUsers.forEach((u, idx) => {
                listTxt += `*${idx + 1}.* 👤 *${u.username}*\n`;
            });
            listTxt += `\n👉 Escribe el *número de la opción* (o escribe "cancelar"):`;
            await sock.sendMessage(remoteJid, { text: listTxt });
            return true;
        }

        // Generar código OTP de 6 dígitos
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        sessionManager.recoverySessions[remoteJid] = {
            step: 'verify_otp',
            userId: targetUser.id,
            username: targetUser.username,
            code: otpCode,
            expires: Date.now() + 10 * 60 * 1000
        };

        await sock.sendMessage(remoteJid, { 
            text: `🔐 *Código de Seguridad generado*\n\nHola *${targetUser.username}*, tu código OTP para cambiar tu contraseña es:\n\n*${otpCode}*\n\n👉 Por favor, reenvía o escribe el código de 6 dígitos para continuar (o "cancelar"):` 
        });
        return true;
    }

    sessionManager.recoverySessions = sessionManager.recoverySessions || {};
    if (sessionManager.recoverySessions[remoteJid]) {
        const session = sessionManager.recoverySessions[remoteJid];
        
        if (text.toLowerCase() === 'cancelar') {
            delete sessionManager.recoverySessions[remoteJid];
            await sock.sendMessage(remoteJid, { text: '🚫 Recuperación cancelada.' });
            return true;
        }

        if (session.step === 'select_account') {
            const choice = parseInt(text.trim(), 10);
            if (isNaN(choice) || choice < 1 || choice > session.availableUsers.length) {
                await sock.sendMessage(remoteJid, { text: `❌ Opción no válida. Responde con un número del 1 al ${session.availableUsers.length} o "cancelar".` });
                return true;
            }
            const chosen = session.availableUsers[choice - 1];
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            sessionManager.recoverySessions[remoteJid] = {
                step: 'verify_otp',
                userId: chosen.id,
                username: chosen.username,
                code: otpCode,
                expires: Date.now() + 10 * 60 * 1000
            };
            await sock.sendMessage(remoteJid, { 
                text: `🔐 *Código de Seguridad para ${chosen.username}*\n\nTu código OTP es:\n*${otpCode}*\n\n👉 Por favor, escribe este código de 6 dígitos para validar tu identidad:` 
            });
            return true;
        }

        if (session.step === 'verify_otp') {
            if (Date.now() > session.expires) {
                delete sessionManager.recoverySessions[remoteJid];
                await sock.sendMessage(remoteJid, { text: '⏰ El código ha expirado. Escribe */recuperar* para solicitar uno nuevo.' });
                return true;
            }

            if (text.trim() !== session.code) {
                await sock.sendMessage(remoteJid, { text: '❌ Código incorrecto. Por favor verifícalo y escribe el código de 6 dígitos de nuevo (o "cancelar"):' });
                return true;
            }

            session.step = 'new_password';
            await sock.sendMessage(remoteJid, { text: `✅ ¡Identidad confirmada!\n\n🔑 Ahora escribe tu *nueva contraseña* para la cuenta *${session.username}* (mínimo 6 caracteres):` });
            return true;
        }

        if (session.step === 'new_password') {
            const newPass = text.trim();
            if (newPass.length < 6) {
                await sock.sendMessage(remoteJid, { text: '❌ La contraseña debe tener al menos 6 caracteres. Por favor ingresa una más segura:' });
                return true;
            }

            const users = readDB(USERS_FILE) || [];
            const userIdx = users.findIndex(u => String(u.id) === String(session.userId));
            if (userIdx === -1) {
                delete sessionManager.recoverySessions[remoteJid];
                await sock.sendMessage(remoteJid, { text: '❌ No se pudo actualizar el usuario.' });
                return true;
            }

            users[userIdx].password = newPass;
            writeDB(USERS_FILE, users);

            // Asegurar que quede vinculada
            wusers[remoteJid] = users[userIdx].id;
            writeDB(WHATSAPP_USERS_FILE, wusers);

            delete sessionManager.recoverySessions[remoteJid];
            await sock.sendMessage(remoteJid, { 
                text: `🎉 *¡Contraseña actualizada exitosamente!*\n\nTu nueva contraseña ha sido guardada y tu cuenta *${users[userIdx].username}* quedó vinculada a este WhatsApp.\n\nYa puedes usar el bot con /saldo, /bus, /pedir, etc.` 
            });
            return true;
        }
    }

    return false;
}

module.exports = vincular;
