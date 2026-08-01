import { contextBridge, ipcRenderer } from 'electron'

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // === 文件 & 导入 ===
  openFileDialog: () => ipcRenderer.invoke('file:openDialog'),
  parseFile: (filePath: string) => ipcRenderer.invoke('file:parse', filePath),
  commitImport: (rows: any[]) => ipcRenderer.invoke('file:commitImport', rows),

  // === 外部文件打开 ===
  onOpenFile: (callback: (filePath: string) => void) => {
    ipcRenderer.on('open-file', (_event, filePath) => callback(filePath))
  },

  // === 账单 CRUD ===
  getBills: (filters: any) => ipcRenderer.invoke('db:getBills', filters),
  updateBill: (id: number, changes: any) => ipcRenderer.invoke('db:updateBill', id, changes),
  deleteBills: (ids: number[]) => ipcRenderer.invoke('db:deleteBills', ids),

  // === 分类 ===
  getCategories: () => ipcRenderer.invoke('db:getCategories'),
  getClassifyRules: () => ipcRenderer.invoke('db:getClassifyRules'),
  saveClassifyRule: (rule: any) => ipcRenderer.invoke('db:saveClassifyRule', rule),
  updateClassifyRule: (id: number, changes: any) => ipcRenderer.invoke('db:updateClassifyRule', id, changes),
  deleteClassifyRule: (id: number) => ipcRenderer.invoke('db:deleteClassifyRule', id),

  // === 统计 ===
  getMonthlySummary: (year: number, month: number) =>
    ipcRenderer.invoke('db:getMonthlySummary', year, month),
  getAnnualSummary: (year: number) =>
    ipcRenderer.invoke('db:getAnnualSummary', year),
  getCategoryTrend: (categoryId: number, year: number) =>
    ipcRenderer.invoke('db:getCategoryTrend', categoryId, year),

  // === 导入映射 ===
  getImportMappings: () => ipcRenderer.invoke('db:getImportMappings'),
  saveImportMapping: (mapping: any) => ipcRenderer.invoke('db:saveImportMapping', mapping)
})
