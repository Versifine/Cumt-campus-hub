import { useCallback, useEffect, useRef, useState } from 'react'
import { 
  Layout, 
  Card, 
  List, 
  Input, 
  Button, 
  Badge, 
  Typography, 
  Alert, 
  Space,
  Avatar,
  theme
} from 'antd'
import { SendOutlined, UserOutlined, RobotOutlined, SyncOutlined } from '@ant-design/icons'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { getToken } from '../store/auth'
import { formatRelativeTimeUTC8 } from '../utils/time'

const { Content, Sider } = Layout
const { Text, Title } = Typography

type RoomOption = {
  id: string
  name: string
  description: string
}

type ChatMessage = {
  id: string
  content: string
  createdAt: string
  senderId?: string
  senderName?: string
  isHistory: boolean
}

type Envelope = {
  v: number
  type: string
  requestId?: string
  data?: any
  error?: { code: number; message: string }
}

const rooms: RoomOption[] = [
  { id: 'general', name: '综合讨论', description: '日常交流与校园动态' },
  { id: 'study-help', name: '课程互助', description: '作业难题、课程资料' },
  { id: 'resources', name: '资源共享', description: '复习资料、备考经验' },
]

const buildWsUrl = (token: string) => {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}/ws/chat?token=${encodeURIComponent(token)}`
}

const makeRequestId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

const Chat = () => {
  const { user } = useAuth()
  const { token } = theme.useToken()
  const [activeRoom, setActiveRoom] = useState<string>(rooms[0].id)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<'idle' | 'connecting' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const connect = useCallback(() => {
    const authToken = getToken()
    if (!authToken) {
      setStatus('error')
      setError('未检测到登录信息，请先登录。')
      return
    }

    if (socketRef.current) socketRef.current.close()

    setStatus('connecting')
    setError(null)

    const socket = new WebSocket(buildWsUrl(authToken))
    socketRef.current = socket

    socket.addEventListener('open', () => setStatus('ready'))

    socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data) as Envelope

        if (payload.type === 'error') {
          setError(payload.error?.message ?? '聊天室连接出现问题')
          return
        }

        if (payload.type === 'chat.history.result') {
          const items = Array.isArray(payload.data?.items) ? payload.data.items : []
          const history = items.map((entry: any) => ({
            id: entry.id,
            content: entry.content,
            createdAt: entry.created_at,
            isHistory: true,
          }))
          setMessages(history.reverse()) // History usually comes newest first
          return
        }

        if (payload.type === 'chat.message') {
          const data = payload.data ?? {}
          setMessages((prev) => [
            ...prev,
            {
              id: data.id,
              content: data.content,
              createdAt: data.created_at,
              senderId: data.sender?.id,
              senderName: data.sender?.nickname,
              isHistory: false,
            },
          ].slice(-200))
        }
      } catch {
        setError('聊天消息解析失败')
      }
    })

    socket.addEventListener('close', () => setStatus('error'))
    socket.addEventListener('error', () => {
      setStatus('error')
      setError('聊天室连接失败，请稍后重试。')
    })
  }, [])

  const sendEnvelope = useCallback((payload: Envelope) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return false
    socketRef.current.send(JSON.stringify(payload))
    return true
  }, [])

  const joinRoom = useCallback((roomId: string) => {
    setMessages([])
    sendEnvelope({
      v: 1,
      type: 'chat.join',
      requestId: makeRequestId(),
      data: { roomId },
    })
    sendEnvelope({
      v: 1,
      type: 'chat.history',
      requestId: makeRequestId(),
      data: { roomId, limit: 50 },
    })
  }, [sendEnvelope])

  useEffect(() => {
    connect()
    return () => socketRef.current?.close()
  }, [connect])

  useEffect(() => {
    if (status === 'ready') joinRoom(activeRoom)
  }, [activeRoom, joinRoom, status])

  const handleSend = () => {
    const content = draft.trim()
    if (!content) return

    const sent = sendEnvelope({
      v: 1,
      type: 'chat.send',
      requestId: makeRequestId(),
      data: { roomId: activeRoom, content },
    })

    if (sent) setDraft('')
    else setError('尚未连接到聊天室，请稍后重试。')
  }

  return (
    <Layout style={{ height: '100vh' }}>
      <SiteHeader />
      <Content style={{ 
        maxWidth: 1200, 
        margin: '24px auto', 
        width: '100%', 
        padding: '0 24px',
        display: 'flex',
        gap: 24,
        height: 'calc(100vh - 64px - 48px)'
      }}>
        {/* Rooms Sidebar */}
        <Card 
          title="聊天室" 
          style={{ width: 280, height: '100%', display: 'flex', flexDirection: 'column' }}
          bodyStyle={{ padding: 0, flex: 1, overflowY: 'auto' }}
        >
          <List
            dataSource={rooms}
            renderItem={item => (
              <List.Item 
                onClick={() => setActiveRoom(item.id)}
                style={{ 
                  cursor: 'pointer', 
                  padding: '12px 16px',
                  background: activeRoom === item.id ? token.colorPrimaryBg : 'transparent',
                  borderLeft: activeRoom === item.id ? `4px solid ${token.colorPrimary}` : '4px solid transparent',
                  transition: 'all 0.2s'
                }}
              >
                <List.Item.Meta
                  title={item.name}
                  description={item.description}
                />
              </List.Item>
            )}
          />
        </Card>

        {/* Chat Area */}
        <Card 
          style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}
          bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, height: '100%' }}
          title={
            <Space>
              <span>{rooms.find(r => r.id === activeRoom)?.name}</span>
              <Badge status={status === 'ready' ? 'success' : 'error'} text={status === 'ready' ? 'Online' : 'Offline'} />
            </Space>
          }
          extra={
            status !== 'ready' && (
              <Button type="link" icon={<SyncOutlined />} onClick={connect}>重连</Button>
            )
          }
        >
          {error && <Alert type="error" message={error} banner closable onClose={() => setError(null)} />}
          
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#f5f5f5' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', marginTop: 40 }}>
                暂无消息，开始聊天吧
              </div>
            ) : (
              messages.map(msg => {
                const isSelf = msg.senderId === user?.id
                return (
                  <div 
                    key={msg.id} 
                    style={{ 
                      display: 'flex', 
                      flexDirection: isSelf ? 'row-reverse' : 'row',
                      marginBottom: 16,
                      gap: 12
                    }}
                  >
                    <Avatar 
                      icon={msg.senderId ? <UserOutlined /> : <RobotOutlined />} 
                      style={{ backgroundColor: isSelf ? token.colorPrimary : '#ccc' }}
                    />
                    <div style={{ maxWidth: '70%' }}>
                      <div style={{ 
                        textAlign: isSelf ? 'right' : 'left', 
                        marginBottom: 4, 
                        fontSize: '0.8rem', 
                        color: '#999' 
                      }}>
                        {msg.senderName || '匿名'} · {formatRelativeTimeUTC8(msg.createdAt)}
                      </div>
                      <div style={{
                        padding: '10px 14px',
                        background: isSelf ? token.colorPrimary : '#fff',
                        color: isSelf ? '#fff' : '#333',
                        borderRadius: 12,
                        borderTopLeftRadius: isSelf ? 12 : 2,
                        borderTopRightRadius: isSelf ? 2 : 12,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        wordBreak: 'break-word'
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div style={{ padding: 16, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
            <Space.Compact style={{ width: '100%' }}>
              <Input 
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onPressEnter={handleSend}
                placeholder="输入消息..."
                disabled={status !== 'ready'}
                size="large"
              />
              <Button 
                type="primary" 
                icon={<SendOutlined />} 
                onClick={handleSend}
                disabled={status !== 'ready'}
                size="large"
              >
                发送
              </Button>
            </Space.Compact>
          </div>
        </Card>
      </Content>
    </Layout>
  )
}

export default Chat
