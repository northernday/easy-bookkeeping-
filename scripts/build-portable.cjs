/**
 * 便携版构建脚本
 * 解决 electron-builder 下载 winCodeSign/nsis 被墙卡住的问题
 * 用法: node scripts/build-portable.cjs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RELEASE = path.join(ROOT, 'release');
const UNPACKED = path.join(RELEASE, 'win-unpacked');

console.log('[1/3] 清理旧构建...');
try { fs.rmSync(RELEASE, { recursive: true, force: true }); } catch {}

console.log('[2/3] 构建前端...');
execSync('npx vite build', { cwd: ROOT, stdio: 'inherit' });

console.log('[3/3] 打包 Electron...');
execSync('npx electron-builder --win --x64 --dir', {
  cwd: ROOT,
  stdio: 'inherit',
  env: {
    ...process.env,
    CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    ELECTRON_MIRROR: process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/',
  },
  timeout: 120000,
});

// electron-builder 的 --dir 参数只生成 unpacked 目录，跳过 NSIS 安装包和签名
const exe = path.join(UNPACKED, '轻松记账.exe');
if (fs.existsSync(exe)) {
  console.log(`\n✅ 构建成功! 便携版: ${exe}`);
  console.log(`   大小: ${(fs.statSync(exe).size / 1024 / 1024).toFixed(1)} MB`);
} else {
  console.error('\n❌ 构建失败: 找不到 轻松记账.exe');
  process.exit(1);
}
