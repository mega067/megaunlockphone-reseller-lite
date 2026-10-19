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

    default:
      console.log('Comandos soportados:');
      console.log('  export [archivo.json] : Exporta un paquete completo de migración');
      console.log('  import <archivo.json> : Importa y restaura una base de datos en un nuevo host');
      console.log('  verify                : Comprueba integridad de respaldos y hash de auditoría');
      console.log('  audit [limite]        : Despliega la tabla cronológica de la caja negra');
      break;
  }
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
