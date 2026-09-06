const fs = require('fs');
['1', '2', '3'].forEach(num => {
  const data = JSON.parse(fs.readFileSync(`data/prices_${num}.json`));
  function search(obj, path) {
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => search(item, `${path}[${i}]`));
    } else if (obj && typeof obj === 'object') {
      for (const key of Object.keys(obj)) {
        if (obj[key] === '339' || obj[key] === 339) {
          console.log(`Found 339 in prices_${num} at ${path}.${key}`);
          console.log(JSON.stringify(obj, null, 2));
        } else {
          search(obj[key], `${path}.${key}`);
        }
      }
    }
  }
  search(data, 'root');
});
