// === 启动诊断日志 ===
import { mkdirSync, writeFileSync, appendFileSync, existsSync, copyFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 早期日志：electron 加载前的日志暂存到 __dirname（打包版 asar 内写不进去会被 catch 忽略）
let LOG_DIR;
try {
  LOG_DIR = join(__dirname, '..', 'data');
  mkdirSync(LOG_DIR, { recursive: true });
} catch {
  LOG_DIR = __dirname;
}

const LOG_FILE = join(LOG_DIR, 'startup.log');
function log(msg) {
  try { appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`); } catch {}
}
log('=== 应用启动 ===');
log(`Node: ${process.version}, Platform: ${process.platform}, Arch: ${process.arch}`);
log(`__dirname: ${__dirname}`);

// 在导入 electron 之前注册基础错误处理
process.on('uncaughtException', (err) => {
  log(`UNCAUGHT EXCEPTION: ${err.stack || err.message}`);
  try {
    const { dialog, app: appErr } = require('electron');
    dialog.showErrorBox('启动错误', err.stack || err.message);
  } catch {
    // fallback: log only
  }
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  log(`UNHANDLED REJECTION: ${err?.stack || err?.message || err}`);
  process.exit(1);
});

log('正在导入 electron/main...');
var electronMod;
try {
  electronMod = await import('electron/main');
  log('electron/main 导入成功');
  log(`导出键: ${Object.keys(electronMod).join(', ')}`);
} catch (e) {
  log(`electron/main 导入失败: ${e.stack || e.message}`);
  process.exit(1);
}

const { app, BrowserWindow, shell, dialog } = electronMod;

// === 便携模式：数据目录设在应用自身旁边，每个副本完全独立 ===
// 开发版：<项目根>/data/    打包版：<exe所在目录>/data/
const APP_ROOT = app.isPackaged ? dirname(app.getPath('exe')) : join(__dirname, '..');
const DATA_DIR = join(APP_ROOT, 'data');
try { mkdirSync(DATA_DIR, { recursive: true }); } catch {}

// 将日志重定向到正确的数据目录
const REAL_LOG_FILE = join(DATA_DIR, 'startup.log');
if (REAL_LOG_FILE !== LOG_FILE) {
  try {
    // 把早期日志追搬到正确位置
    if (existsSync(LOG_FILE)) {
      const early = readFileSync(LOG_FILE, 'utf-8');
      appendFileSync(REAL_LOG_FILE, early);
    }
  } catch {}
  // 后续所有 log() 仍然写到旧 LOG_FILE，但这没关系——
  // 对于开发版两个路径相同；对于打包版早期日志已经追搬完毕
}

const LOCAL_DB = join(DATA_DIR, 'money-keeper-data.json');
const LEGACY_DB = join(process.env.APPDATA || '', 'money-keeper', 'money-keeper-data.json');

// 迁移旧数据：如果旧位置（%APPDATA%）有数据而新位置没有，复制过来（仅一次）
if (!existsSync(LOCAL_DB)) {
  try {
    if (existsSync(LEGACY_DB)) {
      copyFileSync(LEGACY_DB, LOCAL_DB);
      log('数据已从旧位置迁移: ' + LEGACY_DB + ' → ' + LOCAL_DB);
    }
  } catch (e) {
    log('数据迁移失败: ' + (e.stack || e.message));
  }
}

// 必须在 app.whenReady() 之前调用
app.setPath('userData', DATA_DIR);
log('userData 路径: ' + app.getPath('userData'));
log('APP_ROOT: ' + APP_ROOT);

log('正在导入服务模块...');
let registerFileHandlers, registerDatabaseHandlers;
try {
  const fileMod = await import('./file-ipc.mjs');
  registerFileHandlers = fileMod.registerFileHandlers;
  log('file-ipc.mjs 导入成功');
} catch (e) {
  log(`file-ipc.mjs 导入失败: ${e.stack || e.message}`);
  throw e;
}

try {
  const dbMod = await import('./database.mjs');
  registerDatabaseHandlers = dbMod.registerDatabaseHandlers;
  log('database.mjs 导入成功');
} catch (e) {
  log(`database.mjs 导入失败: ${e.stack || e.message}`);
  throw e;
}

let mainWindow = null;

function createWindow() {
  log('正在创建窗口...');
  mainWindow = new BrowserWindow({
    width: 1280, height: 820, minWidth: 960, minHeight: 640,
    title: '轻松记账',
    webPreferences: {
      preload: join(__dirname, 'preload.mjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: false
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });

  if (!app.isPackaged) {
    log('加载开发服务器 http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
  } else {
    const indexPath = join(__dirname, '../out/renderer/index.html');
    log(`加载文件: ${indexPath}`);
    mainWindow.loadFile(indexPath);
  }
  log('窗口创建完成');
}

log(`单实例锁获取中...`);
const gotTheLock = app.requestSingleInstanceLock();
log(`单实例锁: ${gotTheLock}`);

if (!gotTheLock) { log('已有运行实例，退出'); app.quit(); }
else {
  app.on('second-instance', (_e, argv) => {
    log(`second-instance: ${JSON.stringify(argv)}`);
    const fp = argv.find(a => /\.(xlsx|csv)$/i.test(a));
    if (mainWindow) { mainWindow.focus(); if (fp) mainWindow.webContents.send('open-file', fp); }
  });
}

app.on('open-file', (e, fp) => {
  log(`open-file: ${fp}`);
  e.preventDefault();
  if (mainWindow) { mainWindow.focus(); mainWindow.webContents.send('open-file', fp); }
});

log('正在初始化 app.whenReady...');
app.whenReady().then(async () => {
  log('app.whenReady 触发');
  try {
    registerFileHandlers();
    log('文件处理器注册完成');
    await registerDatabaseHandlers();
    log('数据库处理器注册完成');
  } catch(e) {
    log(`处理器注册失败: ${e.stack || e.message}`);
    throw e;
  }
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}).catch(err => {
  log(`app.whenReady 失败: ${err.stack || err.message}`);
  dialog.showErrorBox('应用启动失败', err.stack || err.message);
  process.exit(1);
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

log('main.mjs 加载完成，等待 app.whenReady...');
