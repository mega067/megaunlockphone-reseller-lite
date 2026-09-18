const fs = require('fs');

let content = fs.readFileSync('public/index.js', 'utf8');

// 1. Remove DOM variables for console
content = content.replace(/const consoleCount = document.getElementById\('consoleCount'\);\n/g, '');
content = content.replace(/const consoleEmpty = document.getElementById\('consoleEmpty'\);\n/g, '');
content = content.replace(/const consoleList = document.getElementById\('consoleList'\);\n/g, '');
content = content.replace(/const btnClearConsole = document.getElementById\('btnClearConsole'\);\n/g, '');

// 2. Remove consoleLogList
content = content.replace(/let consoleLogList = \[\];\n/g, '');

// 3. Remove btnClearConsole listener block
content = content.replace(/\/\/ Clear Console\s+btnClearConsole\.addEventListener\('click', \(\) => \{\s+consoleLogList = \[\];\s+renderConsoleLogs\(\);\s+\}\);\n/g, '');

// 4. Remove logApiCall and dependencies
content = content.replace(/\/\/ ============================================\s+\/\/ DEBUG API CALLS LOGGING LOGIC\s+\/\/ ============================================\s+function maskApiKey[\s\S]*?renderConsoleLogs\(\) \{[\s\S]*?consoleList\.appendChild\(item\);\s+\}\);\s+\}/g, '');

// 5. Remove all logApiCall(...) invocations anywhere
content = content.replace(/^\s*logApiCall\(.*?\);\s*$/gm, '');

fs.writeFileSync('public/index.js', content);
