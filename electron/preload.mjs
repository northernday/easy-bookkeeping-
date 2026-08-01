import * as electron from 'electron/main';
const { contextBridge, ipcRenderer } = electron;

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('file:openDialog'),
  parseFile: (fp) => ipcRenderer.invoke('file:parse', fp),
  commitImport: (rows) => ipcRenderer.invoke('file:commitImport', rows),
  onOpenFile: (cb) => { ipcRenderer.on('open-file', (_e, fp) => cb(fp)); },

  getLedgers: () => ipcRenderer.invoke('db:getLedgers'),
  getActiveLedger: () => ipcRenderer.invoke('db:getActiveLedger'),
  setActiveLedger: (id) => ipcRenderer.invoke('db:setActiveLedger', id),
  createLedger: (name) => ipcRenderer.invoke('db:createLedger', name),
  deleteLedger: (id) => ipcRenderer.invoke('db:deleteLedger', id),
  restoreLedger: (id) => ipcRenderer.invoke('db:restoreLedger', id),
  permanentlyDeleteLedger: (id) => ipcRenderer.invoke('db:permanentlyDeleteLedger', id),
  getDeletedLedgers: () => ipcRenderer.invoke('db:getDeletedLedgers'),
  renameLedger: (id, name) => ipcRenderer.invoke('db:renameLedger', id, name),
  clearLedgerBills: (lid) => ipcRenderer.invoke('db:clearLedgerBills', lid),

  getBills: (f) => ipcRenderer.invoke('db:getBills', f),
  updateBill: (id, ch) => ipcRenderer.invoke('db:updateBill', id, ch),
  deleteBills: (ids) => ipcRenderer.invoke('db:deleteBills', ids),

  getCategories: (lid) => ipcRenderer.invoke('db:getCategories', lid),
  getClassifyRules: (lid) => ipcRenderer.invoke('db:getClassifyRules', lid),
  saveClassifyRule: (r) => ipcRenderer.invoke('db:saveClassifyRule', r),
  updateClassifyRule: (id, ch) => ipcRenderer.invoke('db:updateClassifyRule', id, ch),
  deleteClassifyRule: (id) => ipcRenderer.invoke('db:deleteClassifyRule', id),
  seedDefaultRules: (lid) => ipcRenderer.invoke('db:seedDefaultRules', lid),

  getMonthlySummary: (y, m, lid) => ipcRenderer.invoke('db:getMonthlySummary', y, m, lid),
  getDateRangeSummary: (from, to, lid) => ipcRenderer.invoke('db:getDateRangeSummary', from, to, lid),
  getAnnualSummary: (y, lid) => ipcRenderer.invoke('db:getAnnualSummary', y, lid),
  getCategoryTrend: (cid, y, lid) => ipcRenderer.invoke('db:getCategoryTrend', cid, y, lid),

  getImportMappings: () => ipcRenderer.invoke('db:getImportMappings'),
  saveImportMapping: (m) => ipcRenderer.invoke('db:saveImportMapping', m),
});
