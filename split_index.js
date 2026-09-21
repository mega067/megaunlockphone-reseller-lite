const fs = require('fs');

const file = fs.readFileSync('public/index.js', 'utf8');
const lines = file.split('\n');

// Find the line that starts with document.addEventListener('DOMContentLoaded', () => {
let startIndex = -1;
let endIndex = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("document.addEventListener('DOMContentLoaded', () => {")) {
    startIndex = i;
  }
}
// Find the closing });
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].trim() === '});') {
    endIndex = i;
    break;
  }
}

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find DOMContentLoaded block");
  process.exit(1);
}

console.log(`DOMContentLoaded from line ${startIndex + 1} to ${endIndex + 1}`);

// We will remove the wrapper
lines[startIndex] = '// DOMContentLoaded Wrapper Removed';
lines[endIndex] = '// End Wrapper Removed';

// We need to fix the indentation by unindenting everything inside by 2 spaces
for (let i = startIndex + 1; i < endIndex; i++) {
  if (lines[i].startsWith('  ')) {
    lines[i] = lines[i].substring(2);
  }
}

fs.writeFileSync('public/index.js', lines.join('\n'));
console.log('Unwrapped index.js successfully!');
