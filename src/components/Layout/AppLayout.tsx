import { useState, useEffect } from 'react'
import { Layout, Menu, Select, Button, Modal, Input, message, Popconfirm, Badge, List, Space } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { DashboardOutlined, FileTextOutlined, ImportOutlined, AppstoreOutlined, MenuFoldOutlined, MenuUnfoldOutlined, PlusOutlined, DeleteOutlined, UndoOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useLedgerStore } from '@/store/useLedgerStore'

const { Sider, Content } = Layout
const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '数据概览' },
  { key: '/bills', icon: <FileTextOutlined />, label: '账单列表' },
  { key: '/import', icon: <ImportOutlined />, label: '导入账单' },
  { key: '/categories', icon: <AppstoreOutlined />, label: '分类管理' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate(); const location = useLocation()
  const [collapsed, setCollapsed] = useState(false); const [modalOpen, setModalOpen] = useState(false); const [newName, setNewName] = useState('')
  const [trashOpen, setTrashOpen] = useState(false)
  const { ledgers, activeLedger, deletedLedgers, fetchLedgers, fetchDeletedLedgers, setActiveLedger, createLedger, deleteLedger, restoreLedger, permanentlyDeleteLedger } = useLedgerStore()

  useEffect(() => { fetchLedgers(); fetchDeletedLedgers() }, [])

  const handleAdd = async () => {
    if (!newName.trim()) return
    const id = await createLedger(newName.trim())
    await setActiveLedger(id); setNewName(''); setModalOpen(false)
    message.success(`「${newName.trim()}」已创建`)
    navigate('/')
  }

  const handleSwitch = async (id: number) => {
    await setActiveLedger(id)
    navigate('/')
  }

  const handleDelete = async (id: number, name: string) => {
    const ok = await deleteLedger(id)
    if (ok) message.success(`「${name}」已移入回收站（30天内可恢复）`)
  }

  const handleRestore = async (id: number, name: string) => {
    const ok = await restoreLedger(id)
    if (ok) {
      message.success(`「${name}」已恢复`)
      if (deletedLedgers.length <= 1) setTrashOpen(false)
    } else {
      message.error('已超过30天，无法恢复')
    }
  }

  const handlePermanentDelete = async (id: number, name: string) => {
    await permanentlyDeleteLedger(id)
    message.success(`「${name}」已永久删除`)
    if (deletedLedgers.length <= 1) setTrashOpen(false)
  }

  const daysLeft = (deletedAt: string) => {
    const remaining = 30 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / (86400 * 1000))
    return Math.max(0, remaining)
  }

  return (
    <Layout style={{ height: '100%' }}>
      <Sider collapsible collapsed={collapsed} trigger={null} width={210}
        style={{ background: 'var(--color-brand)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h1 style={{ color: '#fff', fontSize: collapsed ? 18 : 20, fontWeight: 700, margin: 0, letterSpacing: 2 }}>
            {collapsed ? '轻记' : '轻松记账'}
          </h1>
        </div>
        {!collapsed && (
          <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <Select value={activeLedger?.id} onChange={handleSwitch} size="small"
              style={{ width: '100%' }}
              options={ledgers.map(l => ({ label: l.name, value: l.id }))}
              dropdownRender={(menu) => (
                <>{menu}
                  <div style={{ borderTop: '1px solid #f0f0f0', padding: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建账本</Button>
                    <Button type="text" size="small" icon={<DeleteOutlined />} style={{ color: '#999' }}
                      onClick={() => setTrashOpen(true)}>回收站</Button>
                  </div>
                </>
              )}
              optionRender={(option) => (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{option.label}</span>
                  {option.value !== 1 && (
                    <Popconfirm
                      title="确定删除此账本？"
                      description="数据将保留30天，期间可恢复"
                      onConfirm={(e) => { e?.stopPropagation(); handleDelete(option.value as number, option.label as string) }}
                      onCancel={(e) => e?.stopPropagation()}
                      okText="删除"
                      cancelText="取消"
                      placement="right"
                    >
                      <DeleteOutlined
                        style={{ color: '#ccc', fontSize: 12 }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Popconfirm>
                  )}
                </div>
              )}
            />
          </div>
        )}
        <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={menuItems}
          onClick={({ key }) => navigate(key)} style={{ background: 'transparent', borderRight: 'none', marginTop: 8, flex: 1 }} />
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {!collapsed && (
            <Badge count={deletedLedgers.length} size="small" offset={[-2, 2]}>
              <Button type="text" icon={<DeleteOutlined />}
                style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}
                onClick={() => setTrashOpen(true)}
              />
            </Badge>
          )}
          <div onClick={() => setCollapsed(!collapsed)}
            style={{ textAlign: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 18, padding: '8px 0', flex: 1 }}>
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>
        </div>
      </Sider>
      <Layout>
        <Content style={{ padding: 24, overflow: 'auto', background: 'var(--color-page)', height: '100%' }}>{children}</Content>
      </Layout>
      <Modal title="新建账本" open={modalOpen} onOk={handleAdd} onCancel={() => setModalOpen(false)}>
        <Input placeholder="输入账本名称" value={newName} onChange={e => setNewName(e.target.value)} onPressEnter={handleAdd} />
      </Modal>

      {/* 回收站 Modal */}
      <Modal
        title="回收站（30天内可恢复）"
        open={trashOpen}
        onCancel={() => setTrashOpen(false)}
        footer={<Button onClick={() => setTrashOpen(false)}>关闭</Button>}
        width={480}
      >
        {deletedLedgers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-ink-muted)' }}>回收站为空</div>
        ) : (
          <List
            dataSource={deletedLedgers}
            renderItem={(l) => (
              <List.Item
                actions={[
                  <Button key="restore" type="link" icon={<UndoOutlined />}
                    onClick={() => handleRestore(l.id, l.name)}>恢复</Button>,
                  <Popconfirm
                    key="perm"
                    title="永久删除后将无法恢复，确定？"
                    icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
                    onConfirm={() => handlePermanentDelete(l.id, l.name)}
                    okText="永久删除"
                    okButtonProps={{ danger: true }}
                    cancelText="取消"
                  >
                    <Button type="link" danger icon={<DeleteOutlined />}>永久删除</Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={l.name}
                  description={`删除于 ${l.deleted_at?.slice(0, 10)} · 剩余 ${daysLeft(l.deleted_at || '')} 天`}
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </Layout>
  )
}
