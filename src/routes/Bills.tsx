import { useEffect, useState, useMemo } from 'react'
import { Card, Table, Input, Select, DatePicker, Space, Dropdown, Empty, Button, message, Popconfirm, Modal, Tag } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PlusOutlined, SearchOutlined, ClearOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useBillStore } from '@/store/useBillStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useLedgerStore } from '@/store/useLedgerStore'
import type { Bill, Category } from '@/types/bill'

const { RangePicker } = DatePicker

export default function Bills() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const urlCategoryId = searchParams.get('categoryId')
  const urlCategoryName = searchParams.get('categoryName')

  const { bills, total, page, pageSize, isLoading, fetchBills, updateBillCategory, deleteBills } = useBillStore()
  const { categories, fetchCategories } = useCategoryStore()
  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<number | undefined>(
    urlCategoryId ? parseInt(urlCategoryId) : undefined
  )
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])

  const { activeLedger, clearBills } = useLedgerStore()
  useEffect(() => {
    // 清空 store 中残留的旧筛选条件
    useBillStore.setState({ filters: {} })
    fetchCategories()
    const initialCategoryId = urlCategoryId ? parseInt(urlCategoryId) : undefined
    setCategoryFilter(initialCategoryId)
    fetchBills({
      page: 1, pageSize: 50,
      ledgerId: activeLedger?.id || 1,
      categoryId: initialCategoryId || undefined,
    })
  }, [activeLedger?.id])

  const handleSearch = () => {
    fetchBills({
      page: 1,
      keyword: keyword || undefined,
      categoryId: categoryFilter,
      dateFrom: dateRange?.[0],
      dateTo: dateRange?.[1],
    })
  }

  const handleCategoryChange = async (billId: number, categoryId: number) => {
    try {
      await updateBillCategory(billId, categoryId)
      message.success('分类已更新')
    } catch {
      message.error('更新失败')
    }
  }

  const handleDelete = async () => {
    if (selectedRowKeys.length === 0) return
    try {
      await deleteBills(selectedRowKeys)
      setSelectedRowKeys([])
      message.success(`已删除 ${selectedRowKeys.length} 条记录`)
    } catch {
      message.error('删除失败')
    }
  }

  const columns: ColumnsType<Bill> = [
    {
      title: '日期',
      dataIndex: 'date',
      width: 110,
      sorter: (a, b) => a.date.localeCompare(b.date),
      render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 100,
      align: 'right',
      sorter: (a, b) => a.amount - b.amount,
      render: (v: number, r: Bill) => (
        <span
          className="amount-num"
          style={{ color: r.is_expense ? '#E03131' : '#2F9E44', fontWeight: 500 }}
        >
          {r.is_expense ? '-' : '+'}¥{v.toFixed(2)}
        </span>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category_name',
      width: 120,
      render: (name: string, record: Bill) => (
        <Dropdown
          menu={{
            items: categories.map((c: Category) => ({
              key: String(c.id),
              label: c.name,
              style: { color: c.color },
            })),
            onClick: ({ key }) => {
              const catId = parseInt(key)
              if (catId !== record.category_id) {
                handleCategoryChange(record.id, catId)
              }
            },
          }}
          trigger={['click']}
        >
          <span
            style={{
              cursor: 'pointer',
              color: record.category_color || '#666',
              borderBottom: `2px dotted ${record.category_color || '#ccc'}`,
              paddingBottom: 2,
            }}
          >
            {name || '其它'}
          </span>
        </Dropdown>
      ),
    },
    {
      title: '交易对方',
      dataIndex: 'counterparty',
      width: 160,
      ellipsis: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 80,
      render: (v: string) => {
        const map: Record<string, string> = { wechat: '微信', alipay: '支付宝', csv: 'CSV', manual: '手动' }
        return map[v] || v
      },
    },
  ]

  if (!isLoading && total === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 120 }}>
        <Empty description="还没有账单数据">
          <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => navigate('/import')}>
            导入账单
          </Button>
        </Empty>
      </div>
    )
  }

  return (
    <Card
      title={
        <Space>
          <span>账单列表</span>
          {urlCategoryName && <Tag color="blue">{urlCategoryName}</Tag>}
        </Space>
      }
      extra={
        <Space wrap>
          <Input
            placeholder="搜索描述/对方"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder="分类筛选"
            value={categoryFilter}
            onChange={v => { setCategoryFilter(v); fetchBills({ page: 1, categoryId: v }) }}
            allowClear
            style={{ width: 120 }}
            options={categories.map(c => ({ label: c.name, value: c.id }))}
          />
          <RangePicker
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')])
              } else {
                setDateRange(null)
              }
            }}
            style={{ width: 240 }}
          />
          {selectedRowKeys.length > 0 && (
            <Button danger onClick={handleDelete}>删除选中 ({selectedRowKeys.length})</Button>
          )}
          <Popconfirm title="确定清空当前账本全部账单？" onConfirm={async () => { await clearBills(); message.success('已清空'); fetchBills({ page: 1, pageSize: 50 }) }} okText="确定" cancelText="取消">
            <Button icon={<ClearOutlined />} danger>一键清除</Button>
          </Popconfirm>
        </Space>
      }
    >
      <Table
        rowKey="id"
        columns={columns}
        dataSource={bills}
        loading={isLoading}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as number[]),
        }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => fetchBills({ page: p, pageSize: ps }),
        }}
        size="middle"
      />
    </Card>
  )
}
