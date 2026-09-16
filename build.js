const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const inputFile = path.join(__dirname, 'public', 'index.js');
const outputFile = path.join(__dirname, 'public', 'index.min.js');

async function build() {
    try {
        console.log('Starting obfuscation of index.js...');
        const code = fs.readFileSync(inputFile, 'utf8');
        
        const result = await minify(code, {
            compress: {
                drop_console: false, // Keep console logs just in case for now, or true to strip them
                toplevel: true,
                passes: 2
            },
            mangle: {
                toplevel: true
            },
            format: {
                comments: false // Remove all comments
            }
        });

        if (result.error) {
            throw result.error;
        }

        fs.writeFileSync(outputFile, result.code);
        console.log(`Successfully obfuscated to index.min.js!`);
        console.log(`Original size: ${(code.length / 1024).toFixed(2)} KB`);
        console.log(`Minified size: ${(result.code.length / 1024).toFixed(2)} KB`);
    } catch (err) {
        console.error('Error during minification:', err);
    }
}

build();
