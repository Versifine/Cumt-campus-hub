import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, Layout, Space, Typography } from 'antd'
import SiteHeader from '../components/SiteHeader'
import { verifyEmail } from '../api/auth'
import { getErrorMessage } from '../api/client'

const { Content } = Layout
const { Title, Paragraph } = Typography

type VerifyStatus = 'pending' | 'success' | 'error' | 'missing'

const VerifyEmail = () => {
  const [status, setStatus] = useState<VerifyStatus>('pending')
  const [message, setMessage] = useState('')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''

  useEffect(() => {
    if (!token) {
      setStatus('missing')
      setMessage('缺少验证令牌')
      return
    }

    let cancelled = false

    const run = async () => {
      try {
        await verifyEmail(token)
        if (cancelled) {
          return
        }
        setStatus('success')
        setMessage('邮箱验证成功')
      } catch (submitError) {
        if (cancelled) {
          return
        }
        setStatus('error')
        setMessage(getErrorMessage(submitError))
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [token])

  const statusAlert = () => {
    if (status === 'pending') {
      return <Alert message="正在验证邮箱..." type="info" showIcon />
    }
    if (status === 'success') {
      return <Alert message={message} type="success" showIcon />
    }
    return <Alert message={message || '邮箱验证失败'} type="error" showIcon />
  }

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <SiteHeader />
      <Content style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: 80,
        paddingBottom: 40,
      }}>
        <Card
          style={{ width: 420, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', borderRadius: 16 }}
          bordered={false}
        >
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Title level={3} style={{ marginBottom: 8 }}>邮箱验证</Title>
              <Paragraph type="secondary">完成验证后即可登录。</Paragraph>
            </div>
            {statusAlert()}
            <Button type="primary" block onClick={() => navigate('/login')}>
              返回登录
            </Button>
          </Space>
        </Card>
      </Content>
    </Layout>
  )
}

export default VerifyEmail
