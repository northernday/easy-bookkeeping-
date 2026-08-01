/**
 * 轻松记账 - 构建脚本
 *
 * 生成 release/win-unpacked/轻松记账.exe (便携版)
 * 同时尝试生成 NSIS 安装包
 *
 * 用法: node scripts/build.cjs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RELEASE = path.join(ROOT, 'release');
const UNPACKED = path.join(RELEASE, 'win-unpacked');
const EXE = path.join(UNPACKED, '轻松记账.exe');
const SETUP_EXE = path.join(RELEASE, '轻松记账 Setup 1.0.0.exe');

const MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/';

function log(msg) { console.log(`\x1b[36m[build]\x1b[0m ${msg}`); }
function ok(msg) { console.log(`\x1b[32m  ✓\x1b[0m ${msg}`); }
function err(msg) { console.log(`\x1b[31m  ✗\x1b[0m ${msg}`); }

// Step 1: 清理
log('步骤 1/3: 清理旧构建...');
try {
  if (fs.existsSync(RELEASE)) {
    fs.rmSync(RELEASE, { recursive: true, force: true });
  }
} catch (e) {
  err(`清理失败: ${e.message}`);
  err('请关闭正在运行的"轻松记账"窗口后重试！');
  process.exit(1);
}
ok('清理完成');

// Step 2: Vite 构建前端
log('步骤 2/3: 构建前端 (Vite)...');
try {
  execSync('npx vite build', { cwd: ROOT, stdio: 'inherit' });
  ok('前端构建完成');
} catch (e) {
  err(`前端构建失败: ${e.message}`);
  process.exit(1);
}

// Step 3: Electron 打包
log('步骤 3/3: 打包 Electron...');
try {
  execSync('npx electron-builder --win --x64', {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      CSC_IDENTITY_AUTO_DISCOVERY: 'false',
      ELECTRON_MIRROR: process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/',
      ELECTRON_BUILDER_BINARIES_MIRROR: MIRROR,
    },
    timeout: 600000, // 10分钟超时
  });
} catch (e) {
  err(`electron-builder 退出异常: ${e.message}`);
}

// 验证结果
console.log('');
console.log('═══════════════════════════════════════');
console.log('  构建结果');
console.log('═══════════════════════════════════════');

if (fs.existsSync(EXE)) {
  const size = fs.statSync(EXE).size;
  console.log(`  ✓ 便携版: ${EXE}`);
  console.log(`    大小: ${(size / 1024 / 1024).toFixed(1)} MB`);
} else {
  console.log(`  ✗ 便携版未生成`);
}

if (fs.existsSync(SETUP_EXE)) {
  const size = fs.statSync(SETUP_EXE).size;
  console.log(`  ✓ 安装包: ${SETUP_EXE}`);
  console.log(`    大小: ${(size / 1024 / 1024).toFixed(1)} MB`);
} else {
  // 尝试匹配其他名称格式
  const files = fs.readdirSync(RELEASE);
  const installer = files.find(f => f.endsWith('.exe') && f.includes('Setup'));
  if (installer) {
    const size = fs.statSync(path.join(RELEASE, installer)).size;
    console.log(`  ✓ 安装包: ${path.join(RELEASE, installer)}`);
    console.log(`    大小: ${(size / 1024 / 1024).toFixed(1)} MB`);
  } else {
    console.log(`  - 安装包未生成 (可能需要手动下载 NSIS 资源)`);
  }
}
console.log('═══════════════════════════════════════');
