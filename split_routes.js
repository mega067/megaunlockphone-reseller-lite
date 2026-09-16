const fs = require('fs');

const serverCode = fs.readFileSync('server.js', 'utf8');
const lines = serverCode.split('\n');

function extractBlock(startRegex, endRegex) {
  let startIndex = -1;
  let endIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (startIndex === -1 && startRegex.test(lines[i])) {
      startIndex = i;
    }
    if (startIndex !== -1 && endRegex.test(lines[i])) {
      endIndex = i;
      break;
    }
  }
  return { startIndex, endIndex };
}

// Find bot routes
const botStart = /^app\.(post|get)\('\/api\/bot/;
const botEnd = /^\s*\}\);/; 
// Actually regex extraction is brittle for JS because of nested brackets.
