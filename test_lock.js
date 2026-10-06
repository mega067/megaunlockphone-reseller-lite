const fs = require('fs');
const path = require('path');
const lockFile = path.join(__dirname, 'bot.lock');

function acquireLock() {
    try {
        if (fs.existsSync(lockFile)) {
            const stats = fs.statSync(lockFile);
            if (Date.now() - stats.mtimeMs < 60000) {
                console.log('Another instance is running (lock is fresh). Exiting.');
                return false;
            }
        }
        fs.writeFileSync(lockFile, process.pid.toString());
        setInterval(() => {
            try { fs.utimesSync(lockFile, new Date(), new Date()); } catch (e) {}
        }, 10000);
        return true;
    } catch (e) {
        return true;
    }
}
console.log(acquireLock());
