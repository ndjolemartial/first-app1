const fs = require('fs');
const log = (msg) => fs.appendFileSync('f:\\PROJETS\\CLAUDE_PROJETS\\Afrikimmo-app\\test-output.txt', msg + '\n');
log('process.versions.electron: ' + (process.versions && process.versions.electron));
log('process.type: ' + process.type);
log('electron type: ' + typeof require('electron'));
