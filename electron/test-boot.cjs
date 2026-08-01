const fs = require('fs');
const path = require('path');
function log(msg) {
  try { fs.appendFileSync(path.join(__dirname, '..', 'data', 'test.log'), `[${new Date().toISOString()}] ${msg}\n`); } catch {}
}
log('=== 轻松记账 最小测试 ===');
log('Node: ' + process.version);
log('electron version: ' + (process.versions.electron || 'N/A'));
try {
  const electron = require('electron');
  log('require("electron") typeof: ' + typeof electron);
  if (typeof electron === 'object') log('keys: ' + Object.keys(electron).join(', '));
  else log('FAIL: ' + electron);
} catch (e) { log('ERROR: ' + e.message); }
try {
  const em = require('electron/main');
  log('require("electron/main") typeof: ' + typeof em);
  if (typeof em === 'object') log('electron/main keys: ' + Object.keys(em).join(', '));
} catch (e) { log('electron/main ERROR: ' + e.message); }
