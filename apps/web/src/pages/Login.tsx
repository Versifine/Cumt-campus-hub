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
import { login, register, resendVerification } from '../api/auth'
import { ApiError, getErrorMessage } from '../api/client'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/useAuth'
import { consumeAuthMessage, setAuth } from '../store/auth'

const { Content } = Layout
const { Title, Paragraph, Text } = Typography

type AuthMode = 'login' | 'register'

const Login = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, setUser } = useAuth()
  const [activeTab, setActiveTab] = useState<AuthMode>('login')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [showResend, setShowResend] = useState(false)
  const [registrationComplete, setRegistrationComplete] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [form] = Form.useForm()

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

  useEffect(() => {
    if (resendCooldown <= 0) {
      return
    }
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [resendCooldown])

  const onFinish = async (values: any) => {
    setError(null)
    setNotice(null)
    setShowResend(false)
    setLoading(true)

    try {
      const { email, password, confirmPassword, nickname } = values
      const trimmedEmail = email.trim()

      if (activeTab === 'register') {
        const trimmedNickname = (nickname ?? '').trim()
        await register(trimmedEmail, password, confirmPassword, trimmedNickname)
        setNotice('注册成功，请查收邮箱完成验证')
        setRegistrationComplete(true)
        setRegisteredEmail(trimmedEmail)
        setShowResend(false)
        setResendCooldown(60)
        form.resetFields()
        return
      }

      const payload = await login(trimmedEmail, password)
      setAuth(payload.token, payload.user)
      setUser(payload.user)
      navigate(from, { replace: true })
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.code === 1008 && activeTab === 'login') {
        setShowResend(true)
      }
      setError(getErrorMessage(submitError))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async (emailOverride?: string) => {
    if (resendCooldown > 0) {
      return
    }
    setError(null)
    setNotice(null)
    setResendLoading(true)
    try {
      let email = emailOverride?.trim()
      if (!email) {
        const values = await form.validateFields(['email'])
        email = values.email?.trim()
      }
      if (!email) {
        return
      }
      await resendVerification(email)
      setNotice('验证邮件已发送，请查收邮箱')
      setShowResend(false)
      setResendCooldown(60)
    } catch (submitError) {
      if (submitError && typeof submitError === 'object' && 'errorFields' in submitError) {
        return
      }
      setError(getErrorMessage(submitError))
    } finally {
      setResendLoading(false)
    }
  }

  const handleBackToLogin = () => {
    setRegistrationComplete(false)
    setActiveTab('login')
    setShowResend(false)
    setError(null)
    setNotice(null)
    if (registeredEmail) {
      form.setFieldsValue({ email: registeredEmail })
    }
  }

  const resendButtonText = resendCooldown > 0
    ? `重新发送验证邮件 (${resendCooldown}s)`
    : '重新发送验证邮件'

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

  const passwordRules = [
    { required: true, message: '请输入密码!' },
    ...(activeTab === 'register'
      ? [
          {
            validator: (_: any, value: string) => {
              if (!value) {
                return Promise.resolve()
              }
              if (value.trim() !== value) {
                return Promise.reject(new Error('密码不能包含首尾空格'))
              }
              if (value.length < 8) {
                return Promise.reject(new Error('密码至少 8 位'))
              }
              if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
                return Promise.reject(new Error('密码需包含字母和数字'))
              }
              return Promise.resolve()
            },
          },
        ]
      : []),
  ]

  const FormContent = () => (
    <Form
      name="auth-form"
      initialValues={{ remember: true }}
      onFinish={onFinish}
      form={form}
      layout="vertical"
      size="large"
    >
      <Form.Item
        name="email"
        rules={[
          { required: true, message: '请输入邮箱!' },
          { type: 'email', message: '请输入有效邮箱!' },
        ]}
      >
        <Input 
          prefix={<UserOutlined className="site-form-item-icon" />} 
          placeholder="邮箱" 
          type="email"
        />
      </Form.Item>
      {activeTab === 'register' && (
        <Form.Item
          name="nickname"
          rules={[
            { required: true, whitespace: true, message: '请输入用户名!' },
            { max: 32, message: '用户名最多 32 个字符' },
          ]}
        >
          <Input
            prefix={<UserOutlined className="site-form-item-icon" />}
            placeholder="用户名"
          />
        </Form.Item>
      )}
      <Form.Item
        name="password"
        rules={passwordRules}
      >
        <Input.Password
          prefix={<LockOutlined className="site-form-item-icon" />}
          type="password"
          placeholder="密码"
        />
      </Form.Item>
      {activeTab === 'register' && (
        <Form.Item
          name="confirmPassword"
          dependencies={['password']}
          rules={[
            { required: true, message: '请再次输入密码!' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error('两次输入的密码不一致'))
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined className="site-form-item-icon" />}
            type="password"
            placeholder="确认密码"
          />
        </Form.Item>
      )}

      <div style={{ marginBottom: 24 }}>
        {notice && <Alert message={notice} type="info" showIcon closable onClose={() => setNotice(null)} style={{ marginBottom: 12 }} />}
        {error && <Alert message={error} type="error" showIcon closable onClose={() => setError(null)} />}
        {showResend && (
          <Button
            type="link"
            block
            onClick={() => handleResend(registeredEmail)}
            loading={resendLoading}
            disabled={resendCooldown > 0}
            style={{ padding: 0, marginTop: 8 }}
          >
            {resendButtonText}
          </Button>
        )}
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
            onChange={(key) => {
              setActiveTab(key as AuthMode)
              setShowResend(false)
              setRegistrationComplete(false)
            }}
            items={tabItems}
            centered
            style={{ marginBottom: 24 }}
          />
          {registrationComplete ? (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Title level={3} style={{ marginBottom: 8 }}>验证邮箱</Title>
                <Paragraph type="secondary">
                  我们已发送验证邮件到 <Text strong>{registeredEmail}</Text>。
                </Paragraph>
              </div>
              {notice && <Alert message={notice} type="info" showIcon closable onClose={() => setNotice(null)} />}
              {error && <Alert message={error} type="error" showIcon closable onClose={() => setError(null)} />}
              <Button
                type="primary"
                block
                onClick={() => handleResend(registeredEmail)}
                loading={resendLoading}
                disabled={resendCooldown > 0}
              >
                {resendButtonText}
              </Button>
              <Button type="text" block onClick={handleBackToLogin}>
                返回登录
              </Button>
            </Space>
          ) : (
            <FormContent />
          )}
        </Card>
      </Content>
    </Layout>
  )
}

export default Login
