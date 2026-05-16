try {
  const r1 = require('electron');
  console.log('electron type:', typeof r1);
  const r2 = require('electron/main');
  console.log('electron/main type:', typeof r2);
  console.log('electron/main keys:', Object.keys(r2 || {}).join(', ').slice(0, 100));
} catch(e) {
  console.error('Error:', e.message);
}
process.exit(0);
