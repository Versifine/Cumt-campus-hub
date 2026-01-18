import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { 
  Layout, 
  Card, 
  Descriptions, 
  Avatar, 
  Tabs, 
  Button, 
  Space, 
  Row, 
  Col, 
  Statistic,
  Empty,
  Typography,
  theme
} from 'antd'
import { UserOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { fetchPosts, type PostItem } from '../api/posts'
import { fetchCurrentUser } from '../api/users'
import { getErrorMessage } from '../api/client'
import PostCard from '../components/PostCard'
import SiteHeader from '../components/SiteHeader'
import { ErrorState } from '../components/StateBlocks'
import { PostSkeletonList } from '../components/Skeletons'
import { useAuth } from '../context/AuthContext'
import { formatRelativeTimeUTC8 } from '../utils/time'

const { Content } = Layout
const { Title, Paragraph } = Typography

type LoadState<T> = {
  data: T
  loading: boolean
  error: string | null
}

type ProfileData = {
  id: string
  nickname: string
  bio?: string | null
  avatarUrl?: string | null
  coverUrl?: string | null
  createdAt?: string | null
  followersCount?: number | null
  followingCount?: number | null
}

const UserProfile = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { token } = theme.useToken()
  const [activeTab, setActiveTab] = useState('posts')
  const [profileState, setProfileState] = useState<LoadState<ProfileData | null>>({
    data: null,
    loading: true,
    error: null,
  })
  const [postsState, setPostsState] = useState<LoadState<PostItem[]>>({
    data: [],
    loading: true,
    error: null,
  })

  const isSelf = Boolean(user && id && user.id === id)

  const loadProfile = useCallback(async () => {
    if (!id) return
    setProfileState(prev => ({ ...prev, loading: true }))
    setPostsState(prev => ({ ...prev, loading: true }))

    let nickname = `User ${id}`
    let createdAt: string | null = null

    if (isSelf && user?.nickname) {
      nickname = user.nickname
    }

    if (isSelf) {
      try {
        const me = await fetchCurrentUser()
        createdAt = me.created_at
        nickname = me.nickname || nickname
      } catch {}
    }

    try {
      const posts = await fetchPosts(1, 20)
      const filtered = posts.items.filter((post) => String(post.author.id) === id)
      if (filtered.length > 0 && !isSelf) {
        nickname = filtered[0].author.nickname || nickname
      }
      setPostsState({ data: filtered, loading: false, error: null })
    } catch (error) {
      setPostsState({ data: [], loading: false, error: getErrorMessage(error) })
    }

    setProfileState({
      data: {
        id,
        nickname,
        createdAt,
        bio: null,
        avatarUrl: null,
        coverUrl: null,
        followersCount: 0,
        followingCount: 0,
      },
      loading: false,
      error: null,
    })
  }, [id, isSelf, user?.nickname])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const statsPosts = useMemo(() => postsState.data.length, [postsState.data.length])

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <SiteHeader />
      <Content style={{ maxWidth: 1000, margin: '24px auto', width: '100%', padding: '0 24px' }}>
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate(-1)} 
          style={{ marginBottom: 16 }}
        >
          Back
        </Button>

        {profileState.loading ? (
           <Card loading />
        ) : profileState.error ? (
           <ErrorState message={profileState.error} onRetry={loadProfile} />
        ) : profileState.data && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Header Card */}
            <Card 
              style={{ overflow: 'hidden', borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
              bodyStyle={{ padding: 0 }}
            >
              <div style={{ height: 160, background: 'linear-gradient(120deg, #f6d365 0%, #fda085 100%)' }} />
              <div style={{ padding: '0 24px 24px', position: 'relative' }}>
                <div style={{ marginTop: -48, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <Avatar 
                    size={96} 
                    src={profileState.data.avatarUrl} 
                    icon={<UserOutlined />} 
                    style={{ 
                      backgroundColor: token.colorPrimary,
                      border: '4px solid #fff' 
                    }}
                  />
                  <Space>
                    {isSelf ? (
                      <Button>Edit Profile</Button>
                    ) : (
                      <>
                        <Button type="primary">Follow</Button>
                        <Button>Message</Button>
                      </>
                    )}
                  </Space>
                </div>
                
                <Title level={2} style={{ marginBottom: 4 }}>{profileState.data.nickname}</Title>
                <Paragraph type="secondary" style={{ maxWidth: 600 }}>
                  {profileState.data.bio || 'This user has not written a bio yet.'}
                </Paragraph>

                <Descriptions column={{ xs: 1, sm: 2, md: 3 }} style={{ marginTop: 24 }}>
                  <Descriptions.Item label="User ID">{profileState.data.id}</Descriptions.Item>
                  <Descriptions.Item label="Joined">{profileState.data.createdAt ? formatRelativeTimeUTC8(profileState.data.createdAt) : 'Unknown'}</Descriptions.Item>
                </Descriptions>

                <Row gutter={32} style={{ marginTop: 16 }}>
                  <Col>
                    <Statistic title="Posts" value={statsPosts} />
                  </Col>
                  <Col>
                    <Statistic title="Followers" value={profileState.data.followersCount || 0} />
                  </Col>
                  <Col>
                    <Statistic title="Following" value={profileState.data.followingCount || 0} />
                  </Col>
                </Row>
              </div>
            </Card>

            {/* Content Tabs */}
            <Card 
              bordered={false} 
              style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
              bodyStyle={{ padding: '0 24px 24px' }}
            >
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                size="large"
                items={[
                  {
                    label: `Posts (${statsPosts})`,
                    key: 'posts',
                    children: (
                       <div style={{ paddingTop: 16 }}>
                         {postsState.loading ? (
                           <PostSkeletonList count={3} />
                         ) : postsState.error ? (
                           <ErrorState message={postsState.error} onRetry={loadProfile} />
                         ) : postsState.data.length === 0 ? (
                           <Empty description="No posts yet" />
                         ) : (
                           <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                             {postsState.data.map(post => (
                               <PostCard key={post.id} post={post} />
                             ))}
                           </div>
                         )}
                       </div>
                    )
                  },
                  {
                    label: 'Comments',
                    key: 'comments',
                    children: <Empty description="Comments coming soon" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
                  }
                ]}
              />
            </Card>
          </Space>
        )}
      </Content>
    </Layout>
  )
}

export default UserProfile
