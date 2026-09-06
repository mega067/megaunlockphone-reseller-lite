const fs = require('fs');

const allKeys = new Set();
const allCustomTypes = new Set();
const allRequiresCustomKeys = new Set();
let examples = {};

for (let i = 1; i <= 3; i++) {
  try {
    const data = JSON.parse(fs.readFileSync(`catalog_server_${i}.json`, 'utf8'));
    let list = {};
    if (data.SUCCESS && data.SUCCESS[0] && data.SUCCESS[0].LIST) {
      list = data.SUCCESS[0].LIST;
    } else {
      list = data;
    }
    
    for (const group in list) {
      const services = list[group].SERVICES || {};
      for (const id in services) {
        const s = services[id];
        
        // Track all top-level keys
        Object.keys(s).forEach(k => allKeys.add(k));

        if (s.CUSTOM) {
          allCustomTypes.add(JSON.stringify(Object.keys(s.CUSTOM)));
          if (!examples.custom) examples.custom = s.CUSTOM;
        }

        if (s['Requires.Custom']) {
          if (Array.isArray(s['Requires.Custom'])) {
            s['Requires.Custom'].forEach(f => {
              Object.keys(f).forEach(k => allRequiresCustomKeys.add(k));
            });
            if (!examples.requiresCustomArray) examples.requiresCustomArray = s['Requires.Custom'][0];
          } else {
            if (!examples.requiresCustomOther) examples.requiresCustomOther = s['Requires.Custom'];
          }
        }
        
        if (s.requires_custom) {
             if (!examples.requires_custom_snake) examples.requires_custom_snake = s.requires_custom;
        }
      }
    }
  } catch(e) {
    console.error('Error on server', i, e.message);
  }
}

console.log('=== ALL SERVICE KEYS ===\n', Array.from(allKeys).sort());
console.log('\n=== CUSTOM OBJECT KEYS STRUCTURES ===\n', Array.from(allCustomTypes));
console.log('\n=== Requires.Custom KEYS ===\n', Array.from(allRequiresCustomKeys));
console.log('\n=== EXAMPLES ===\n', JSON.stringify(examples, null, 2));

