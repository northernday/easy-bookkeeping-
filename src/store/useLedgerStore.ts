import { create } from 'zustand'
import type { Ledger } from '@/types/bill'

interface LedgerStore {
  ledgers: Ledger[]; activeLedger: Ledger | null; isLoading: boolean
  deletedLedgers: Ledger[]
  fetchLedgers: () => Promise<void>
  fetchDeletedLedgers: () => Promise<void>
  setActiveLedger: (id: number) => Promise<void>
  createLedger: (name: string) => Promise<number>
  deleteLedger: (id: number) => Promise<void>
  restoreLedger: (id: number) => Promise<void>
  permanentlyDeleteLedger: (id: number) => Promise<void>
  renameLedger: (id: number, name: string) => Promise<void>
  clearBills: (lid?: number) => Promise<void>
}

export const useLedgerStore = create<LedgerStore>((set, get) => ({
  ledgers: [], activeLedger: null, isLoading: false, deletedLedgers: [],
  fetchLedgers: async () => {
    set({ isLoading: true })
    try {
      const [ledgers, active] = await Promise.all([window.electronAPI.getLedgers(), window.electronAPI.getActiveLedger()])
      set({ ledgers, activeLedger: active, isLoading: false })
    } catch { set({ isLoading: false }) }
  },
  fetchDeletedLedgers: async () => {
    try {
      const deletedLedgers = await window.electronAPI.getDeletedLedgers()
      set({ deletedLedgers })
    } catch { /* ignore */ }
  },
  setActiveLedger: async (id) => {
    await window.electronAPI.setActiveLedger(id)
    const active = get().ledgers.find(l => l.id === id) || null
    set({ activeLedger: active })
  },
  createLedger: async (name) => {
    const id = await window.electronAPI.createLedger(name)
    await get().fetchLedgers()
    return id
  },
  deleteLedger: async (id) => {
    await window.electronAPI.deleteLedger(id)
    const cur = get().activeLedger
    // 如果删除的是当前活跃账本，切到账本1
    if (cur?.id === id) {
      await get().setActiveLedger(1)
    }
    await get().fetchLedgers()
    await get().fetchDeletedLedgers()
  },
  restoreLedger: async (id) => {
    await window.electronAPI.restoreLedger(id)
    await get().fetchLedgers()
    await get().fetchDeletedLedgers()
  },
  permanentlyDeleteLedger: async (id) => {
    await window.electronAPI.permanentlyDeleteLedger(id)
    await get().fetchDeletedLedgers()
  },
  renameLedger: async (id, name) => {
    await window.electronAPI.renameLedger(id, name)
    await get().fetchLedgers()
  },
  clearBills: async (lid) => {
    await window.electronAPI.clearLedgerBills(lid || get().activeLedger?.id || 1)
  },
}))
