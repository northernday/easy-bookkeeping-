import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { getDatabase } from './database'

// 启用自定义格式解析
dayjs.extend(customParseFormat)

// ===== 字段映射表 =====
interface FieldMap {
  date: string[]
  amount: string[]
  counterparty: string[]
  description: string[]
  paymentMethod: string[]
}

const PLATFORM_FIELD_MAPS: Record<string, FieldMap> = {
  wechat: {
    date: ['交易时间'],
    amount: ['金额(元)', '金额'],
    counterparty: ['交易对方'],
    description: ['商品', '商品说明'],
    paymentMethod: ['收/支', '交易类型']
  },
  alipay: {
    date: ['交易时间'],
    amount: ['金额'],
    counterparty: ['交易对方'],
    description: ['商品说明', '商品'],
    paymentMethod: ['收/支', '交易分类']
  }
}

// ===== 平台检测 =====
function detectPlatform(headers: string[]): string | null {
  for (const [platform, map] of Object.entries(PLATFORM_FIELD_MAPS)) {
    const requiredFields = [map.date[0], map.amount[0], map.counterparty[0]]
    const matched = requiredFields.every(f => headers.includes(f))
    if (matched) return platform
  }
  return null
}

// ===== 字段匹配辅助 =====
function findHeader(headers: string[], candidates: string[]): string | null {
  for (const c of candidates) {
    if (headers.includes(c)) return c
  }
  return null
}

// ===== 日期解析 =====
function parseDate(value: any): string | null {
  if (!value) return null
  const str = String(value).trim()

  // 尝试多种格式
  const formats = [
    'YYYY-MM-DD', 'YYYY/MM/DD', 'YYYY.MM.DD',
    'YYYY-MM-DD HH:mm:ss', 'YYYY/MM/DD HH:mm:ss',
    'YYYY年M月D日', 'YYYY年MM月DD日',
    'YYYY年M月D日 HH:mm:ss', 'YYYY年MM月DD日 HH:mm:ss',
    'M/D/YYYY', 'MM/DD/YYYY', 'DD/MM/YYYY',
    'D/M/YYYY', 'M-D-YYYY', 'MM-DD-YYYY'
  ]

  for (const fmt of formats) {
    const d = dayjs(str, fmt, true)
    if (d.isValid()) return d.format('YYYY-MM-DD')
  }

  // 最后尝试自动解析
  const auto = dayjs(str)
  if (auto.isValid()) return auto.format('YYYY-MM-DD')

  return null
}

// ===== 金额解析 =====
function parseAmount(value: any): number {
  if (typeof value === 'number') return Math.abs(value)
  const str = String(value).replace(/[¥￥,，\s]/g, '').trim()
  const num = parseFloat(str)
  return isNaN(num) ? 0 : Math.abs(num)
}

// ===== 收支判断 =====
function parseExpenseFlag(value: any): boolean {
  if (!value) return true // 默认支出
  const str = String(value).trim()
  // 支出关键词
  if (/支出|消费|付款|扣款|转出/.test(str)) return true
  // 收入关键词
  if (/收入|收款|转入|退款|充值/.test(str)) return false
  return true // 默认支出
}

// ===== 自动分类 =====
function classifyBill(
  description: string,
  counterparty: string,
  rules: any[],
  defaultCategoryId: number
): number {
  const searchText = `${description} ${counterparty}`.toLowerCase()

  for (const rule of rules) {
    if (!rule.enabled) continue
    const keywords = JSON.parse(rule.keywords) as string[]
    const matched = keywords.some((kw: string) =>
      searchText.includes(kw.toLowerCase())
    )
    if (matched) return rule.category_id
  }

  return defaultCategoryId
}

// ===== IPC 注册 =====
export function registerFileHandlers(): void {
  // 打开文件对话框
  ipcMain.handle('file:openDialog', async () => {
    const window = BrowserWindow.getFocusedWindow()
    if (!window) return null

    const result = await dialog.showOpenDialog(window, {
      title: '选择账单文件',
      filters: [
        { name: '账单文件', extensions: ['xlsx', 'xls', 'csv'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) return null

    return {
      filePath: result.filePaths[0],
      fileName: path.basename(result.filePaths[0])
    }
  })

  // 解析文件（不写库）
  ipcMain.handle('file:parse', async (_event, filePath: string) => {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`)
    }

    const ext = path.extname(filePath).toLowerCase()

    // 读取文件
    let rawData: any[][]
    if (ext === '.csv') {
      rawData = parseCSV(filePath)
    } else {
      rawData = parseExcel(filePath)
    }

    if (rawData.length < 1) {
      throw new Error('文件为空或无法解析')
    }

    // 第一行作为表头
    const headers = rawData[0].map(h => String(h).trim())
    const dataRows = rawData.slice(1).filter(row =>
      row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '')
    )

    // 检测平台
    const platform = detectPlatform(headers)
    const fieldMap = platform ? PLATFORM_FIELD_MAPS[platform] : null

    if (!fieldMap) {
      // 未知格式，返回原始列名让用户手动映射
      return {
        detectedSource: 'unknown',
        headers,
        rows: dataRows.map(row => {
          const obj: any = {}
          headers.forEach((h, i) => { obj[h] = row[i] || '' })
          return obj
        }),
        needsMapping: true
      }
    }

    // 找到各列的 index
    const dateCol = headers.indexOf(findHeader(headers, fieldMap.date)!)
    const amountCol = headers.indexOf(findHeader(headers, fieldMap.amount)!)
    const counterpartyCol = headers.indexOf(findHeader(headers, fieldMap.counterparty)!)
    const descCol = headers.indexOf(
      findHeader(headers, fieldMap.description) || headers[headers.length - 1]
    )
    const payMethodCol = findHeader(headers, fieldMap.paymentMethod)
      ? headers.indexOf(findHeader(headers, fieldMap.paymentMethod)!)
      : -1

    // 加载分类规则
    const db = getDatabase()
    const rules = db.prepare('SELECT * FROM classify_rules WHERE enabled = 1 ORDER BY id').all()
    const defaultCatRow = db.prepare(
      "SELECT id FROM categories WHERE name = '其它'"
    ).get() as { id: number }
    const defaultCategoryId = defaultCatRow?.id || 6

    // 解析每行
    const rows: any[] = []
    for (const row of dataRows) {
      const dateStr = dateCol >= 0 ? String(row[dateCol] || '') : ''
      const date = parseDate(dateStr)
      if (!date) continue // 跳過無效日期行

      const amount = parseAmount(amountCol >= 0 ? row[amountCol] : 0)
      if (amount === 0) continue // 跳過零金額行

      const counterparty = counterpartyCol >= 0 ? String(row[counterpartyCol] || '').trim() : ''
      const description = descCol >= 0 ? String(row[descCol] || '').trim() : ''
      const payMethodStr = payMethodCol >= 0 ? String(row[payMethodCol] || '').trim() : ''
      const isExpense = parseExpenseFlag(payMethodStr)

      const categoryId = classifyBill(description, counterparty, rules, defaultCategoryId)

      rows.push({
        tempId: `import_${Date.now()}_${rows.length}`,
        date,
        amount,
        isExpense,
        categoryId,
        counterparty,
        description,
        paymentMethod: isExpense ? '支出' : '收入',
        source: platform,
        rawData: JSON.stringify(row)
      })
    }

    return {
      detectedSource: platform,
      rows,
      needsMapping: false,
      totalParsed: rows.length
    }
  })

  // 确认导入（写库）
  ipcMain.handle('file:commitImport', async (_event, rows: any[]) => {
    const db = getDatabase()
    let inserted = 0
    let skipped = 0

    const insertStmt = db.prepare(`
      INSERT INTO bills (date, amount, is_expense, category_id, counterparty, description, payment_method, source, raw_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const transaction = db.transaction(() => {
      for (const row of rows) {
        try {
          insertStmt.run(
            row.date,
            row.amount,
            row.isExpense ? 1 : 0,
            row.categoryId || row.category_id || 6,
            row.counterparty || '',
            row.description || '',
            row.paymentMethod || row.payment_method || '',
            row.source || 'manual',
            row.rawData || row.raw_data || null
          )
          inserted++
        } catch (err: any) {
          // 唯一约束冲突 = 去重跳过
          if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            skipped++
          } else {
            throw err
          }
        }
      }
    })

    transaction()
    return { inserted, skipped }
  })
}

// ===== Excel 解析 =====
function parseExcel(filePath: string): any[][] {
  const workbook = XLSX.readFile(filePath, { cellDates: true })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }) as any[][]
}

// ===== CSV 解析 =====
function parseCSV(filePath: string): any[][] {
  // 尝试检测编码
  const buffer = fs.readFileSync(filePath)
  const content = decodeCSVBuffer(buffer)

  const rows = content.split(/\r?\n/).filter(line => line.trim())
  return rows.map(row => parseCSVLine(row))
}

function decodeCSVBuffer(buffer: Buffer): string {
  // 尝试 UTF-8
  try {
    const str = buffer.toString('utf-8')
    // 简单检测：如果包含常见中文则认为是正确编码
    if (/[一-鿿]/.test(str.slice(0, 500))) return str
  } catch { /* fall through */ }

  // 尝试 GBK (微信账单常见)
  try {
    const iconv = require('iconv-lite')
    return iconv.decode(buffer, 'gbk')
  } catch { /* fall through */ }

  // fallback
  return buffer.toString('utf-8')
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current.trim())
  return result
}
