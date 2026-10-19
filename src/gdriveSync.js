const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const { DATA_DIR } = require('./db');
const { logAuditTrail } = require('./backupEngine');

const GDRIVE_CONFIG_FILE = path.join(DATA_DIR, 'gdrive_config.json');

/**
 * Lee la configuración de Google Drive
 */
function getGDriveConfig() {
  try {
    if (fs.existsSync(GDRIVE_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(GDRIVE_CONFIG_FILE, 'utf8'));
    }
  } catch (e) {}

  // Fallback a variables de entorno si existen
  return {
    enabled: process.env.GDRIVE_ENABLED === 'true',
    folderId: process.env.GDRIVE_FOLDER_ID || '',
    appScriptUrl: process.env.GDRIVE_APPSCRIPT_URL || '',
    // Para Service Account Directa
    clientEmail: process.env.GDRIVE_CLIENT_EMAIL || '',
    privateKey: process.env.GDRIVE_PRIVATE_KEY || '',
    keepCopies: parseInt(process.env.GDRIVE_KEEP_COPIES, 10) || 7
  };
}

/**
 * Guarda la configuración de Google Drive
 */
function saveGDriveConfig(config) {
  try {
    const current = getGDriveConfig();
    const updated = {
      ...current,
      ...config,
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(GDRIVE_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
    logAuditTrail('GDRIVE_CONFIG_UPDATED', {
      enabled: updated.enabled,
      mode: updated.appScriptUrl ? 'APPSCRIPT_WEBHOOK' : (updated.clientEmail ? 'SERVICE_ACCOUNT' : 'NONE'),
      keepCopies: updated.keepCopies
    });
    return updated;
  } catch (e) {
    console.error('[GDrive Sync] Error guardando config:', e.message);
    throw e;
  }
}

/**
 * Genera un JWT firmado para Google OAuth2 Service Account sin requerir googleapis npm
 */
function generateServiceAccountToken(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodeBase64Url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const signatureInput = `${encodeBase64Url(header)}.${encodeBase64Url(claimSet)}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signatureInput);
  signer.end();
  const signature = signer.sign(privateKey.replace(/\\n/g, '\n'), 'base64url');

  return `${signatureInput}.${signature}`;
}

/**
 * Obtiene el access_token de Google Drive para la Service Account
 */
async function getAccessTokenFromServiceAccount(clientEmail, privateKey) {
  const jwt = generateServiceAccountToken(clientEmail, privateKey);
  const res = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt
  }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000
  });

  return res.data.access_token;
}

/**
 * Elimina las copias más viejas en Google Drive manteniendo solo las N más recientes
 */
async function pruneOldGoogleDriveFiles(accessToken, folderId, keepCopies = 7) {
  try {
    let q = "trashed = false and name contains 'daily_backup_' or name contains 'autobackup_'";
    if (folderId) {
      q = `'${folderId}' in parents and trashed = false`;
    }

    const listRes = await axios.get('https://www.googleapis.com/drive/v3/files', {
      params: {
        q,
        fields: 'files(id, name, createdTime)',
        orderBy: 'createdTime desc',
        pageSize: 100
      },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000
    });

    const files = listRes.data.files || [];
    if (files.length > keepCopies) {
      const toDelete = files.slice(keepCopies);
      for (const f of toDelete) {
        try {
          await axios.delete(`https://www.googleapis.com/drive/v3/files/${f.id}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10000
          });
          console.log(`[GDrive Sync] Copia antigua eliminada de Google Drive: ${f.name} (ID: ${f.id})`);
        } catch (delErr) {
          console.error(`[GDrive Sync] Error eliminando ${f.name}:`, delErr.message);
        }
      }
    }
  } catch (err) {
    console.error('[GDrive Sync] Error en rotación de Google Drive:', err.message);
  }
}

/**
 * Sube una copia de respaldo a Google Drive usando Service Account
 */
async function uploadViaServiceAccount(filePath, config) {
  const accessToken = await getAccessTokenFromServiceAccount(config.clientEmail, config.privateKey);
  const fileName = path.basename(filePath);
  const fileContent = fs.readFileSync(filePath, 'utf8');

  // 1. Crear archivo multipart
  const boundary = '-------314159265358979323846';
  const metadata = {
    name: fileName,
    mimeType: 'application/json'
  };
  if (config.folderId) {
    metadata.parents = [config.folderId];
  }

  const multipartRequestBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${fileContent}\r\n` +
    `--${boundary}--`;

  const uploadRes = await axios.post(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    multipartRequestBody,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      timeout: 30000
    }
  );

  const uploadedFile = uploadRes.data;
  console.log(`[GDrive Sync] Respaldo subido a Google Drive (ID: ${uploadedFile.id})`);

  // 2. Rotar y eliminar copias anteriores en Drive
  const keep = parseInt(config.keepCopies, 10) || 7;
  await pruneOldGoogleDriveFiles(accessToken, config.folderId, keep);

  return { success: true, fileId: uploadedFile.id, method: 'SERVICE_ACCOUNT' };
}

/**
 * Sube una copia a Google Drive vía Webhook de Google Apps Script (Método Cero Configuración de Consola)
 * El Apps Script en Google Drive se encarga de guardar el JSON y rotar los anteriores en la carpeta.
 */
async function uploadViaAppsScript(filePath, config) {
  const fileName = path.basename(filePath);
  const fileContent = fs.readFileSync(filePath, 'utf8');

  const payload = {
    action: 'backup_upload',
    filename: fileName,
    folderId: config.folderId || '',
    keepCopies: parseInt(config.keepCopies, 10) || 7,
    content: fileContent,
    uploadedAt: new Date().toISOString()
  };

  const res = await axios.post(config.appScriptUrl, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 45000,
    maxBodyLength: 50 * 1024 * 1024
  });

  return {
    success: true,
    result: res.data,
    method: 'APPSCRIPT_WEBHOOK'
  };
}

/**
 * Despachador principal: Si GDrive está habilitado, sube el archivo y rota los viejos
 */
async function syncBackupToGoogleDrive(filePath) {
  const config = getGDriveConfig();
  if (!config.enabled) {
    return { success: false, skipped: true, reason: 'GDRIVE_DISABLED' };
  }

  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'El archivo a sincronizar no existe en el disco.' };
  }

  try {
    let result;
    if (config.appScriptUrl) {
      result = await uploadViaAppsScript(filePath, config);
    } else if (config.clientEmail && config.privateKey) {
      result = await uploadViaServiceAccount(filePath, config);
    } else {
      return { success: false, error: 'Google Drive está habilitado pero faltan credenciales (Apps Script URL o Service Account).' };
    }

    logAuditTrail('GDRIVE_BACKUP_UPLOADED', {
      filename: path.basename(filePath),
      method: result.method,
      keepCopies: config.keepCopies
    });

    return result;
  } catch (err) {
    console.error('[GDrive Sync] Error sincronizando con Google Drive:', err.message);
    logAuditTrail('GDRIVE_UPLOAD_FAILED', {
      filename: path.basename(filePath),
      error: err.message
    });
    return { success: false, error: err.message };
  }
}

/**
 * Plantilla de código Google Apps Script lista para que el usuario la pegue en script.google.com
 */
function getAppsScriptTemplate() {
  return `/**
 * MegaUnlockPhone - Google Apps Script Backup Receiver
 * 1. Ve a https://script.google.com/ y crea un Nuevo Proyecto.
 * 2. Pega este código.
 * 3. Crea una carpeta en tu Google Drive (ej. "MegaBackups") y copia su ID de la URL.
 * 4. Haz clic en 'Implementar' > 'Nueva implementación'.
 * 5. Tipo: 'Aplicación web'.
 * 6. Ejecutar como: 'Yo' (tu cuenta).
 * 7. Quién tiene acceso: 'Cualquiera' (Anonymous).
 * 8. Copia la URL Web generada y pégala en el panel Admin de MegaUnlockPhone.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var filename = data.filename || ('backup_' + new Date().toISOString() + '.json');
    var folderId = data.folderId;
    var keepCopies = data.keepCopies || 7;
    
    var folder;
    if (folderId && folderId.trim() !== '') {
      folder = DriveApp.getFolderById(folderId);
    } else {
      var folders = DriveApp.getFoldersByName('MegaUnlockPhone_Backups');
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder('MegaUnlockPhone_Backups');
      }
    }
    
    // Crear el nuevo archivo de respaldo
    var newFile = folder.createFile(filename, data.content, MimeType.PLAIN_TEXT);
    
    // Rotar y eliminar copias anteriores manteniendo las últimas N
    var files = folder.getFiles();
    var fileList = [];
    while (files.hasNext()) {
      var f = files.next();
      fileList.push({
        file: f,
        created: f.getDateCreated()
      });
    }
    
    fileList.sort(function(a, b) {
      return b.created.getTime() - a.created.getTime();
    });
    
    var deletedCount = 0;
    if (fileList.length > keepCopies) {
      for (var i = keepCopies; i < fileList.length; i++) {
        fileList[i].file.setTrashed(true);
        deletedCount++;
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      fileId: newFile.getId(),
      fileName: filename,
      deletedOldCopies: deletedCount
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;
}

module.exports = {
  getGDriveConfig,
  saveGDriveConfig,
  syncBackupToGoogleDrive,
  getAppsScriptTemplate
};
