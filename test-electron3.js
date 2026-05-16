const fs = require('fs');
const log = (msg) => fs.appendFileSync('f:\\PROJETS\\CLAUDE_PROJETS\\Afrikimmo-app\\test-output.txt', msg + '\n');
try {
  const r1 = require('electron');
  log('electron type: ' + typeof r1);
  log('electron value: ' + String(r1).slice(0, 50));
} catch(e) {
  log('electron error: ' + e.message);
}
try {
  const r2 = require('electron/main');
  log('electron/main type: ' + typeof r2);
  if (r2 && typeof r2 === 'object') log('electron/main keys: ' + Object.keys(r2).slice(0, 15).join(', '));
} catch(e) {
  log('electron/main error: ' + e.message);
}
log('versions: ' + JSON.stringify(process.versions).slice(0, 100));
setTimeout(() => {}, 0);
