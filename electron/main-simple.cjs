// 简单启动脚本 - 验证 Electron 是否能正确启动
// 使用 CommonJS require，由 Electron 直接加载
const { app, BrowserWindow } = require('electron');
const path = require('path');

console.log('Electron main process started!');
console.log('app type:', typeof app);
console.log('BrowserWindow type:', typeof BrowserWindow);

let mainWindow = null;

app.whenReady().then(() => {
  console.log('app.whenReady fired - creating window...');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // 开发模式加载 dev server
  mainWindow.loadURL('http://localhost:5173');
  console.log('Window created, loading dev server...');
});

app.on('window-all-closed', () => {
  app.quit();
});
