// JSON 文件数据库 — 零依赖，绝对可靠
import * as fs from 'fs';
import * as path from 'path';
import * as electron from 'electron/main';
const { app, ipcMain } = electron;

let data = null;
const DB_PATH = path.join(app.getPath('userData'), 'money-keeper-data.json');

const RECYCLE_DAYS = 30;

function cleanExpiredLedgers() {
  if (!data) return;
  const cutoff = Date.now() - RECYCLE_DAYS * 86400 * 1000;
  const expired = data.ledgers.filter(l => l.deleted_at && new Date(l.deleted_at).getTime() < cutoff);
  for (const l of expired) {
    data.bills = data.bills.filter(b => b.ledger_id !== l.id);
    data.categories = data.categories.filter(c => c.ledger_id !== l.id);
    data.classify_rules = data.classify_rules.filter(r => r.ledger_id !== l.id);
    data.ledgers = data.ledgers.filter(x => x.id !== l.id);
  }
  return expired.length;
}

function load() {
  if (data) return data;
  try {
    data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    // 迁移：给旧账本补上 deleted_at 字段
    let migrated = false;
    for (const l of data.ledgers) {
      if (l.deleted_at === undefined) { l.deleted_at = null; migrated = true; }
    }
    // 清理过期账本（>30 天）
    const cleaned = cleanExpiredLedgers();
    if (migrated || cleaned > 0) save();
  } catch {
    data = createEmpty();
    save();
    // 仅在开发模式下生成测试数据，打包版给用户干净账本
    if (!app.isPackaged) generateTestData();
  }
  return data;
}

function save() {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8'); } catch {}
}

// 默认分类规则关键词（从描述和交易对方中匹配）
const DEFAULT_RULE_KEYWORDS = {
  游戏: [
    'Steam', 'Epic', 'PlayStation', 'PS5', 'PS4', 'Xbox', 'Nintendo', 'Switch',
    '王者荣耀', '原神', '崩坏', '星穹铁道', '绝区零', '鸣潮', '永劫无间',
    '和平精英', '英雄联盟', 'LOL', '金铲铲', '阴阳师', '明日方舟',
    '碧蓝航线', 'Fate', '公主连结', '幻塔', '火影忍者', '梦幻西游',
    '充值', '点卡', '点券', '钻石', '月卡', '季卡', '通行证', '战令',
    '皮肤', '道具', '礼包', '首充', '续充', '氪金',
    '腾讯游戏', '米哈游', '网易游戏', '完美世界', '哔哩哔哩游戏',
    '鹰角', '紫龙', '莉莉丝', '库洛', '叠纸',
    'UU加速器', '迅游', '奇游', '雷神', '加速器',
    '虎牙', '斗鱼', 'B站直播', '直播打赏', '陪玩', '代练',
  ],
  医疗: [
    '医院', '门诊', '急诊', '住院', '手术', '挂号', '预约挂号',
    '检查费', '化验', '体检', '复查', '随访', '救护车',
    '内科', '外科', '儿科', '妇科', '眼科', '牙科', '口腔', '皮肤科',
    '骨科', '耳鼻喉', '中医', '针灸', '推拿', '正骨', '康复',
    '药房', '药店', '药', '中药', '西药', '处方', '医保', '医保卡',
    '社保卡', '医保结算', '统筹支付',
    '大参林', '老百姓', '益丰', '一心堂', '同仁堂', '海王星辰',
    '叮当快药', '京东健康', '阿里健康',
    '牙套', '正畸', '种牙', '补牙', '拔牙', '根管', '洗牙',
    '近视手术', '激光手术', 'OK镜', '眼镜',
    '口罩', '体温计', '血压计', '血糖仪',
    '医疗保险', '重疾险', '医疗险', '惠民保',
    '诊所', '卫生所', '社区卫生', '理疗', '心理',
  ],
  教育: [
    '培训', '课程', '网课', '线上课', '补习', '辅导', '家教',
    '技能培训', '职业培训', 'IT培训', '语言培训',
    '考试', '报名费', '考级', '雅思', '托福', 'GRE', 'GMAT',
    '考研', '考公', '考编', '法考', 'CPA', 'CFA', 'PMP', '教资',
    '得到', '极客时间', '知乎盐选', '知识星球', '小鹅通',
    '网易公开课', '腾讯课堂', '慕课', '学堂在线', '中国大学MOOC',
    'Coursera', 'Udemy', 'edX',
    '书店', '书籍', '教材', '教辅', '图书', 'Kindle', '微信读书',
    '当当', '新华书店', '孔夫子', '多抓鱼', '文具', '打印',
    '学费', '住宿费', '书本费', '班费', '学杂费', '保育费',
    '幼儿园', '早教', '托班',
    '知网', '万方', '论文', '查重', '期刊', '版面费',
  ],
  旅行: [
    '机票', '火车票', '高铁', '动车', '航班', '航空', '12306',
    '携程', '去哪儿', '飞猪', '同程', '艺龙', '途牛', '马蜂窝',
    '酒店', '民宿', '旅馆', '客栈', '青旅', 'airbnb', 'Booking',
    '如家', '汉庭', '全季', '桔子', '亚朵', '锦江之星', '7天',
    '希尔顿', '万豪', '洲际', '凯悦', '香格里拉', '喜来登',
    '景区', '门票', '景点', '游乐园', '迪士尼', '环球影城',
    '欢乐谷', '长隆', '故宫', '长城', '张家界', '九寨沟', '黄山',
    '泰山', '西湖', '丽江', '三亚', '大理', '桂林',
    '租车', '神州', '一嗨', '自驾', '跟团', '自由行', '半日游',
    '签证', '护照', '港澳通行证', '入台证',
  ],
  日用: [
    '外卖', '美团', '饿了么', '餐厅', '饭店', '快餐', '食堂',
    '肯德基', '麦当劳', '汉堡王', '星巴克', '瑞幸', '奶茶',
    '喜茶', '奈雪', '蜜雪冰城', '茶百道', '霸王茶姬', '古茗',
    '咖啡', '早餐', '午餐', '晚餐', '小吃', '烧烤', '火锅',
    '海底捞', '呷哺', '西贝', '外婆家', '绿茶', '太二',
    '超市', '便利店', '小卖部', '物美', '盒马', '山姆', 'Costco',
    '大润发', '永辉', '华联', '联华', '京客隆', '华润万家',
    '全家', '罗森', '711', '美宜佳', '便利蜂',
    '淘宝', '京东', '拼多多', '天猫', '唯品会', '得物', '闲鱼',
    '1688', '苏宁', '网易严选', '小米商城', '华为商城',
    '地铁', '公交', '一卡通', '交通卡', '乘车码', '扫码乘车',
    '共享单车', '哈啰', '美团单车', '青桔', '滴滴', '花小猪',
    '高德打车', 'T3出行', '曹操出行', '首汽',
    '话费', '流量', '充值缴费', '中国移动', '中国联通', '中国电信', '宽带',
    '电费', '水费', '燃气费', '天然气', '暖气费', '物业费', '停车费',
    '房租', '房贷', '按揭', '维修', '装修', '家电', '宜家',
    '理发', '剪发', '美发', '美甲', '美容', '护肤', '化妆品',
    '洗发', '沐浴', '牙膏', '洗衣液', '纸巾', '日用品',
    '衣服', '裤子', '鞋子', '鞋', '包', '帽子', '围巾',
    '优衣库', 'ZARA', 'H&M', 'UR', '耐克', '阿迪', '李宁', '安踏',
    '宠物', '猫粮', '狗粮', '猫砂', '宠物医院', '宠物店',
    '苹果', '华为', '小米', 'OPPO', 'vivo', '三星', '电脑', '手机',
    '快递', '顺丰', '中通', '圆通', '韵达', '申通', '百世', '极兔',
    '共享充电宝', '街电', '怪兽', '小电',
  ],
};

/** 为指定账本创建默认分类规则 */
function seedRulesForLedger(ledgerId, categories) {
  const rules = [];
  const catMap = {};
  for (const c of categories) { catMap[c.name] = c.id; }
  for (const [catName, keywords] of Object.entries(DEFAULT_RULE_KEYWORDS)) {
    const catId = catMap[catName];
    if (!catId) continue;
    rules.push({
      id: data.nextId.rules++,
      ledger_id: ledgerId,
      category_id: catId,
      field: 'both',
      keywords: JSON.stringify(keywords),
      enabled: 1,
    });
  }
  return rules;
}

function createEmpty() {
  data = {
    ledgers: [{ id: 1, name: '默认账本', created_at: new Date().toISOString(), deleted_at: null }],
    categories: [
      { id: 1, ledger_id: 1, name: '游戏', icon: 'PlayCircleOutlined', color: '#2a78d6', is_preset: 1, sort_order: 1 },
      { id: 2, ledger_id: 1, name: '医疗', icon: 'MedicineBoxOutlined', color: '#eb6834', is_preset: 1, sort_order: 2 },
      { id: 3, ledger_id: 1, name: '教育', icon: 'ReadOutlined', color: '#1baf7a', is_preset: 1, sort_order: 3 },
      { id: 4, ledger_id: 1, name: '旅行', icon: 'CompassOutlined', color: '#eda100', is_preset: 1, sort_order: 4 },
      { id: 5, ledger_id: 1, name: '日用', icon: 'ShoppingCartOutlined', color: '#e87ba4', is_preset: 1, sort_order: 5 },
      { id: 6, ledger_id: 1, name: '其它', icon: 'EllipsisOutlined', color: '#008300', is_preset: 1, sort_order: 6 },
    ],
    bills: [],
    classify_rules: [],
    import_mappings: [],
    settings: { active_ledger: 1 },
    nextId: { bills: 1, categories: 7, rules: 1, ledgers: 2, mappings: 1 }
  };
  // 为默认账本创建默认规则
  data.classify_rules = seedRulesForLedger(1, data.categories);
  return data;
}

function generateTestData() {
  const txs = [
    {c:1,d:'王者荣耀充值',a:648,p:'腾讯游戏',m:1},{c:1,d:'Steam购买',a:298,p:'Steam',m:1},{c:1,d:'原神月卡',a:30,p:'米哈游',m:2},{c:1,d:'PS会员',a:75,p:'Sony',m:2},{c:1,d:'Switch卡带',a:350,p:'Nintendo',m:3},{c:1,d:'和平精英皮肤',a:128,p:'腾讯游戏',m:4},{c:1,d:'Steam特卖',a:156,p:'Steam',m:5},{c:1,d:'崩坏充值',a:98,p:'米哈游',m:6},
    {c:2,d:'体检',a:580,p:'体检中心',m:2},{c:2,d:'牙科检查',a:320,p:'口腔医院',m:3},{c:2,d:'感冒药',a:45,p:'大药房',m:5},{c:2,d:'眼科复查',a:180,p:'眼科医院',m:6},
    {c:3,d:'极客时间课程',a:199,p:'极客时间',m:1},{c:3,d:'雅思报名费',a:2170,p:'考试中心',m:2},{c:3,d:'考研辅导书',a:156,p:'当当网',m:3},{c:3,d:'Coursera订阅',a:298,p:'Coursera',m:4},{c:3,d:'得到电子书',a:35,p:'得到',m:5},{c:3,d:'论文查重',a:88,p:'知网',m:6},
    {c:4,d:'高铁票',a:553,p:'12306',m:1},{c:4,d:'三亚酒店',a:1280,p:'携程',m:1},{c:4,d:'景区门票',a:200,p:'景区',m:3},{c:4,d:'机票',a:890,p:'去哪儿',m:4},{c:4,d:'民宿',a:680,p:'Airbnb',m:4},{c:4,d:'杭州高铁',a:280,p:'12306',m:6},
    {c:5,d:'超市购物',a:186,p:'物美',m:1},{c:5,d:'外卖午餐',a:35,p:'美团',m:1},{c:5,d:'地铁月卡',a:100,p:'支付宝',m:1},{c:5,d:'话费',a:50,p:'中国移动',m:1},{c:5,d:'电费',a:128,p:'国家电网',m:2},{c:5,d:'盒马购物',a:230,p:'盒马',m:2},{c:5,d:'瑞幸咖啡',a:18,p:'瑞幸',m:2},{c:5,d:'理发',a:45,p:'理发店',m:3},{c:5,d:'淘宝购物',a:299,p:'淘宝',m:3},{c:5,d:'燃气费',a:86,p:'燃气公司',m:3},{c:5,d:'京东买书',a:120,p:'京东',m:4},{c:5,d:'外卖晚餐',a:48,p:'饿了么',m:4},{c:5,d:'滴滴打车',a:32,p:'滴滴',m:5},{c:5,d:'水费',a:65,p:'水务公司',m:5},{c:5,d:'外卖午餐',a:28,p:'美团',m:6},{c:5,d:'超市购物',a:156,p:'大润发',m:6},
    {c:6,d:'微信红包',a:200,p:'微信',m:2},{c:6,d:'转账给朋友',a:500,p:'支付宝',m:4},{c:6,d:'快递费',a:15,p:'顺丰',m:5},{c:6,d:'共享充电宝',a:6,p:'街电',m:6},
  ];
  const now = new Date().toISOString();
  for (const tx of txs) {
    const day = Math.floor(Math.random() * 27) + 1;
    data.bills.push({
      id: data.nextId.bills++, ledger_id: 1,
      date: `2026-${String(tx.m).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
      amount: tx.a, is_expense: 1, category_id: tx.c,
      counterparty: tx.p, description: tx.d, payment_method: '支出', source: 'manual',
      raw_data: null, created_at: now, updated_at: now
    });
  }
  save();
}

function ledgerId(filters) {
  if (filters?.ledgerId) return filters.ledgerId;
  return data?.settings?.active_ledger || 1;
}

export async function registerDatabaseHandlers() {
  load();
  console.log('db: JSON data loaded, bills count:', data.bills.length);

  // 账本
  ipcMain.handle('db:getLedgers', () => data.ledgers.filter(l => !l.deleted_at));
  ipcMain.handle('db:getActiveLedger', () => {
    const lid = ledgerId({});
    return data.ledgers.find(l => l.id === lid) || data.ledgers[0];
  });
  ipcMain.handle('db:setActiveLedger', (_e, id) => { data.settings.active_ledger = id; save(); });
  ipcMain.handle('db:createLedger', (_e, name) => {
    const id = data.nextId.ledgers++;
    data.ledgers.push({ id, name, created_at: new Date().toISOString(), deleted_at: null });
    // 为新账本创建预设分类
    const presets = ['游戏','医疗','教育','旅行','日用','其它'];
    const icons = ['PlayCircleOutlined','MedicineBoxOutlined','ReadOutlined','CompassOutlined','ShoppingCartOutlined','EllipsisOutlined'];
    const colors = ['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4','#008300'];
    const newCats = [];
    presets.forEach((n, i) => {
      const cat = { id: data.nextId.categories++, ledger_id: id, name: n, icon: icons[i], color: colors[i], is_preset: 1, sort_order: i + 1 };
      data.categories.push(cat);
      newCats.push(cat);
    });
    // 为新账本创建默认分类规则
    const newRules = seedRulesForLedger(id, newCats);
    data.classify_rules.push(...newRules);
    save();
    return id;
  });
  // 软删除：标记删除时间，数据保留 30 天
  ipcMain.handle('db:deleteLedger', (_e, id) => {
    if (id === 1) return false;
    const l = data.ledgers.find(l => l.id === id);
    if (!l || l.deleted_at) return false;
    l.deleted_at = new Date().toISOString();
    if (data.settings.active_ledger === id) data.settings.active_ledger = 1;
    save();
    return true;
  });
  // 恢复：30 天内可恢复
  ipcMain.handle('db:restoreLedger', (_e, id) => {
    const l = data.ledgers.find(l => l.id === id);
    if (!l || !l.deleted_at) return false;
    const days = (Date.now() - new Date(l.deleted_at).getTime()) / (86400 * 1000);
    if (days > RECYCLE_DAYS) return false;
    l.deleted_at = null;
    save();
    return true;
  });
  // 永久删除：立即清除所有关联数据
  ipcMain.handle('db:permanentlyDeleteLedger', (_e, id) => {
    if (id === 1) return false;
    data.bills = data.bills.filter(b => b.ledger_id !== id);
    data.categories = data.categories.filter(c => c.ledger_id !== id);
    data.classify_rules = data.classify_rules.filter(r => r.ledger_id !== id);
    data.ledgers = data.ledgers.filter(l => l.id !== id);
    if (data.settings.active_ledger === id) data.settings.active_ledger = 1;
    save();
    return true;
  });
  // 回收站：已删除且未过期的账本
  ipcMain.handle('db:getDeletedLedgers', () => {
    const cutoff = Date.now() - RECYCLE_DAYS * 86400 * 1000;
    return data.ledgers.filter(l => l.deleted_at && new Date(l.deleted_at).getTime() >= cutoff);
  });
  ipcMain.handle('db:renameLedger', (_e, id, name) => {
    const l = data.ledgers.find(l => l.id === id);
    if (l) { l.name = name; save(); }
  });
  ipcMain.handle('db:clearLedgerBills', (_e, lid) => {
    const l = lid || ledgerId({});
    data.bills = data.bills.filter(b => b.ledger_id !== l);
    save();
    return true;
  });

  // 账单
  ipcMain.handle('db:getBills', (_e, f) => {
    const lid = ledgerId(f);
    let rows = data.bills.filter(b => b.ledger_id === lid);
    if (f?.dateFrom) rows = rows.filter(b => b.date >= f.dateFrom);
    if (f?.dateTo) rows = rows.filter(b => b.date <= f.dateTo);
    if (f?.categoryId) rows = rows.filter(b => b.category_id === f.categoryId);
    if (f?.keyword) {
      const kw = f.keyword.toLowerCase();
      rows = rows.filter(b => (b.description || '').toLowerCase().includes(kw) || (b.counterparty || '').toLowerCase().includes(kw));
    }
    rows.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    const total = rows.length;
    const page = f?.page || 1;
    const pageSize = f?.pageSize || 50;
    const paged = rows.slice((page - 1) * pageSize, page * pageSize);
    const cats = data.categories.filter(c => c.ledger_id === lid);
    return {
      rows: paged.map(b => {
        const cat = cats.find(c => c.id === b.category_id);
        return { ...b, category_name: cat?.name, category_color: cat?.color, category_icon: cat?.icon };
      }),
      total, page, pageSize
    };
  });
  ipcMain.handle('db:updateBill', (_e, id, ch) => {
    const b = data.bills.find(b => b.id === id);
    if (b) { Object.assign(b, ch); b.updated_at = new Date().toISOString(); save(); }
  });
  ipcMain.handle('db:deleteBills', (_e, ids) => {
    data.bills = data.bills.filter(b => !ids.includes(b.id));
    save();
  });

  // 分类
  ipcMain.handle('db:getCategories', (_e, lid) =>
    data.categories.filter(c => c.ledger_id === (lid || ledgerId({}))).sort((a, b) => a.sort_order - b.sort_order)
  );

  // 规则
  ipcMain.handle('db:getClassifyRules', (_e, lid) => {
    const l = lid || ledgerId({});
    return data.classify_rules.filter(r => r.ledger_id === l).map(r => {
      const cat = data.categories.find(c => c.id === r.category_id && c.ledger_id === l);
      return { ...r, category_name: cat?.name || '' };
    });
  });
  ipcMain.handle('db:saveClassifyRule', (_e, r) => {
    const id = data.nextId.rules++;
    data.classify_rules.push({ id, ledger_id: r.ledger_id || ledgerId({}), category_id: r.category_id, field: r.field || 'both', keywords: JSON.stringify(r.keywords), enabled: r.enabled ? 1 : 0 });
    save();
  });
  ipcMain.handle('db:updateClassifyRule', (_e, id, ch) => {
    const r = data.classify_rules.find(r => r.id === id);
    if (r) {
      if (ch.keywords) ch.keywords = JSON.stringify(ch.keywords);
      if (ch.enabled !== undefined) ch.enabled = ch.enabled ? 1 : 0;
      Object.assign(r, ch);
      save();
    }
  });
  ipcMain.handle('db:deleteClassifyRule', (_e, id) => {
    data.classify_rules = data.classify_rules.filter(r => r.id !== id);
    save();
  });
  // 为指定账本创建默认分类规则（已有规则时不重复创建）
  ipcMain.handle('db:seedDefaultRules', (_e, lid) => {
    const l = lid || ledgerId({});
    const existing = data.classify_rules.filter(r => r.ledger_id === l);
    if (existing.length > 0) return { created: 0, message: '已有规则，跳过' };
    const cats = data.categories.filter(c => c.ledger_id === l);
    const newRules = seedRulesForLedger(l, cats);
    data.classify_rules.push(...newRules);
    save();
    return { created: newRules.length, message: `已创建 ${newRules.length} 条默认规则` };
  });

  /**
   * 统计辅助：根据账单列表 + 分类列表计算分类汇总
   * 直接累加账单的 totalExpense，不依赖 breakdown 求和，避免跨账本分类 ID 不匹配导致总额归零
   */
  function calcBreakdown(bills, cats) {
    // 先建立分类查找表（含跨账本回退）
    const catMap = {};
    for (const c of cats) catMap[c.id] = c;
    // 找到"其它"分类用作回退
    const fallbackCat = cats.find(c => c.name === '其它') || { id: 0, name: '其它', color: '#008300' };

    const byCat = {};
    for (const b of bills) {
      const cat = catMap[b.category_id] || fallbackCat;
      const cid = cat.id;
      if (!byCat[cid]) byCat[cid] = { categoryId: cid, categoryName: cat.name, color: cat.color, amount: 0, count: 0 };
      byCat[cid].amount += b.amount;
      byCat[cid].count += 1;
    }
    const breakdown = Object.values(byCat).sort((a, b) => b.amount - a.amount);
    const totalExpense = bills.reduce((s, b) => s + b.amount, 0);
    breakdown.forEach(c => { c.percentage = totalExpense > 0 ? (c.amount / totalExpense) * 100 : 0; });
    return { breakdown, totalExpense };
  }

  // 统计
  ipcMain.handle('db:getMonthlySummary', (_e, yr, mo, lid) => {
    const l = lid || ledgerId({});
    const bills = data.bills.filter(b => b.ledger_id === l && b.is_expense === 1 && b.date.startsWith(`${yr}-${String(mo).padStart(2,'0')}`));
    const cats = data.categories.filter(c => c.ledger_id === l);
    const { breakdown, totalExpense } = calcBreakdown(bills, cats);
    const incomeBills = data.bills.filter(b => b.ledger_id === l && b.is_expense === 0 && b.date.startsWith(`${yr}-${String(mo).padStart(2,'0')}`));
    return { year: yr, month: mo, totalExpense, totalIncome: incomeBills.reduce((s, b) => s + b.amount, 0), categoryBreakdown: breakdown };
  });

  ipcMain.handle('db:getAnnualSummary', (_e, yr, lid) => {
    const l = lid || ledgerId({});
    const yrStr = String(yr);
    const expenseBills = data.bills.filter(b => b.ledger_id === l && b.is_expense === 1 && b.date.startsWith(yrStr));
    const cats = data.categories.filter(c => c.ledger_id === l);
    const { breakdown, totalExpense } = calcBreakdown(expenseBills, cats);
    const incomeBills = data.bills.filter(b => b.ledger_id === l && b.is_expense === 0 && b.date.startsWith(yrStr));
    const monthlyTrend = [];
    for (let m = 1; m <= 12; m++) {
      const mb = data.bills.filter(b => b.ledger_id === l && b.date.startsWith(`${yr}-${String(m).padStart(2,'0')}`));
      if (mb.length > 0) monthlyTrend.push({ year: yr, month: m, totalExpense: mb.filter(b => b.is_expense === 1).reduce((s, b) => s + b.amount, 0), categoryBreakdown: [] });
    }
    return { year: yr, totalExpense, totalIncome: incomeBills.reduce((s, b) => s + b.amount, 0), categoryBreakdown: breakdown, monthlyTrend };
  });

  // 自定义日期范围统计
  ipcMain.handle('db:getDateRangeSummary', (_e, dateFrom, dateTo, lid) => {
    const l = lid || ledgerId({});
    const bills = data.bills.filter(b =>
      b.ledger_id === l && b.is_expense === 1 && b.date >= dateFrom && b.date <= dateTo
    );
    const cats = data.categories.filter(c => c.ledger_id === l);
    const { breakdown, totalExpense } = calcBreakdown(bills, cats);
    const incomeBills = data.bills.filter(b =>
      b.ledger_id === l && b.is_expense === 0 && b.date >= dateFrom && b.date <= dateTo
    );
    return {
      dateFrom, dateTo, totalExpense,
      totalIncome: incomeBills.reduce((s, b) => s + b.amount, 0),
      categoryBreakdown: breakdown
    };
  });

  ipcMain.handle('db:getCategoryTrend', (_e, catId, yr, lid) => {
    const l = lid || ledgerId({});
    const cat = data.categories.find(c => c.id === catId && c.ledger_id === l);
    const bills = data.bills.filter(b => b.ledger_id === l && b.category_id === catId && b.is_expense === 1 && b.date.startsWith(String(yr)));
    const monthly = {};
    bills.forEach(b => {
      const m = parseInt(b.date.slice(5, 7));
      monthly[m] = (monthly[m] || 0) + b.amount;
    });
    return { categoryId: catId, categoryName: cat?.name || '', dataPoints: Object.entries(monthly).map(([m, a]) => ({ year: yr, month: parseInt(m), amount: a })).sort((a, b) => a.month - b.month) };
  });

  // 映射
  ipcMain.handle('db:getImportMappings', () => data.import_mappings);
  ipcMain.handle('db:saveImportMapping', (_e, m) => {
    const id = data.nextId.mappings++;
    data.import_mappings.push({ id, name: m.name, source: m.source, field_map: JSON.stringify(m.field_map), skip_rows: m.skip_rows || 0, encoding: m.encoding || 'utf-8' });
    save();
  });
}

// 导出让 file-ipc 使用
export function getDB_data() { return load(); }
export function saveDB() { save(); }
export { ledgerId };
