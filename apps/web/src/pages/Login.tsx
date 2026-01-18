import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { 
  Layout, 
  Card, 
  Tabs, 
  Form, 
  Input, 
  Button, 
  Alert, 
  Typography,
  Space 
} from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { login, register } from '../api/auth'
import { getErrorMessage } from '../api/client'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { consumeAuthMessage, setAuth } from '../store/auth'

const { Content } = Layout

type AuthMode = 'login' | 'register'

const Login = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, setUser } = useAuth()
  const [activeTab, setActiveTab] = useState<AuthMode>('login')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Determine redirect path
  const from = (location.state as { from?: string } | null | undefined)?.from ?? '/'

  useEffect(() => {
    const message = consumeAuthMessage()
    if (message) {
      setNotice(message)
    }
  }, [])

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true })
    }
  }, [user, navigate, from])

  const onFinish = async (values: any) => {
    setError(null)
    setNotice(null)
    setLoading(true)

    try {
      const { username, password } = values
      const payload = activeTab === 'login'
        ? await login(username.trim(), password)
        : await register(username.trim(), password)

      setAuth(payload.token, payload.user)
      setUser(payload.user)
      navigate(from, { replace: true })
    } catch (submitError) {
      setError(getErrorMessage(submitError))
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    if (location.state && from !== '/') {
      navigate(from, { replace: true })
      return
    }
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/')
  }

  const tabItems = [
    { label: '登录', key: 'login' },
    { label: '注册', key: 'register' },
  ]

  const FormContent = () => (
    <Form
      name="auth-form"
      initialValues={{ remember: true }}
      onFinish={onFinish}
      layout="vertical"
      size="large"
    >
      <Form.Item
        name="username"
        rules={[{ required: true, message: '请输入账号!' }]}
      >
        <Input 
          prefix={<UserOutlined className="site-form-item-icon" />} 
          placeholder="账号" 
        />
      </Form.Item>
      <Form.Item
        name="password"
        rules={[{ required: true, message: '请输入密码!' }]}
      >
        <Input.Password
          prefix={<LockOutlined className="site-form-item-icon" />}
          type="password"
          placeholder="密码"
        />
      </Form.Item>

      <div style={{ marginBottom: 24 }}>
        {notice && <Alert message={notice} type="info" showIcon closable onClose={() => setNotice(null)} style={{ marginBottom: 12 }} />}
        {error && <Alert message={error} type="error" showIcon closable onClose={() => setError(null)} />}
      </div>

      <Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading}>
          {activeTab === 'login' ? '登录' : '注册'}
        </Button>
      </Form.Item>
      
      <Button type="text" block onClick={handleCancel}>
        取消 / 返回
      </Button>
    </Form>
  )

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <SiteHeader />
      <Content style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'flex-start', 
        paddingTop: 80,
        paddingBottom: 40
      }}>
        <Card 
          style={{ width: 420, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', borderRadius: 16 }}
          bordered={false}
        >
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as AuthMode)}
            items={tabItems}
            centered
            style={{ marginBottom: 24 }}
          />
          <FormContent />
        </Card>
      </Content>
    </Layout>
  )
}

export default Login
