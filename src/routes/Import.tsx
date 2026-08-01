import { Card, Steps, Button, Space, Table, Select, Tag, Result, message, Progress, Alert } from 'antd'
import { FileExcelOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useImportStore } from '@/store/useImportStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useAppStore } from '@/store/useAppStore'
import type { ImportRow, Category } from '@/types/bill'
import { useNavigate } from 'react-router-dom'

function FileDropZone({ onFile }: { onFile: (path: string, name: string) => void }) {
  const handleClick = async () => {
    const result = await window.electronAPI.openFileDialog()
    if (result) {
      onFile(result.filePath, result.fileName)
    }
  }

  return (
    <div
      style={{
        border: '2px dashed var(--color-ink-muted)',
        borderRadius: 8,
        padding: '60px 24px',
        textAlign: 'center',
        cursor: 'pointer',
        background: 'var(--color-surface)',
        transition: 'border-color 0.3s',
      }}
      onDragOver={(e) => e.preventDefault()}
      onClick={handleClick}
    >
      <p style={{ fontSize: 48, color: 'var(--color-ink-muted)', marginBottom: 16 }}>
        <FileExcelOutlined />
      </p>
      <p style={{ fontSize: 16, marginBottom: 8, color: 'var(--color-ink-primary)' }}>
        点击选择文件，或将账单文件拖入窗口任意位置
      </p>
      <p style={{ color: 'var(--color-ink-secondary)', fontSize: 13 }}>
        支持微信、支付宝导出的 .xlsx / .csv 账单文件
      </p>
    </div>
  )
}

export default function Import() {
  const navigate = useNavigate()
  const {
    step, fileName, detectedSource, rows, needsMapping, rawHeaders,
    isParsing, parseError, parseFile, updateRow, commitImport, reset
  } = useImportStore()
  const categories = useCategoryStore(s => s.categories)

  const handleFile = (path: string, name: string) => {
    useImportStore.setState({ filePath: path, fileName: name })
    setTimeout(() => parseFile(), 50)
  }

  const handleCommit = async () => {
    try {
      const result = await commitImport()
      message.success(`导入完成！成功 ${result.inserted} 条`)
      useAppStore.getState().triggerRefresh()
      navigate('/')
    } catch (err: any) {
      message.error('导入失败：' + (err.message || '未知错误'))
    }
  }

  const formatSource = (s: string) => {
    const map: Record<string, string> = { wechat: '微信', alipay: '支付宝', csv: 'CSV', unknown: '未知格式' }
    return map[s] || s
  }

  const columns: ColumnsType<ImportRow> = [
    { title: '日期', dataIndex: 'date', width: 110 },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 100,
      align: 'right',
      render: (v: number, r: ImportRow) => (
        <span className="amount-num" style={{ color: r.isExpense ? '#E03131' : '#2F9E44' }}>
          {r.isExpense ? '-' : '+'}¥{v.toFixed(2)}
        </span>
      ),
    },
    {
      title: '分类',
      dataIndex: 'categoryId',
      width: 130,
      render: (catId: number, row: ImportRow) => (
        <Select
          value={catId}
          size="small"
          style={{ width: 100 }}
          onChange={v => updateRow(row.tempId, { categoryId: v })}
          options={categories.map((c: Category) => ({
            label: c.name, value: c.id,
          }))}
        />
      ),
    },
    { title: '交易对方', dataIndex: 'counterparty', width: 150, ellipsis: true },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    {
      title: '来源',
      dataIndex: 'source',
      width: 70,
      render: formatSource,
    },
  ]

  return (
    <Card title="导入账单" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Steps
        current={step}
        style={{ marginBottom: 32 }}
        items={[
          { title: '选择文件' },
          { title: '解析预览' },
          { title: '确认导入' },
        ]}
      />

      {/* Step 0-1: 选择文件 */}
      {step <= 1 && (
        <>
          <FileDropZone onFile={handleFile} />

          {isParsing && (
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Progress percent={99} status="active" />
              <p style={{ marginTop: 8, color: 'var(--color-ink-secondary)' }}>正在解析文件…</p>
            </div>
          )}

          {parseError && (
            <Alert
              type="error"
              message="解析失败"
              description={parseError}
              showIcon
              style={{ marginTop: 16 }}
              action={
                <Button size="small" onClick={reset}>重新选择</Button>
              }
            />
          )}
        </>
      )}

      {/* Step 2: 字段映射（未知格式） */}
      {step === 2 && needsMapping && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Result
            status="warning"
            title="未识别的文件格式"
            subTitle={`检测到以下列: ${rawHeaders.join(', ')}`}
            extra={
              <Space>
                <Button onClick={reset}>重新选择</Button>
                <Button type="primary" onClick={() => useImportStore.setState({ step: 3 })}>
                  使用默认映射继续
                </Button>
              </Space>
            }
          />
        </div>
      )}

      {/* Step 2-3: 预览确认 */}
      {step >= 2 && !needsMapping && rows.length > 0 && (
        <>
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Tag color="blue">{fileName}</Tag>
              <Tag>{formatSource(detectedSource || '')}</Tag>
              <span style={{ color: 'var(--color-ink-secondary)' }}>
                共解析 {rows.length} 条记录
              </span>
            </Space>
          </div>

          <Table
            rowKey="tempId"
            columns={columns}
            dataSource={rows}
            size="small"
            pagination={{ pageSize: 50, showTotal: t => `共 ${t} 条` }}
            scroll={{ y: 400 }}
            style={{ marginBottom: 24 }}
          />

          <div style={{ textAlign: 'center' }}>
            <Space size="large">
              <Button onClick={reset}>取消</Button>
              <Button type="primary" size="large" onClick={handleCommit}>
                确认导入 ({rows.length} 条)
              </Button>
            </Space>
          </div>
        </>
      )}
    </Card>
  )
}
