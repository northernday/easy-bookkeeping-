// === 启动诊断日志 ===
import { mkdirSync, appendFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 早期日志
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
log('=== GitHub 周报启动 ===');
log(`Node: ${process.version}, Platform: ${process.platform}, Arch: ${process.arch}`);
log(`__dirname: ${__dirname}`);

// 基础错误处理
process.on('uncaughtException', (err) => {
  log(`UNCAUGHT EXCEPTION: ${err.stack || err.message}`);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  log(`UNHANDLED REJECTION: ${err?.stack || err?.message || err}`);
  process.exit(1);
});

// 导入 electron（关键：用 'electron/main' 绕过 npm 桩包）
log('正在导入 electron/main...');
let electronMod;
try {
  electronMod = await import('electron/main');
  log('electron/main typeof: ' + typeof electronMod);
  log('electron keys: ' + Object.keys(electronMod).join(', '));
  log('electron/main 导入成功');
} catch (e) {
  log(`electron/main 导入失败: ${e.stack || e.message}`);
  process.exit(1);
}

const { app, BrowserWindow, shell } = electronMod;

// === 便携模式 ===
const APP_ROOT = app.isPackaged ? dirname(app.getPath('exe')) : join(__dirname, '..');
const DATA_DIR = join(APP_ROOT, 'data');
try { mkdirSync(DATA_DIR, { recursive: true }); } catch {}

// 早期日志追到正确位置
const REAL_LOG_FILE = join(DATA_DIR, 'startup.log');
if (REAL_LOG_FILE !== LOG_FILE) {
  try {
    if (existsSync(LOG_FILE)) {
      const early = readFileSync(LOG_FILE, 'utf-8');
      appendFileSync(REAL_LOG_FILE, early);
    }
  } catch {}
}

app.setPath('userData', DATA_DIR);
log('userData 路径: ' + app.getPath('userData'));

// 导入服务模块
log('正在导入服务模块...');
let registerHandlers;
try {
  const dbMod = await import('./database.mjs');
  registerHandlers = dbMod.registerHandlers;
  log('database.mjs 导入成功');
} catch (e) {
  log(`database.mjs 导入失败: ${e.stack || e.message}`);
  throw e;
}

let mainWindow = null;

function createWindow() {
  log('正在创建窗口...');
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 900, minHeight: 600,
    title: 'GitHub 周报',
    webPreferences: {
      preload: join(__dirname, 'preload.mjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: false
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

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

// 单实例锁
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  log('已有运行实例，退出');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { mainWindow.focus(); }
  });
}

log('正在初始化 app.whenReady...');
app.whenReady().then(async () => {
  log('app.whenReady 触发');
  try {
    registerHandlers();
    log('IPC 处理器注册完成');
  } catch (e) {
    log(`处理器注册失败: ${e.stack || e.message}`);
    throw e;
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch(err => {
  log(`app.whenReady 失败: ${err.stack || err.message}`);
  process.exit(1);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

log('main.mjs 加载完成，等待 app.whenReady...');
