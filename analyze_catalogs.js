const fs = require('fs');

function analyze(serverNum) {
  const data = JSON.parse(fs.readFileSync(`catalog_server_${serverNum}.json`, 'utf8'));
  let list = {};
  if (data.SUCCESS && data.SUCCESS[0] && data.SUCCESS[0].LIST) {
    list = data.SUCCESS[0].LIST;
  } else {
    list = data;
  }

  const groups = new Set();
  const serviceKeywords = new Set();
  
  for (const groupName in list) {
    groups.add(groupName);
    const services = list[groupName].SERVICES || {};
    for (const serviceId in services) {
      const sName = services[serviceId].SERVICENAME || '';
      sName.split(/\s+/).forEach(word => {
        if (word.length > 3) serviceKeywords.add(word.toLowerCase());
      });
    }
  }

  console.log(`\n=== SERVER ${serverNum} GROUPS ===`);
  console.log(Array.from(groups).sort().join('\n'));
}

analyze(1);
analyze(2);
analyze(3);
