import Database from 'better-sqlite3'
import { app, ipcMain } from 'electron'
import { join } from 'path'

// ===== 数据库初始化 =====
let db: Database.Database

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = join(app.getPath('userData'), 'money-keeper.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema()
    seedCategories()
    db.pragma('journal_mode')
  }
  return db
}

function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      icon       TEXT NOT NULL DEFAULT 'wallet',
      color      TEXT NOT NULL,
      is_preset  INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bills (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      date           TEXT NOT NULL,
      amount         REAL NOT NULL,
      is_expense     INTEGER NOT NULL DEFAULT 1,
      category_id    INTEGER NOT NULL DEFAULT 6,
      counterparty   TEXT DEFAULT '',
      description    TEXT DEFAULT '',
      payment_method TEXT DEFAULT '',
      source         TEXT DEFAULT 'manual',
      raw_data       TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS classify_rules (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      field       TEXT NOT NULL DEFAULT 'both',
      keywords    TEXT NOT NULL,
      enabled     INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS import_mappings (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT NOT NULL,
      source    TEXT NOT NULL,
      field_map TEXT NOT NULL,
      skip_rows INTEGER DEFAULT 0,
      encoding  TEXT DEFAULT 'utf-8'
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    -- 索引（IF NOT EXISTS 不适用于索引，用尝试创建忽略错误）
    CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(date);
    CREATE INDEX IF NOT EXISTS idx_bills_category_date ON bills(category_id, date);
    CREATE INDEX IF NOT EXISTS idx_bills_source ON bills(source);
    CREATE INDEX IF NOT EXISTS idx_bills_is_expense ON bills(is_expense);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_dedup ON bills(date, amount, counterparty);
  `)
}

function seedCategories(): void {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM categories').get() as { cnt: number }
  if (count.cnt > 0) return

  const insert = db.prepare(
    'INSERT INTO categories (name, icon, color, is_preset, sort_order) VALUES (?, ?, ?, 1, ?)'
  )
  const categories = [
    ['游戏', 'FaGamepad', '#2a78d6', 1],
    ['医疗', 'FaStethoscope', '#eb6834', 2],
    ['教育', 'FaBook', '#1baf7a', 3],
    ['旅行', 'FaCompass', '#eda100', 4],
    ['日用', 'FaShoppingCart', '#e87ba4', 5],
    ['其它', 'FaEllipsisH', '#008300', 6]
  ]
  for (const c of categories) {
    insert.run(...c)
  }
}

// ===== IPC 注册 =====
export function registerDatabaseHandlers(): void {
  getDatabase() // 确保首次引用时初始化

  // === 账单 ===
  ipcMain.handle('db:getBills', (_event, filters) => {
    const { dateFrom, dateTo, categoryId, keyword, page = 1, pageSize = 50 } = filters || {}
    let sql = `
      SELECT b.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM bills b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE 1=1
    `
    const params: any[] = []

    if (dateFrom) { sql += ' AND b.date >= ?'; params.push(dateFrom) }
    if (dateTo) { sql += ' AND b.date <= ?'; params.push(dateTo) }
    if (categoryId) { sql += ' AND b.category_id = ?'; params.push(categoryId) }
    if (keyword) {
      sql += ' AND (b.description LIKE ? OR b.counterparty LIKE ?)'
      params.push(`%${keyword}%`, `%${keyword}%`)
    }

    // 总数
    const countSql = sql.replace(/SELECT .* FROM/, 'SELECT COUNT(*) as total FROM')
    const { total } = db.prepare(countSql).get(...params) as { total: number }

    // 分页
    sql += ' ORDER BY b.date DESC, b.id DESC LIMIT ? OFFSET ?'
    params.push(pageSize, (page - 1) * pageSize)

    const rows = db.prepare(sql).all(...params)
    return { rows, total, page, pageSize }
  })

  ipcMain.handle('db:updateBill', (_event, id: number, changes: any) => {
    changes.updated_at = new Date().toISOString()
    const fields = Object.keys(changes).map(k => `${k} = ?`).join(', ')
    const values = Object.values(changes)
    db.prepare(`UPDATE bills SET ${fields} WHERE id = ?`).run(...values, id)
  })

  ipcMain.handle('db:deleteBills', (_event, ids: number[]) => {
    const placeholders = ids.map(() => '?').join(',')
    db.prepare(`DELETE FROM bills WHERE id IN (${placeholders})`).run(...ids)
  })

  // === 分类 ===
  ipcMain.handle('db:getCategories', () => {
    return db.prepare('SELECT * FROM categories ORDER BY sort_order').all()
  })

  // === 分类规则 ===
  ipcMain.handle('db:getClassifyRules', () => {
    return db.prepare(`
      SELECT r.*, c.name as category_name
      FROM classify_rules r
      JOIN categories c ON r.category_id = c.id
      ORDER BY r.id
    `).all()
  })

  ipcMain.handle('db:saveClassifyRule', (_event, rule) => {
    const { category_id, field, keywords, enabled } = rule
    const result = db.prepare(
      'INSERT INTO classify_rules (category_id, field, keywords, enabled) VALUES (?, ?, ?, ?)'
    ).run(category_id, field, JSON.stringify(keywords), enabled ? 1 : 0)
    return result.lastInsertRowid
  })

  ipcMain.handle('db:updateClassifyRule', (_event, id, changes) => {
    if (changes.keywords) changes.keywords = JSON.stringify(changes.keywords)
    if (changes.enabled !== undefined) changes.enabled = changes.enabled ? 1 : 0
    const fields = Object.keys(changes).map(k => `${k} = ?`).join(', ')
    const values = Object.values(changes)
    db.prepare(`UPDATE classify_rules SET ${fields} WHERE id = ?`).run(...values, id)
  })

  ipcMain.handle('db:deleteClassifyRule', (_event, id) => {
    db.prepare('DELETE FROM classify_rules WHERE id = ?').run(id)
  })

  // === 统计 ===
  ipcMain.handle('db:getMonthlySummary', (_event, year: number, month: number) => {
    const ym = `${year}-${String(month).padStart(2, '0')}`
    const expenseRows = db.prepare(`
      SELECT b.category_id, c.name as category_name, c.color as category_color,
             SUM(b.amount) as amount, COUNT(*) as count
      FROM bills b
      JOIN categories c ON b.category_id = c.id
      WHERE b.is_expense = 1 AND strftime('%Y-%m', b.date) = ?
      GROUP BY b.category_id
      ORDER BY amount DESC
    `).all(ym) as any[]

    const incomeRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM bills WHERE is_expense = 0 AND strftime('%Y-%m', date) = ?
    `).get(ym) as { total: number }

    const totalExpense = expenseRows.reduce((sum, r) => sum + r.amount, 0)
    const totalIncome = incomeRow.total

    const categoryBreakdown = expenseRows.map(r => ({
      categoryId: r.category_id,
      categoryName: r.category_name,
      color: r.category_color,
      amount: r.amount,
      percentage: totalExpense > 0 ? (r.amount / totalExpense) * 100 : 0,
      count: r.count
    }))

    return { year, month, totalExpense, totalIncome, categoryBreakdown }
  })

  ipcMain.handle('db:getAnnualSummary', (_event, year: number) => {
    const expenseRows = db.prepare(`
      SELECT b.category_id, c.name as category_name, c.color as category_color,
             SUM(b.amount) as amount, COUNT(*) as count
      FROM bills b
      JOIN categories c ON b.category_id = c.id
      WHERE b.is_expense = 1 AND strftime('%Y', b.date) = ?
      GROUP BY b.category_id
      ORDER BY amount DESC
    `).all(String(year)) as any[]

    const incomeRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM bills WHERE is_expense = 0 AND strftime('%Y', date) = ?
    `).get(String(year)) as { total: number }

    const totalExpense = expenseRows.reduce((sum, r) => sum + r.amount, 0)
    const categoryBreakdown = expenseRows.map(r => ({
      categoryId: r.category_id,
      categoryName: r.category_name,
      color: r.category_color,
      amount: r.amount,
      percentage: totalExpense > 0 ? (r.amount / totalExpense) * 100 : 0,
      count: r.count
    }))

    // 逐月趋势
    const monthlyTrend: any[] = []
    for (let m = 1; m <= 12; m++) {
      const ym = `${year}-${String(m).padStart(2, '0')}`
      const row = db.prepare(`
        SELECT COALESCE(SUM(CASE WHEN is_expense = 1 THEN amount ELSE 0 END), 0) as totalExpense,
               COALESCE(SUM(CASE WHEN is_expense = 0 THEN amount ELSE 0 END), 0) as totalIncome,
               COUNT(*) as count
        FROM bills WHERE strftime('%Y-%m', date) = ?
      `).get(ym) as any
      if (row.count > 0) {
        monthlyTrend.push({
          year, month: m,
          totalExpense: row.totalExpense, totalIncome: row.totalIncome,
          categoryBreakdown: []
        })
      }
    }

    return { year, totalExpense, totalIncome: incomeRow.total, categoryBreakdown, monthlyTrend }
  })

  ipcMain.handle('db:getCategoryTrend', (_event, categoryId: number, year: number) => {
    const cat = db.prepare('SELECT name FROM categories WHERE id = ?').get(categoryId) as any
    const rows = db.prepare(`
      SELECT strftime('%m', date) as month, SUM(amount) as amount
      FROM bills
      WHERE category_id = ? AND is_expense = 1 AND strftime('%Y', date) = ?
      GROUP BY strftime('%m', date)
      ORDER BY month
    `).all(categoryId, String(year)) as any[]

    return {
      categoryId,
      categoryName: cat?.name || '',
      dataPoints: rows.map(r => ({
        year,
        month: parseInt(r.month),
        amount: r.amount
      }))
    }
  })

  // === 导入映射 ===
  ipcMain.handle('db:getImportMappings', () => {
    return db.prepare('SELECT * FROM import_mappings').all()
  })

  ipcMain.handle('db:saveImportMapping', (_event, mapping) => {
    const { name, source, field_map, skip_rows, encoding } = mapping
    const result = db.prepare(
      'INSERT INTO import_mappings (name, source, field_map, skip_rows, encoding) VALUES (?, ?, ?, ?, ?)'
    ).run(name, source, JSON.stringify(field_map), skip_rows || 0, encoding || 'utf-8')
    return result.lastInsertRowid
  })
}
