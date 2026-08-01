import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// 只构建 renderer — main 和 preload 使用 ESM 裸文件
export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      // 空构建 — 不打包，main.mjs 是 ESM 文件
      rollupOptions: {
        input: {}
      }
    }
  },
  preload: {
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: {}
      }
    }
  },
  renderer: {
    root: '.',
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html')
        }
      }
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    }
  }
})
