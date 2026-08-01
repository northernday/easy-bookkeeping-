import { create } from 'zustand'
import type { Bill, BillFilter, BillPageResult } from '@/types/bill'

interface BillStore {
  bills: Bill[]
  total: number
  page: number
  pageSize: number
  filters: BillFilter
  isLoading: boolean

  fetchBills: (filters?: BillFilter) => Promise<void>
  setFilters: (filters: Partial<BillFilter>) => void
  updateBillCategory: (id: number, categoryId: number) => Promise<void>
  deleteBills: (ids: number[]) => Promise<void>
}

export const useBillStore = create<BillStore>((set, get) => ({
  bills: [],
  total: 0,
  page: 1,
  pageSize: 50,
  filters: {},
  isLoading: false,

  fetchBills: async (filters?: BillFilter) => {
    const merged = { ...get().filters, ...filters, page: filters?.page || 1, pageSize: filters?.pageSize || 50 }
    set({ isLoading: true, filters: merged })
    try {
      const result: BillPageResult = await window.electronAPI.getBills(merged)
      set({ bills: result.rows, total: result.total, page: result.page, isLoading: false })
    } catch (err) {
      console.error('获取账单失败:', err)
      set({ isLoading: false })
    }
  },

  setFilters: (filters) => {
    set({ filters: { ...get().filters, ...filters } })
  },

  updateBillCategory: async (id, categoryId) => {
    await window.electronAPI.updateBill(id, { category_id: categoryId })
    set(s => ({
      bills: s.bills.map(b => b.id === id ? { ...b, category_id: categoryId } : b)
    }))
  },

  deleteBills: async (ids) => {
    await window.electronAPI.deleteBills(ids)
    set(s => ({
      bills: s.bills.filter(b => !ids.includes(b.id)),
      total: s.total - ids.length
    }))
  },
}))
