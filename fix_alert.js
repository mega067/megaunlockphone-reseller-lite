const fs = require('fs');
let content = fs.readFileSync('public/index.js', 'utf8');

// Replace alert
content = content.replace(
`        if (data.error_msg) {
            alert(data.error_msg);
            setLoadingState(false);
            if (document.getElementById('globalLoadingOverlay')) document.getElementById('globalLoadingOverlay').classList.add('hidden');
            updateStatus('offline', 'Error API');
            return;
        }`,
`        if (data.error_msg) {
            throw new Error(data.error_msg);
        }`
);

// Update the catch block to include 403
content = content.replace(
`      if (errMsg.toLowerCase().includes('failed to fetch') || errMsg.toLowerCase().includes('networkerror') || errMsg.includes('500') || errMsg.includes('503') || errMsg.includes('502')) {`,
`      if (errMsg.toLowerCase().includes('failed to fetch') || errMsg.toLowerCase().includes('networkerror') || errMsg.includes('500') || errMsg.includes('503') || errMsg.includes('502') || errMsg.includes('403')) {`
);

fs.writeFileSync('public/index.js', content);
