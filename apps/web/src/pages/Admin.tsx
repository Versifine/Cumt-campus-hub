import { useCallback, useEffect, useState } from 'react'
import { 
  Layout, 
  Table, 
  Tag, 
  Button, 
  Space, 
  Typography, 
  Card, 
  message, 
  Select, 
  Modal, 
  Input 
} from 'antd'
import { Link } from 'react-router-dom'
import { fetchReports, updateReport, type ReportItem } from '../api/reports'
import { getErrorMessage } from '../api/client'
import SiteHeader from '../components/SiteHeader'
import { formatRelativeTimeUTC8 } from '../utils/time'

const { Content } = Layout
const { Title, Text } = Typography

const Admin = () => {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReportItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState<string>('open')

  // Action Modal State
  const [actionModal, setActionModal] = useState<{
    visible: boolean
    report: ReportItem | null
    status: 'resolved' | 'ignored'
  }>({
    visible: false,
    report: null,
    status: 'resolved',
  })
  const [actionNote, setActionNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchReports(page, 20, filterStatus === 'all' ? undefined : filterStatus)
      setData(res.items)
      setTotal(res.total)
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [page, filterStatus])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleOpenAction = (report: ReportItem, status: 'resolved' | 'ignored') => {
    setActionModal({
      visible: true,
      report,
      status,
    })
    setActionNote('')
  }

  const handleSubmitAction = async () => {
    if (!actionModal.report) return
    setSubmitting(true)
    try {
      await updateReport(actionModal.report.id, {
        status: actionModal.status,
        note: actionNote,
        action: actionModal.status === 'resolved' ? 'manual_resolve' : 'ignore',
      })
      message.success('操作成功')
      setActionModal(prev => ({ ...prev, visible: false }))
      loadData()
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    {
      title: 'Type',
      dataIndex: 'target_type',
      key: 'target_type',
      width: 100,
      render: (type: string) => <Tag color={type === 'post' ? 'blue' : 'cyan'}>{type.toUpperCase()}</Tag>
    },
    {
      title: 'Target ID',
      dataIndex: 'target_id',
      key: 'target_id',
      width: 150,
      render: (id: string, record: ReportItem) => {
        return record.target_type === 'post' ? (
           <Link to={`/post/${id}`} target="_blank">{id}</Link>
        ) : (
           <Text code>{id}</Text>
        )
      }
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      width: 150,
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: 'Detail',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
    },
    {
      title: 'Reporter',
      dataIndex: 'reporter_id',
      key: 'reporter_id',
      width: 120,
      render: (id: string) => <Link to={`/u/${id}`}>{id}</Link>
    },
    {
      title: 'Time',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (t: string) => formatRelativeTimeUTC8(t)
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const color = status === 'open' ? 'gold' : status === 'resolved' ? 'green' : 'default'
        return <Tag color={color}>{status.toUpperCase()}</Tag>
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: ReportItem) => (
        record.status === 'open' ? (
          <Space>
            <Button 
              size="small" 
              type="primary" 
              onClick={() => handleOpenAction(record, 'resolved')}
            >
              Resolve
            </Button>
            <Button 
              size="small" 
              onClick={() => handleOpenAction(record, 'ignored')}
            >
              Ignore
            </Button>
          </Space>
        ) : (
          <Text type="secondary">{record.note || '-'}</Text>
        )
      )
    }
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <SiteHeader />
      <Content style={{ maxWidth: 1200, margin: '24px auto', width: '100%', padding: '0 24px' }}>
        <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
            <Title level={3} style={{ margin: 0 }}>Report Management</Title>
            <Select 
              value={filterStatus} 
              onChange={setFilterStatus} 
              style={{ width: 120 }}
              options={[
                { value: 'open', label: 'Open' },
                { value: 'resolved', label: 'Resolved' },
                { value: 'ignored', label: 'Ignored' },
                { value: 'all', label: 'All' },
              ]}
            />
          </div>

          <Table 
            columns={columns} 
            dataSource={data} 
            rowKey="id"
            loading={loading}
            pagination={{
              current: page,
              pageSize: 20,
              total: total,
              onChange: setPage,
            }}
          />
        </Card>

        <Modal
          title={actionModal.status === 'resolved' ? 'Mark as Resolved' : 'Mark as Ignored'}
          open={actionModal.visible}
          onOk={handleSubmitAction}
          onCancel={() => setActionModal(prev => ({ ...prev, visible: false }))}
          confirmLoading={submitting}
        >
          <div style={{ marginBottom: 16 }}>
            <Text>Target: {actionModal.report?.target_type} {actionModal.report?.target_id}</Text>
            <br/>
            <Text type="secondary">Reason: {actionModal.report?.reason}</Text>
          </div>
          <Input.TextArea 
            rows={3} 
            placeholder="Add a processing note (optional)..."
            value={actionNote}
            onChange={e => setActionNote(e.target.value)}
          />
        </Modal>
      </Content>
    </Layout>
  )
}

export default Admin
