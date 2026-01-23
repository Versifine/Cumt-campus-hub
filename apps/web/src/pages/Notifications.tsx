import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout, List, Card, Avatar, Typography, Button, Empty, Spin, Space, Tag, theme, message } from 'antd'
import { 
  UserOutlined, 
  CommentOutlined, 
  HeartOutlined, 
  UserAddOutlined,
  CheckOutlined
} from '@ant-design/icons'
import { getErrorMessage } from '../api/client'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, type NotificationItem } from '../api/notifications'
import LevelBadge from '../components/LevelBadge'
import SiteHeader from '../components/SiteHeader'
import { ErrorState } from '../components/StateBlocks'

const { Content } = Layout
const { Title, Text } = Typography

const typeConfig = {
  comment: { icon: <CommentOutlined />, label: '评论了你的帖子', color: 'blue' },
  reply: { icon: <CommentOutlined />, label: '回复了你的评论', color: 'cyan' },
  follow: { icon: <UserAddOutlined />, label: '关注了你', color: 'green' },
  like: { icon: <HeartOutlined />, label: '赞了你的内容', color: 'red' },
}

const pageSize = 20

const Notifications = () => {
  const { token } = theme.useToken()
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchNotifications(page, pageSize)
      setNotifications(data.data || [])
      setTotal(data.total)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id)
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      )
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead()
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (err) {
      message.error(getErrorMessage(err))
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
              <LevelBadge level={notif.actor_level} title={notif.actor_level_title} compact />
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
          ) : error ? (
            <ErrorState message={error} onRetry={loadNotifications} />
          ) : notifications.length > 0 ? (
            <List
              dataSource={notifications}
              renderItem={renderItem}
              pagination={total > pageSize ? {
                current: page,
                total: total,
                pageSize: pageSize,
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
