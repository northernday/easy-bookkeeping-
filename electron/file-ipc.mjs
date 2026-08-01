// ESM file handlers
import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import * as electron from 'electron/main';
import { getDB_data, saveDB, ledgerId } from './database.mjs';
const { ipcMain, dialog, BrowserWindow } = electron;

dayjs.extend(customParseFormat);

const PLATFORM_FIELD_MAPS = {
  wechat: { date: ['交易时间'], amount: ['金额(元)', '金额'], counterparty: ['交易对方'], description: ['商品', '商品说明'], paymentMethod: ['收/支', '交易类型'] },
  alipay: { date: ['交易时间'], amount: ['金额'], counterparty: ['交易对方'], description: ['商品说明', '商品'], paymentMethod: ['收/支', '交易分类'] },
};

// 所有已知的数据表头关键词（用于在元数据行中识别真正的表头行）
const HEADER_KEYWORDS = ['交易时间', '交易类型', '交易对方', '金额', '收/支', '商品'];

/**
 * 在原始数据数组中查找真实的数据表头行。
 * 微信/支付宝导出的账单前 N 行通常是元数据（昵称、统计、注释），
 * 真正的表头行包含"交易时间"等关键列名。
 * 返回 { headerIndex, dataStartIndex }，找不到返回 null。
 */
function findTableBoundary(rawData) {
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || !Array.isArray(row)) continue;
    const rowStrs = row.map(c => String(c || '').trim());
    // 如果一行包含 >= 4 个表头关键词，认定这就是表头行
    const matchCount = HEADER_KEYWORDS.filter(kw => rowStrs.some(c => c.includes(kw))).length;
    if (matchCount >= 4) {
      return { headerIndex: i, dataStartIndex: i + 1 };
    }
  }
  return null;
}

function detectPlatform(headers) {
  for (const [platform, map] of Object.entries(PLATFORM_FIELD_MAPS)) {
    if ([map.date[0], map.amount[0], map.counterparty[0]].every(f => headers.includes(f))) return platform;
  }
  return null;
}

function findHeader(headers, candidates) {
  for (const c of candidates) { if (headers.includes(c)) return c; }
  return null;
}

/**
 * 解析日期 — 支持三种格式:
 * 1. Excel 日期序列号 (如 46226.831 → 2026-07-23)
 * 2. JavaScript Date 对象
 * 3. 字符串 (20+ 种格式)
 */
function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;

  // 1. Date 对象 (xlsx cellDates: true 时产生)
  if (value instanceof Date && !isNaN(value.getTime())) {
    return dayjs(value).format('YYYY-MM-DD');
  }

  // 2. Excel 日期序列号 (数字)
  if (typeof value === 'number') {
    // Excel 序列号的 epoch 是 1899-12-30
    // 转换: (serial - 25569) * 86400 * 1000 = js timestamp
    const jsDate = new Date((value - 25569) * 86400 * 1000);
    if (!isNaN(jsDate.getTime())) {
      return dayjs(jsDate).format('YYYY-MM-DD');
    }
  }

  // 3. 字符串
  const str = String(value).trim();
  const formats = ['YYYY-MM-DD', 'YYYY/MM/DD', 'YYYY.MM.DD', 'YYYY-MM-DD HH:mm:ss', 'YYYY/MM/DD HH:mm:ss',
    'YYYY年M月D日', 'YYYY年MM月DD日', 'YYYY年M月D日 HH:mm:ss', 'YYYY年MM月DD日 HH:mm:ss',
    'M/D/YYYY', 'MM/DD/YYYY', 'DD/MM/YYYY', 'M-D-YYYY', 'MM-DD-YYYY'];
  for (const fmt of formats) {
    const d = dayjs(str, fmt, true);
    if (d.isValid()) return d.format('YYYY-MM-DD');
  }
  const auto = dayjs(str);
  return auto.isValid() ? auto.format('YYYY-MM-DD') : null;
}

function parseAmount(value) {
  if (typeof value === 'number') return Math.abs(value);
  const num = parseFloat(String(value).replace(/[¥￥,，\s]/g, '').trim());
  return isNaN(num) ? 0 : Math.abs(num);
}

function parseExpenseFlag(value) {
  if (!value) return true;
  const str = String(value).trim();
  if (/支出|消费|付款|扣款|转出/.test(str)) return true;
  if (/收入|收款|转入|退款/.test(str)) return false;
  return true;
}

function classifyBill(description, counterparty, rules, defaultCategoryId) {
  const searchText = `${description} ${counterparty}`.toLowerCase();
  for (const rule of rules) {
    if (!rule.enabled) continue;
    let keywords = rule.keywords;
    if (typeof keywords === 'string') {
      try { keywords = JSON.parse(keywords); } catch { keywords = [keywords]; }
    }
    if (keywords.some(kw => searchText.includes(String(kw).toLowerCase()))) return rule.category_id;
  }
  return defaultCategoryId;
}

function parseCSVLine(line) {
  const result = [];
  let current = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) { if (ch === '"') { if (line[i+1] === '"') { current += '"'; i++; } else inQuotes = false; } else current += ch; }
    else { if (ch === '"') inQuotes = true; else if (ch === ',') { result.push(current.trim()); current = ''; } else current += ch; }
  }
  result.push(current.trim());
  return result;
}

function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '', raw: false });
}

function parseCSV(filePath) {
  const buffer = fs.readFileSync(filePath);
  let content = buffer.toString('utf-8');
  // 如果 UTF-8 内容不含中文，尝试 GBK
  if (!/[一-鿿]/.test(content.slice(0, Math.min(500, content.length)))) {
    try { content = new TextDecoder('gbk').decode(buffer); } catch { /* keep utf-8 */ }
  }
  return content.split(/\r?\n/).filter(l => l.trim()).map(parseCSVLine);
}

export function registerFileHandlers() {
  ipcMain.handle('file:openDialog', async () => {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) return null;
    const result = await dialog.showOpenDialog(window, {
      title: '选择账单文件', filters: [{ name: '账单文件', extensions: ['xlsx', 'xls', 'csv'] }], properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return { filePath: result.filePaths[0], fileName: path.basename(result.filePaths[0]) };
  });

  ipcMain.handle('file:parse', async (_event, filePath) => {
    if (!fs.existsSync(filePath)) throw new Error(`文件不存在: ${filePath}`);
    const ext = path.extname(filePath).toLowerCase();
    const rawData = ext === '.csv' ? parseCSV(filePath) : parseExcel(filePath);
    if (rawData.length < 1) throw new Error('文件为空');

    // 智能查找真正的数据表头行（跳过微信/支付宝的元数据头）
    const boundary = findTableBoundary(rawData);
    let headers, dataRows;
    if (boundary) {
      headers = rawData[boundary.headerIndex].map(h => String(h).trim());
      dataRows = rawData.slice(boundary.dataStartIndex)
        .filter(r => r.some(c => c !== undefined && c !== null && String(c).trim() !== ''));
    } else {
      // 回退：首行即表头
      headers = rawData[0].map(h => String(h).trim());
      dataRows = rawData.slice(1)
        .filter(r => r.some(c => c !== undefined && c !== null && String(c).trim() !== ''));
    }

    const platform = detectPlatform(headers);
    const fieldMap = platform ? PLATFORM_FIELD_MAPS[platform] : null;
    if (!fieldMap) {
      const rows = dataRows.map(r => { const o = {}; headers.forEach((h, i) => o[h] = r[i] || ''); return o; });
      return { detectedSource: 'unknown', headers, rows, needsMapping: true };
    }
    const dateCol = headers.indexOf(findHeader(headers, fieldMap.date));
    const amountCol = headers.indexOf(findHeader(headers, fieldMap.amount));
    const counterpartyCol = headers.indexOf(findHeader(headers, fieldMap.counterparty));
    const descCol = headers.indexOf(findHeader(headers, fieldMap.description) || headers[headers.length - 1]);
    const payMethodCol = findHeader(headers, fieldMap.paymentMethod) ? headers.indexOf(findHeader(headers, fieldMap.paymentMethod)) : -1;

    const data = getDB_data();
    const lid = ledgerId({});
    const rules = data.classify_rules.filter(r => r.enabled !== 0 && r.ledger_id === lid);
    const otherCat = data.categories.find(c => c.name === '其它' && c.ledger_id === lid);
    const defaultCategoryId = otherCat?.id || 6;

    const rows = [];
    for (const row of dataRows) {
      const date = parseDate(dateCol >= 0 ? row[dateCol] : null);
      if (!date) continue;
      const amount = parseAmount(amountCol >= 0 ? row[amountCol] : 0);
      if (amount === 0) continue;
      const counterparty = String(row[counterpartyCol] || '').trim();
      const description = String(row[descCol] || '').trim();
      const isExpense = parseExpenseFlag(payMethodCol >= 0 ? String(row[payMethodCol] || '') : '');
      const categoryId = classifyBill(description, counterparty, rules, defaultCategoryId);
      rows.push({
        tempId: `import_${Date.now()}_${rows.length}`,
        date, amount, isExpense, categoryId, counterparty, description,
        paymentMethod: isExpense ? '支出' : '收入', source: platform, rawData: JSON.stringify(row)
      });
    }
    return { detectedSource: platform, rows, needsMapping: false, totalParsed: rows.length };
  });

  ipcMain.handle('file:commitImport', async (_event, rows) => {
    const data = getDB_data();
    const lid = ledgerId({});
    let inserted = 0;
    const now = new Date().toISOString();
    for (const row of rows) {
      data.bills.push({
        id: data.nextId.bills++, ledger_id: lid,
        date: row.date, amount: row.amount, is_expense: row.isExpense ? 1 : 0,
        category_id: row.categoryId || row.category_id || 6,
        counterparty: row.counterparty || '', description: row.description || '',
        payment_method: row.paymentMethod || row.payment_method || '',
        source: row.source || 'manual', raw_data: row.rawData || row.raw_data || null,
        created_at: now, updated_at: now
      });
      inserted++;
    }
    saveDB();
    return { inserted, skipped: 0 };
  });
}
