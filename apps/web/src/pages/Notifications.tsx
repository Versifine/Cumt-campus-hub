import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Layout, List, Card, Avatar, Typography, Button, Empty, Spin, Space, Tag, theme } from 'antd'
import { 
  UserOutlined, 
  CommentOutlined, 
  HeartOutlined, 
  UserAddOutlined,
  CheckOutlined
} from '@ant-design/icons'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { getToken } from '../store/auth'

const { Content } = Layout
const { Title, Text } = Typography

interface NotificationItem {
  id: string
  actor_id: string
  actor_name: string
  actor_avatar: string
  type: 'comment' | 'reply' | 'follow' | 'like'
  target_type: string
  target_id: string
  read: boolean
  created_at: string
}

interface NotificationsResponse {
  data: NotificationItem[]
  total: number
  page: number
  page_size: number
}

const typeConfig = {
  comment: { icon: <CommentOutlined />, label: '评论了你的帖子', color: 'blue' },
  reply: { icon: <CommentOutlined />, label: '回复了你的评论', color: 'cyan' },
  follow: { icon: <UserAddOutlined />, label: '关注了你', color: 'green' },
  like: { icon: <HeartOutlined />, label: '赞了你的内容', color: 'red' },
}

const Notifications = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const authToken = getToken()
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authToken) {
      navigate('/login')
      return
    }

    const fetchNotifications = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/v1/notifications?page=${page}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        })
        if (res.ok) {
          const data: NotificationsResponse = await res.json()
          setNotifications(data.data || [])
          setTotal(data.total)
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchNotifications()
  }, [authToken, page, navigate])

  const handleMarkRead = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/notifications/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authToken}` }
      })
      if (res.ok) {
        setNotifications(prev => 
          prev.map(n => n.id === id ? { ...n, read: true } : n)
        )
      }
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/v1/notifications/read-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` }
      })
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`
    
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  const getTargetLink = (notif: NotificationItem) => {
    if (notif.type === 'follow') {
      return `/u/${notif.actor_id}`
    }
    if (notif.target_type === 'post') {
      return `/post/${notif.target_id}`
    }
    if (notif.target_type === 'comment') {
      // For comments, we'd need the post ID - for now link to user profile
      return `/u/${notif.actor_id}`
    }
    return '#'
  }

  const renderItem = (notif: NotificationItem) => {
    const config = typeConfig[notif.type] || typeConfig.comment

    return (
      <List.Item 
        key={notif.id}
        style={{ 
          background: notif.read ? 'transparent' : 'rgba(22, 119, 255, 0.04)',
          borderRadius: 8,
          marginBottom: 8,
          padding: '12px 16px'
        }}
      >
        <List.Item.Meta
          avatar={
            <Link to={`/u/${notif.actor_id}`}>
              <Avatar 
                src={notif.actor_avatar} 
                icon={<UserOutlined />}
                style={{ backgroundColor: token.colorPrimary }}
              >
                {notif.actor_name?.[0]?.toUpperCase()}
              </Avatar>
            </Link>
          }
          title={
            <Space>
              <Link to={`/u/${notif.actor_id}`} style={{ fontWeight: 500 }}>
                {notif.actor_name || '用户'}
              </Link>
              <Tag color={config.color} icon={config.icon}>
                {config.label}
              </Tag>
            </Space>
          }
          description={
            <Space>
              <Text type="secondary">{formatDate(notif.created_at)}</Text>
              {notif.target_id && (
                <Link to={getTargetLink(notif)}>
                  <Button type="link" size="small" style={{ padding: 0 }}>
                    查看
                  </Button>
                </Link>
              )}
            </Space>
          }
        />
        {!notif.read && (
          <Button 
            type="text" 
            size="small" 
            icon={<CheckOutlined />}
            onClick={() => handleMarkRead(notif.id)}
          >
            标记已读
          </Button>
        )}
      </List.Item>
    )
  }

  if (!user) {
    return null
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#FAF8F5' }}>
      <SiteHeader />
      <Content style={{ padding: '24px 48px', maxWidth: 800, margin: '0 auto', width: '100%' }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={4} style={{ margin: 0 }}>通知</Title>
            {notifications.some(n => !n.read) && (
              <Button type="link" onClick={handleMarkAllRead}>
                全部标记为已读
              </Button>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Spin size="large" />
            </div>
          ) : notifications.length > 0 ? (
            <List
              dataSource={notifications}
              renderItem={renderItem}
              pagination={total > 20 ? {
                current: page,
                total: total,
                pageSize: 20,
                onChange: setPage,
                showSizeChanger: false,
              } : false}
            />
          ) : (
            <Empty description="暂无通知" style={{ padding: 48 }} />
          )}
        </Card>
      </Content>
    </Layout>
  )
}

export default Notifications
