const fs = require('fs');

function extractChunk(regexStart, regexEnd, outputFilename, sourceFile = 'public/index.js') {
  const lines = fs.readFileSync(sourceFile, 'utf8').split('\n');
  let startIndex = -1;
  let endIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (startIndex === -1 && lines[i].match(regexStart)) {
      startIndex = i;
    } else if (startIndex !== -1 && lines[i].match(regexEnd)) {
      endIndex = i;
      break;
    }
  }
  
  if (startIndex === -1 || endIndex === -1) {
    console.log(`Could not find bounds for ${outputFilename}`);
    return;
  }
  
  const chunk = lines.slice(startIndex, endIndex + 1).join('\n');
  fs.writeFileSync(outputFilename, chunk);
  
  // Remove chunk from source
  lines.splice(startIndex, endIndex - startIndex + 1);
  fs.writeFileSync(sourceFile, lines.join('\n'));
  console.log(`Extracted ${outputFilename} (lines ${startIndex}-${endIndex})`);
}

// Admin chunk: from async function loadAdminData to the end of generateCouponImage
// Actually, let's just extract Admin features
extractChunk(/^async function loadAdminData/, /^async function generateCouponImage.*\}$/, 'public/js/admin.js');

