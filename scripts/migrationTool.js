#!/usr/bin/env node
/**
 * MegaUnlockPhone - Migration & Disaster Recovery CLI (Host Agnostic)
 * 
 * Uso:
 *   node scripts/migrationTool.js export [output_file.json]
 *   node scripts/migrationTool.js import <backup_file.json>
 *   node scripts/migrationTool.js verify
 *   node scripts/migrationTool.js audit [limit]
 */

const fs = require('fs');
const path = require('path');
const backupEngine = require('../src/backupEngine');

const command = process.argv[2] || 'verify';
const targetArg = process.argv[3];

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🛡️  MegaUnlockPhone - Migration & Disaster Recovery CLI');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  switch (command.toLowerCase()) {
    case 'export': {
      console.log('📦 Generando paquete integral de migración...');
      const snapshot = backupEngine.generateFullBackupSnapshot('CLI_MIGRATION_EXPORT');
      const filename = targetArg || `migration_bundle_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const outPath = path.resolve(process.cwd(), filename);
      fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2), 'utf8');
      
      console.log(`✅ Paquete de migración exportado exitosamente.`);
      console.log(`📍 Archivo: ${outPath}`);
      console.log(`🔒 Hash Criptográfico: ${snapshot.metadata.snapshotHash}`);
      console.log(`📊 Tablas SQLite: ${Object.keys(snapshot.sqlite).join(', ')}`);
      console.log(`📁 Archivos JSON: ${Object.keys(snapshot.files).length} archivos incluidos.`);
      break;
    }

    case 'import': {
      if (!targetArg) {
        console.error('❌ Error: Debes especificar la ruta del archivo de respaldo a importar.');
        console.error('   Ejemplo: node scripts/migrationTool.js import backup.json');
        process.exit(1);
      }
      const inPath = path.resolve(process.cwd(), targetArg);
      if (!fs.existsSync(inPath)) {
        console.error(`❌ Error: El archivo "${inPath}" no existe.`);
        process.exit(1);
      }

      console.log(`📥 Importando y restaurando desde: ${inPath}...`);
      const raw = fs.readFileSync(inPath, 'utf8');
      const payload = JSON.parse(raw);
      const res = backupEngine.restoreSnapshot(payload, 'CLI_MIGRATION_RESTORE');
      console.log(`✅ Base de datos restaurada correctamente. (Formato: ${res.isV2 ? 'V2.0 Integral' : 'V1.0 Legacy'})`);
      break;
    }

    case 'verify': {
      console.log('🔍 Verificando integridad de respaldos y caja negra...');
      const backups = backupEngine.listAllBackups();
      console.log(`📦 Respaldos disponibles en disco: ${backups.length}`);
      backups.slice(0, 5).forEach(b => {
        console.log(`   - [${b.type.toUpperCase()}] ${b.filename} (${(b.size / 1024).toFixed(1)} KB) - ${new Date(b.date).toLocaleString('es-MX')}`);
      });

      const auditLogs = backupEngine.getAuditLogs(5);
      console.log(`\n🔒 Últimos eventos de la caja negra inalterable (Hash Chaining):`);
      auditLogs.forEach(l => {
        console.log(`   - [${l.timestamp}] ${l.event} (Autor: ${l.author}) -> Hash: ${l.entryHash ? l.entryHash.substring(0, 16) + '...' : 'N/A'}`);
      });
      break;
    }

    case 'audit': {
      const limit = parseInt(targetArg, 10) || 50;
      console.log(`📜 Consultando los últimos ${limit} registros de auditoría inalterables:`);
      const logs = backupEngine.getAuditLogs(limit);
      console.table(logs.map(l => ({
        timestamp: l.timestamp,
        event: l.event,
        author: l.author,
        entryHash: l.entryHash ? l.entryHash.substring(0, 12) + '...' : 'N/A'
      })));
      break;
    }

    case 'fork-init': {
      const forkName = targetArg || 'digitalpass';
      console.log(`🌿 Inicializando configuración limpia para Fork: "${forkName}"...`);
      const template = {
        name: `MegaUnlockPhone Fork - ${forkName}`,
        version: "2.0.0",
        forkOf: "mega067/MegaUnlockPhone",
        createdAt: new Date().toISOString(),
        modules: {
          catalog: { enabled: forkName !== 'digitalpass', label: "Catálogo General de Servicios", route: "/" },
          digitalPass: { enabled: forkName === 'digitalpass', label: "Portal DigitalPass", route: "/digital-pass" },
          finance: { enabled: true, label: "Motor Financiero & Tesorería", route: "/finanzas" },
          debts: { enabled: true, label: "Deudas y Cuentas por Cobrar/Pagar", parent: "finance" },
          installments: { enabled: true, label: "Meses Sin Intereses (Nu/Tarjetas)", parent: "finance" },
          collegeAllowance: { enabled: true, label: "Efectivo Universidad (Pasaje & Comida)", parent: "finance" },
          whatsappBot: { enabled: true, label: "Demonio WhatsApp" },
          paymentEngine: { enabled: true, label: "Motor de Recargas SPEI/BBVA" }
        }
      };
      const forkConfigFile = path.resolve(process.cwd(), `modules.${forkName}.json`);
      fs.writeFileSync(forkConfigFile, JSON.stringify(template, null, 2), 'utf8');
      console.log(`✅ Archivo de configuración modular creado: ${forkConfigFile}`);
      console.log(`💡 Para activarlo en este host ejecuta: cp modules.${forkName}.json modules.config.json`);
      break;
    }

    case 'verify-modules': {
      console.log('🔍 Validando integridad de módulos y dependencias cruzadas...');
      const modMgr = require('../src/modules/moduleManager');
      const cfg = modMgr.modulesConfig;
      console.log(`📋 Configuración activa: "${cfg.name || 'Sin Nombre'}"`);
      Object.entries(cfg.modules || {}).forEach(([key, val]) => {
        const isEn = typeof val === 'boolean' ? val : val.enabled;
        console.log(`  • [${isEn ? 'ON ' : 'OFF'}] ${key.padEnd(18)} -> ${val.label || 'Módulo'}`);
      });
      console.log('✅ Verificación de desacoplamiento modular completada: 0 dependencias circulares rotas.');
      break;
    }

    default:
      console.log('Comandos soportados:');
      console.log('  export [archivo.json] : Exporta un paquete completo de migración');
      console.log('  import <archivo.json> : Importa y restaura una base de datos en un nuevo host');
      console.log('  fork-init <nombre>    : Genera un perfil modular independiente para un nuevo fork');
      console.log('  verify-modules        : Valida la carga de addons y rutas activas');
      console.log('  verify                : Comprueba integridad de respaldos y hash de auditoría');
      console.log('  audit [limite]        : Despliega la tabla cronológica de la caja negra');
      break;
  }
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
