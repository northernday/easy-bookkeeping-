import { create } from 'zustand'
import type { ImportRow, ParseResult } from '@/types/bill'

interface ImportStore {
  step: number
  filePath: string | null
  fileName: string | null
  detectedSource: string | null
  rows: ImportRow[]
  needsMapping: boolean
  rawHeaders: string[]
  isParsing: boolean
  parseError: string | null

  setFile: (path: string, name: string) => void
  setFileAndParse: (path: string) => Promise<void>
  parseFile: () => Promise<void>
  updateRow: (tempId: string, changes: Partial<ImportRow>) => void
  commitImport: () => Promise<{ inserted: number; skipped: number }>
  reset: () => void
}

export const useImportStore = create<ImportStore>((set, get) => ({
  step: 0,
  filePath: null,
  fileName: null,
  detectedSource: null,
  rows: [],
  needsMapping: false,
  rawHeaders: [],
  isParsing: false,
  parseError: null,

  setFile: (path, name) => {
    set({ filePath: path, fileName: name, step: 1 })
  },

  setFileAndParse: async (path: string) => {
    const name = path.split(/[/\\]/).pop() || 'unknown'
    set({ filePath: path, fileName: name, isParsing: true, parseError: null, step: 2 })
    try {
      const result: ParseResult = await window.electronAPI.parseFile(path)
      if (result.needsMapping) {
        set({
          needsMapping: true,
          rawHeaders: result.headers || [],
          step: 2,
          isParsing: false,
          detectedSource: result.detectedSource,
          rows: (result.rows || []) as ImportRow[]
        })
      } else {
        set({
          rows: result.rows || [],
          detectedSource: result.detectedSource,
          needsMapping: false,
          step: 3,
          isParsing: false
        })
      }
    } catch (err: any) {
      set({
        parseError: err.message || '文件解析失败',
        isParsing: false,
        step: 1
      })
    }
  },

  parseFile: async () => {
    const { filePath } = get()
    if (!filePath) return
    set({ isParsing: true, parseError: null, step: 2 })
    try {
      const result: ParseResult = await window.electronAPI.parseFile(filePath)
      if (result.needsMapping) {
        set({
          needsMapping: true,
          rawHeaders: result.headers || [],
          step: 2,
          isParsing: false,
          detectedSource: result.detectedSource,
          rows: (result.rows || []) as ImportRow[]
        })
      } else {
        set({
          rows: result.rows || [],
          detectedSource: result.detectedSource,
          needsMapping: false,
          step: 3,
          isParsing: false
        })
      }
    } catch (err: any) {
      set({
        parseError: err.message || '文件解析失败',
        isParsing: false,
        step: 1
      })
    }
  },

  updateRow: (tempId, changes) => {
    set(s => ({
      rows: s.rows.map(r => r.tempId === tempId ? { ...r, ...changes } : r)
    }))
  },

  commitImport: async () => {
    const { rows } = get()
    const result = await window.electronAPI.commitImport(rows)
    get().reset()
    return result
  },

  reset: () => set({
    step: 0, filePath: null, fileName: null, detectedSource: null,
    rows: [], needsMapping: false, rawHeaders: [],
    isParsing: false, parseError: null
  }),
}))
