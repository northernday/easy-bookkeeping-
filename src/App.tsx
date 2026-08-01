import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { message } from 'antd'
import AppLayout from './components/Layout/AppLayout'
import Dashboard from './routes/Dashboard'
import Bills from './routes/Bills'
import Import from './routes/Import'
import Categories from './routes/Categories'
import { useImportStore } from './store/useImportStore'
import { useCategoryStore } from './store/useCategoryStore'

function AppContent() {
  const navigate = useNavigate()
  const [dragOver, setDragOver] = useState(false)
  const setFileAndParse = useImportStore(s => s.setFileAndParse)
  const fetchCategories = useCategoryStore(s => s.fetchCategories)

  // 初始化加载分类
  useEffect(() => {
    fetchCategories()
  }, [])

  // 全局拖入监听
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(true)
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      // 只在离开 document 时取消高亮
      if (e.target === document.documentElement) {
        setDragOver(false)
      }
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(false)

      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return

      const file = files[0]
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!['xlsx', 'csv'].includes(ext || '')) {
        message.warning('仅支持 .xlsx / .csv 格式的账单文件')
        return
      }

      // Electron 暴露了 file.path
      const filePath = (file as any).path
      if (filePath) {
        message.info(`已检测到 ${file.name}，正在解析…`)
        navigate('/import')
        setTimeout(() => setFileAndParse(filePath), 100)
      }
    }

    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('drop', handleDrop)

    return () => {
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('drop', handleDrop)
    }
  }, [])

  // 桌面文件关联 / 双击打开
  useEffect(() => {
    if (window.electronAPI?.onOpenFile) {
      window.electronAPI.onOpenFile((filePath: string) => {
        navigate('/import')
        setTimeout(() => setFileAndParse(filePath), 100)
      })
    }
  }, [])

  return (
    <div className={dragOver ? 'drag-over' : ''} style={{ height: '100%' }}>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/bills" element={<Bills />} />
          <Route path="/import" element={<Import />} />
          <Route path="/categories" element={<Categories />} />
        </Routes>
      </AppLayout>
    </div>
  )
}

function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  )
}

export default App
