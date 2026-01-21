import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Layout, Menu, Input, Button, Avatar, Dropdown, Space, Badge, theme } from 'antd'
import { 
  UserOutlined, 
  LogoutOutlined, 
  PlusOutlined, 
  SearchOutlined,
  CommentOutlined,
  TeamOutlined,
  ReadOutlined,
  BellOutlined
} from '@ant-design/icons'
import { fetchUnreadCount } from '../api/notifications'
import { useAuth } from '../context/useAuth'
import type { MenuProps } from 'antd'

const { Header } = Layout

const SiteHeader = () => {
  const { user, logout, token: authToken } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { token } = theme.useToken()
  
  const [unreadCount, setUnreadCount] = useState(0)

  const current = useMemo(() => {
    if (location.pathname === '/') return '/'
    if (location.pathname.startsWith('/chat')) return '/chat'
    if (location.pathname.startsWith('/resources')) return '/resources'
    return ''
  }, [location.pathname])

  const searchDefaultValue = useMemo(() => {
    if (location.pathname !== '/search') {
      return ''
    }
    return searchParams.get('q') || ''
  }, [location.pathname, searchParams])

  const searchKey = useMemo(() => {
    if (location.pathname !== '/search') {
      return 'search'
    }
    return `search:${searchDefaultValue}`
  }, [location.pathname, searchDefaultValue])

  // Fetch unread notification count
  useEffect(() => {
    if (!authToken) {
      return
    }

    let active = true

    const loadUnreadCount = async () => {
      try {
        const data = await fetchUnreadCount()
        if (active) {
          setUnreadCount(data.count || 0)
        }
      } catch (err) {
        console.error('Failed to fetch unread count:', err)
      }
    }

    void loadUnreadCount()
    // Poll every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [authToken])

  const displayUnreadCount = authToken ? unreadCount : 0

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const handleSearch = (value: string) => {
    const trimmed = value.trim()
    if (trimmed) {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`)
    }
  }

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    navigate(e.key)
  }

  const menuItems: MenuProps['items'] = [
    {
      label: '社区',
      key: '/',
      icon: <CommentOutlined />,
    },
    {
      label: '聊天室',
      key: '/chat',
      icon: <TeamOutlined />,
    },
    {
      label: '资源互助',
      key: '/resources',
      icon: <ReadOutlined />,
    },
  ]

  const userMenu: MenuProps['items'] = [
    {
      key: 'profile',
      label: (
        <Link to={`/u/${user?.id}`}>个人主页</Link>
      ),
      icon: <UserOutlined />,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      onClick: handleLogout,
      danger: true,
    },
  ]

  return (
    <Header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        background: 'rgba(249, 245, 238, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
      }}
    >
      {/* Logo Area */}
      <div style={{ marginRight: 48, display: 'flex', alignItems: 'center' }}>
        <Link 
          to="/" 
          style={{ 
            fontSize: '1.5rem', 
            fontFamily: "'ZCOOL XiaoWei', serif", 
            fontWeight: 'bold',
            color: token.colorText,
            lineHeight: 1,
            letterSpacing: '0.04em'
          }}
        >
          Campus Hub
        </Link>
      </div>

      {/* Main Navigation */}
      <Menu
        mode="horizontal"
        selectedKeys={[current]}
        onClick={handleMenuClick}
        items={menuItems}
        style={{ 
          flex: 1, 
          background: 'transparent',
          borderBottom: 'none',
          fontSize: '1rem',
          fontWeight: 500
        }}
      />

      {/* Right Side: Search & Actions */}
      <Space size="middle">
          <Input.Search
            placeholder="搜索帖子或用户"
            prefix={<SearchOutlined style={{ color: token.colorTextDescription }} />}
            style={{ 
              width: 240, 
              borderRadius: 999, 
              background: 'rgba(255,255,255,0.6)' 
            }}
            variant="filled"
            key={searchKey}
            defaultValue={searchDefaultValue}
            onSearch={handleSearch}
            enterButton={false}
            allowClear
          />

        {user ? (
          <>
            <Badge count={displayUnreadCount} size="small" offset={[-2, 2]}>
              <Button 
                type="text" 
                shape="circle"
                icon={<BellOutlined style={{ fontSize: 18 }} />}
                onClick={() => navigate('/notifications')}
              />
            </Badge>
            <Button 
              type="primary" 
              shape="round" 
              icon={<PlusOutlined />}
              onClick={() => navigate('/submit')}
            >
              发帖
            </Button>
            <Dropdown menu={{ items: userMenu }} placement="bottomRight" arrow>
              <Space style={{ cursor: 'pointer', marginLeft: 8 }}>
                <Avatar 
                  src={user.avatar}
                  style={{ backgroundColor: token.colorPrimary }} 
                  icon={<UserOutlined />} 
                >
                  {user.nickname?.[0]?.toUpperCase()}
                </Avatar>
                <span style={{ fontWeight: 500, color: token.colorText }}>
                  {user.nickname}
                </span>
              </Space>
            </Dropdown>
          </>
        ) : (
          <Space>
             <Button type="text" onClick={() => navigate('/login')}>
              登录
            </Button>
            <Button type="primary" shape="round" disabled>
              发帖
            </Button>
          </Space>
        )}
      </Space>
    </Header>
  )
}

export default SiteHeader
