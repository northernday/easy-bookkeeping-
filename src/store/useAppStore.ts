import { create } from 'zustand'

type DateMode = 'monthly' | 'range'

interface AppStore {
  sidebarCollapsed: boolean
  currentYear: number
  currentMonth: number
  dateMode: DateMode
  dateFrom: string | null
  dateTo: string | null
  refreshKey: number

  toggleSidebar: () => void
  setMonth: (year: number, month: number) => void
  setDateMode: (mode: DateMode) => void
  setDateRange: (from: string | null, to: string | null) => void
  triggerRefresh: () => void
}

export const useAppStore = create<AppStore>((set) => ({
  sidebarCollapsed: false,
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth() + 1,
  dateMode: 'monthly',
  dateFrom: null,
  dateTo: null,
  refreshKey: 0,

  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMonth: (year, month) => set({ currentYear: year, currentMonth: month }),
  setDateMode: (mode) => set({ dateMode: mode }),
  setDateRange: (from, to) => set({ dateFrom: from, dateTo: to }),
  triggerRefresh: () => set(s => ({ refreshKey: s.refreshKey + 1 })),
}))
