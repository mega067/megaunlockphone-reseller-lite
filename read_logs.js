const fs = require('fs');
const path = require('path');
const os = require('os');

const logDir = path.join(os.homedir(), 'admin', 'logs', 'sites');

if (fs.existsSync(logDir)) {
    const files = fs.readdirSync(logDir);
    console.log('Files found:', files);
    files.forEach(f => {
        console.log(`\n--- LOG FILE: ${f} ---`);
        const filePath = path.join(logDir, f);
        if (fs.statSync(filePath).isFile()) {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            const lastLines = lines.filter(l => l.trim().length > 0).slice(-20);
            console.log(lastLines.length > 0 ? lastLines.join('\n') : '(Empty)');
        }
    });
} else {
    console.log(`Log directory not found: ${logDir}`);
}
