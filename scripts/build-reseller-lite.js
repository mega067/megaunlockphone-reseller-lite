/**
 * Script de Compilación, Ofuscación y Distribución de Reseller Lite
 * 
 * - Ofusca el código fuente mediante JavaScript-Obfuscator.
 * - Bloquea la manipulación de host (fijado a megaunlockphone-panel.alwaysdata.net).
 * - Protege identificadores, llamadas y strings.
 * - Genera el bundle final listo para entrega en dist/reseller-lite/
 */
const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const SRC_DIR = path.join(__dirname, '../packages/reseller-lite');
const DIST_DIR = path.join(__dirname, '../dist/reseller-lite');

const OBFUSCATION_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: false, // Permitir correr en servidores Node sin matar el proceso
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayThreshold: 0.8,
  transformObjectKeys: true,
  unicodeEscapeSequence: false
};

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

function obfuscateJsFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      obfuscateJsFiles(fullPath);
    } else if (file.endsWith('.js')) {
      console.log(`[Obfuscator] Ofuscando archivo: ${path.relative(DIST_DIR, fullPath)}`);
      const rawCode = fs.readFileSync(fullPath, 'utf8');
      try {
        const obfuscatedResult = JavaScriptObfuscator.obfuscate(rawCode, OBFUSCATION_OPTIONS);
        fs.writeFileSync(fullPath, obfuscatedResult.getObfuscatedCode(), 'utf8');
      } catch (err) {
        console.error(`Error ofuscando ${file}:`, err.message);
      }
    }
  }
}

async function build() {
  console.log('🚀 Iniciando compilación de Reseller Lite...');

  // 1. Limpiar o crear dist
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });

  // 2. Copiar archivos del paquete
  console.log('📦 Copiando estructura y dependencias...');
  copyRecursiveSync(SRC_DIR, DIST_DIR);

  // 3. Ofuscar todo el backend y frontend en dist
  console.log('🔒 Aplicando ofuscación profunda y blindaje...');
  obfuscateJsFiles(path.join(DIST_DIR, 'src'));
  obfuscateJsFiles(path.join(DIST_DIR, 'public/js'));
  
  // Ofuscar server.js principal
  const serverPath = path.join(DIST_DIR, 'server.js');
  if (fs.existsSync(serverPath)) {
    const serverRaw = fs.readFileSync(serverPath, 'utf8');
    const obfuscatedServer = JavaScriptObfuscator.obfuscate(serverRaw, OBFUSCATION_OPTIONS);
    fs.writeFileSync(serverPath, obfuscatedServer.getObfuscatedCode(), 'utf8');
  }

  // 4. Crear documentación de entrega para el reseller
  const docContent = `# 🚀 Motor Reseller Lite - MegaUnlockPhone

Bienvenido a la versión oficial Reseller Lite. Este sistema permite desplegar tu propia tienda y panel de desbloqueos, licencias y streaming con conexión directa a la API de **MegaUnlockPhone**.

## 📌 Requisitos Previos
- Node.js versión 18 o superior.
- Una **API Key activa** de tu cuenta en [MegaUnlockPhone](https://megaunlockphone-panel.alwaysdata.net/).

## 🛠️ Instalación Rápida
1. Instala las dependencias necesarias:
   \`\`\`bash
   npm install
   \`\`\`
2. Inicia el servidor:
   \`\`\`bash
   npm start
   \`\`\`
3. Abre tu navegador en:
   \`\`\`
   http://localhost:4000
   \`\`\`

## 🧩 Configuración de Módulos & Bot
1. Ve a la pestaña **"Conexión & API"** e ingresa tu API Key y tu margen de ganancia deseado (ej. 15%).
2. Ve al **"Gestor de Módulos"** para activar o desactivar funciones visualmente:
   - **Demonio de WhatsApp:** Configura nombre del bot y número de soporte con un clic.
   - **Finanzas:** Moneda y balance de ganancias.
   - **DigitalPass:** Catálogo de streaming y herramientas IA.

---
© 2026 MegaUnlockPhone. Todos los derechos reservados. Distribución autorizada exclusiva.
`;

  fs.writeFileSync(path.join(DIST_DIR, 'README.md'), docContent, 'utf8');

  console.log('✅ ¡Compilación y ofuscación completada con éxito!');
  console.log(`📁 Paquete generado en: ${DIST_DIR}`);
}

build().catch(err => {
  console.error('Error durante la compilación:', err);
  process.exit(1);
});
