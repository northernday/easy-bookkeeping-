import { create } from 'zustand'
import type { Category, ClassifyRule } from '@/types/bill'

interface CategoryStore {
  categories: Category[]
  rules: ClassifyRule[]
  isLoading: boolean

  fetchCategories: () => Promise<void>
  fetchRules: () => Promise<void>
  addRule: (rule: Omit<ClassifyRule, 'id'>) => Promise<number>
  updateRule: (id: number, changes: Partial<ClassifyRule>) => Promise<void>
  deleteRule: (id: number) => Promise<void>
}

export const useCategoryStore = create<CategoryStore>((set, get) => ({
  categories: [],
  rules: [],
  isLoading: false,

  fetchCategories: async (lid) => {
    set({ isLoading: true })
    try {
      const categories = await window.electronAPI.getCategories(lid)
      set({ categories, isLoading: false })
    } catch { set({ isLoading: false }) }
  },
  fetchRules: async (lid) => {
    try {
      const rules = await window.electronAPI.getClassifyRules(lid)
      set({ rules })
    } catch {}
  },

  addRule: async (rule) => {
    const id = await window.electronAPI.saveClassifyRule(rule)
    await get().fetchRules()
    return id
  },

  updateRule: async (id, changes) => {
    await window.electronAPI.updateClassifyRule(id, changes)
    await get().fetchRules()
  },

  deleteRule: async (id) => {
    await window.electronAPI.deleteClassifyRule(id)
    await get().fetchRules()
  },
}))
