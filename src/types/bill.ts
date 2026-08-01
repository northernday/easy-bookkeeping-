// ===== 核心实体 =====

/** 交易记录 */
export interface Bill {
  id: number
  date: string
  amount: number
  is_expense: number
  category_id: number
  counterparty: string
  description: string
  payment_method: string
  source: string
  raw_data: string | null
  created_at: string
  updated_at: string
  // JOIN 字段
  category_name?: string
  category_color?: string
  category_icon?: string
}

/** 分类 */
export interface Category {
  id: number
  name: string
  icon: string
  color: string
  is_preset: number
  sort_order: number
}

/** 自动分类规则 */
export interface ClassifyRule {
  id: number
  category_id: number
  field: 'description' | 'counterparty' | 'both'
  keywords: string
  enabled: number
  category_name?: string
}

/** 导入预览行 */
export interface ImportRow {
  tempId: string
  date: string
  amount: number
  isExpense: boolean
  categoryId: number
  counterparty: string
  description: string
  paymentMethod: string
  source: string
  rawData: string | null
}

/** 导入映射 */
export interface ImportMapping {
  id: number
  name: string
  source: string
  field_map: string
  skip_rows: number
  encoding: string
}

/** 账单筛选条件 */
export interface BillFilter {
  dateFrom?: string; dateTo?: string; categoryId?: number
  keyword?: string; page?: number; pageSize?: number; ledgerId?: number
}

/** 账单分页结果 */
export interface BillPageResult {
  rows: Bill[]
  total: number
  page: number
  pageSize: number
}

// ===== 统计类型 =====

export interface CategoryAmount {
  categoryId: number
  categoryName: string
  color?: string
  amount: number
  percentage: number
  count: number
}

export interface MonthlySummary {
  year: number
  month: number
  totalExpense: number
  totalIncome: number
  categoryBreakdown: CategoryAmount[]
}

export interface AnnualSummary {
  year: number
  totalExpense: number
  totalIncome: number
  categoryBreakdown: CategoryAmount[]
  monthlyTrend: MonthlySummary[]
}

export interface CategoryTrend {
  categoryId: number
  categoryName: string
  dataPoints: { year: number; month: number; amount: number }[]
}

/** 自定义日期范围统计 */
export interface DateRangeSummary {
  dateFrom: string
  dateTo: string
  totalExpense: number
  totalIncome: number
  categoryBreakdown: CategoryAmount[]
}

// ===== IPC API 类型 =====

export interface Ledger { id: number; name: string; created_at: string; deleted_at?: string | null }

export interface ElectronAPI {
  // 文件
  openFileDialog(): Promise<{ filePath: string; fileName: string } | null>
  parseFile(filePath: string): Promise<ParseResult>
  commitImport(rows: any[]): Promise<{ inserted: number; skipped: number }>
  onOpenFile(callback: (filePath: string) => void): void

  // 账本
  getLedgers(): Promise<Ledger[]>; getActiveLedger(): Promise<Ledger>
  setActiveLedger(id: number): Promise<void>; createLedger(name: string): Promise<number>
  deleteLedger(id: number): Promise<boolean>; renameLedger(id: number, name: string): Promise<void>
  restoreLedger(id: number): Promise<boolean>; permanentlyDeleteLedger(id: number): Promise<boolean>
  getDeletedLedgers(): Promise<Ledger[]>
  clearLedgerBills(lid?: number): Promise<boolean>

  // 账单
  getBills(filters: BillFilter): Promise<BillPageResult>
  updateBill(id: number, changes: Partial<Bill>): Promise<void>
  deleteBills(ids: number[]): Promise<void>

  // 分类
  getCategories(lid?: number): Promise<Category[]>
  getClassifyRules(lid?: number): Promise<ClassifyRule[]>
  saveClassifyRule(rule: Omit<ClassifyRule, 'id'>): Promise<number>
  updateClassifyRule(id: number, changes: Partial<ClassifyRule>): Promise<void>
  deleteClassifyRule(id: number): Promise<void>
  seedDefaultRules(lid?: number): Promise<{ created: number; message: string }>

  // 统计
  getMonthlySummary(year: number, month: number, lid?: number): Promise<MonthlySummary>
  getDateRangeSummary(dateFrom: string, dateTo: string, lid?: number): Promise<DateRangeSummary>
  getAnnualSummary(year: number, lid?: number): Promise<AnnualSummary>
  getCategoryTrend(categoryId: number, year: number, lid?: number): Promise<CategoryTrend>

  // 映射
  getImportMappings(): Promise<ImportMapping[]>
  saveImportMapping(mapping: Omit<ImportMapping, 'id'>): Promise<number>
}

export interface ParseResult {
  detectedSource: string
  rows?: ImportRow[]
  headers?: string[]
  needsMapping: boolean
  totalParsed?: number
}

// 扩展 Window 类型
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
