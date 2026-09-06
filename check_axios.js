const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('ls -l ~/www/node_modules/axios', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', d => console.log('STDOUT:', d.toString())).stderr.on('data', d => console.log('STDERR:', d.toString()));
  });
}).connect({
  host: 'ssh-megaunlockphone-panel.alwaysdata.net',
  port: 22,
  username: 'megaunlockphone-panel',
  password: 'angel067L'
});
