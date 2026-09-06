const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec('mkdir -p ~/www/tmp && touch ~/www/tmp/restart.txt', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: 'ssh-megaunlockphone-panel.alwaysdata.net',
  port: 22,
  username: 'megaunlockphone-panel',
  password: 'angel067L'
});
