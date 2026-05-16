const result = require('electron');
console.log('Type:', typeof result);
console.log('Keys:', Object.keys(result || {}).slice(0, 10));
console.log('Has app:', !!result && 'app' in result);
console.log('process.versions.electron:', process.versions && process.versions.electron);
