import { useEffect, useState } from 'react'
import { Card, Tabs, Row, Col, Table, Button, Modal, Form, Select, Input, Switch, message, Popconfirm, Tag, Dropdown, Empty, Space } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { useLedgerStore } from '@/store/useLedgerStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useBillStore } from '@/store/useBillStore'
import type { Category, ClassifyRule, Bill } from '@/types/bill'

const { TextArea } = Input

export default function Categories() {
  const navigate = useNavigate()
  const { categories, rules, fetchCategories, fetchRules, addRule, updateRule, deleteRule } = useCategoryStore()
  const { bills, total, fetchBills, updateBillCategory } = useBillStore()
  const [activeTab, setActiveTab] = useState('overview')
  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<ClassifyRule | null>(null)
  const [form] = Form.useForm()

  const { activeLedger } = useLedgerStore()
  useEffect(() => {
    const lid = activeLedger?.id || 1
    fetchCategories(lid)
    fetchRules(lid)
    fetchBills({ page: 1, pageSize: 100, ledgerId: lid })
  }, [activeLedger?.id])

  // 如果当前账本没有规则，自动生成默认规则
  const handleSeedRules = async () => {
    const lid = activeLedger?.id || 1
    try {
      const result = await window.electronAPI.seedDefaultRules(lid)
      message.success(result.message)
      fetchRules(lid)
    } catch (err: any) {
      message.error('生成失败：' + (err.message || '未知错误'))
    }
  }

  // ===== 规则编辑 Modal =====
  const openRuleModal = (rule?: ClassifyRule) => {
    if (rule) {
      setEditingRule(rule)
      form.setFieldsValue({
        category_id: rule.category_id,
        keywords: typeof rule.keywords === 'string'
          ? JSON.parse(rule.keywords).join('\n')
          : (rule.keywords as any).join('\n'),
        enabled: rule.enabled === 1,
      })
    } else {
      setEditingRule(null)
      form.resetFields()
      form.setFieldsValue({ enabled: true, keywords: '' })
    }
    setRuleModalOpen(true)
  }

  const handleRuleSave = async () => {
    const values = await form.validateFields()
    const keywordsArray = values.keywords
      .split(/[\n,，]/)
      .map((s: string) => s.trim())
      .filter(Boolean)

    if (editingRule) {
      await updateRule(editingRule.id, {
        category_id: values.category_id,
        keywords: keywordsArray as any,
        enabled: values.enabled ? 1 : 0,
      })
      message.success('规则已更新')
    } else {
      await addRule({
        category_id: values.category_id,
        field: 'both',
        keywords: keywordsArray as any,
        enabled: values.enabled ? 1 : 0,
      })
      message.success('规则已添加')
    }
    setRuleModalOpen(false)
    // 刷新"其它"列表
    fetchBills({ categoryId: 6, page: 1, pageSize: 100 })
  }

  // ===== 账单表格列 =====
  const billColumns: ColumnsType<Bill> = [
    { title: '日期', dataIndex: 'date', width: 110 },
    {
      title: '金额', dataIndex: 'amount', width: 100, align: 'right',
      render: (v: number, r: Bill) => (
        <span className="amount-num" style={{ color: '#E03131', fontWeight: 500 }}>
          ¥{v.toFixed(2)}
        </span>
      ),
    },
    { title: '交易对方', dataIndex: 'counterparty', width: 160, ellipsis: true },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    {
      title: '操作', width: 120,
      render: (_: any, record: Bill) => (
        <Dropdown menu={{
          items: categories.filter(c => c.id !== 6).map(c => ({
            key: String(c.id),
            label: c.name,
          })),
          onClick: async ({ key }) => {
            await updateBillCategory(record.id, parseInt(key))
            message.success('已重新分类')
          },
        }}>
          <Button size="small" type="link">重新分类</Button>
        </Dropdown>
      ),
    },
  ]

  const ruleColumns: ColumnsType<ClassifyRule> = [
    {
      title: '分类', dataIndex: 'category_id', width: 100,
      render: (v: number) => {
        const cat = categories.find(c => c.id === v)
        return <Tag color={cat?.color}>{cat?.name}</Tag>
      },
    },
    {
      title: '关键词', dataIndex: 'keywords', ellipsis: true,
      render: (v: string) => {
        try { return JSON.parse(v).join(', ') } catch { return v }
      },
    },
    {
      title: '启用', dataIndex: 'enabled', width: 60,
      render: (v: number, record: ClassifyRule) => (
        <Switch
          checked={v === 1}
          size="small"
          onChange={async (checked) => {
            await updateRule(record.id, { enabled: checked ? 1 : 0 })
          }}
        />
      ),
    },
    {
      title: '操作', width: 100,
      render: (_: any, record: ClassifyRule) => (
        <Space>
          <Button size="small" type="link" icon={<EditOutlined />}
            onClick={() => openRuleModal(record)} />
          <Popconfirm title="确定删除此规则？" onConfirm={() => deleteRule(record.id)}>
            <Button size="small" type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // 其它分类的记录
  const otherBills = bills.filter(b => b.category_id === 6)

  const tabItems = [
    {
      key: 'overview',
      label: '分类总览',
      children: (
        <Row gutter={[16, 16]}>
          {categories.map(cat => {
            const catBills = bills.filter(b => b.category_id === cat.id)
            const totalAmount = catBills.reduce((sum, b) => sum + b.amount, 0)
            return (
              <Col span={8} key={cat.id}>
                <Card
                  size="small"
                  style={{ borderLeft: `4px solid ${cat.color}`, cursor: 'pointer' }}
                  hoverable
                  onClick={() => navigate(`/bills?categoryId=${cat.id}&categoryName=${encodeURIComponent(cat.name)}`)}
                >
                  <div style={{ fontSize: 14, color: 'var(--color-ink-secondary)', marginBottom: 8 }}>
                    {cat.name}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: cat.color }}>
                    ¥{totalAmount.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-ink-muted)', marginTop: 4 }}>
                    {catBills.length} 笔交易
                  </div>
                </Card>
              </Col>
            )
          })}
        </Row>
      ),
    },
    {
      key: 'others',
      label: `其它记录 (${otherBills.length})`,
      children: otherBills.length === 0 ? (
        <Empty description="暂无'其它'分类的记录" />
      ) : (
        <Table rowKey="id" columns={billColumns} dataSource={otherBills}
          size="small" pagination={{ pageSize: 30 }} />
      ),
    },
    {
      key: 'rules',
      label: '自动规则',
      children: (
        <>
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openRuleModal()}>
                添加规则
              </Button>
              {rules.length === 0 && (
                <Button onClick={handleSeedRules}>
                  生成默认规则
                </Button>
              )}
            </Space>
          </div>
          {rules.length === 0 ? (
            <Empty description="还没有分类规则，点击上方按钮生成默认规则">
              <Button type="primary" onClick={handleSeedRules}>生成默认规则</Button>
            </Empty>
          ) : (
            <Table rowKey="id" columns={ruleColumns} dataSource={rules}
              size="small" pagination={false} />
          )}
        </>
      ),
    },
  ]

  return (
    <>
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>

      {/* 规则编辑 Modal */}
      <Modal
        title={editingRule ? '编辑规则' : '添加规则'}
        open={ruleModalOpen}
        onOk={handleRuleSave}
        onCancel={() => setRuleModalOpen(false)}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="category_id" label="目标分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select
              options={categories.map(c => ({ label: c.name, value: c.id }))}
              placeholder="选择分类"
            />
          </Form.Item>
          <Form.Item name="keywords" label="关键词" rules={[{ required: true, message: '请输入关键词' }]}
            extra="每行一个关键词，或用逗号分隔。匹配交易描述或对方名称。">
            <TextArea rows={6} placeholder={'例如：\n王者荣耀\nSteam\n原神\n米哈游'} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
