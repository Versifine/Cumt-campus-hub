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
  theme,
  message,
  Modal,
  List
} from 'antd'
import { UserOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { fetchPosts, type PostItem } from '../api/posts'
import { 
  fetchCurrentUser, 
  fetchUserProfile, 
  fetchFollowers,
  fetchFollowing,
  fetchUserComments,
  followUser, 
  unfollowUser,
  type FollowUserItem,
  type UserCommentItem,
} from '../api/users'
import { getErrorMessage } from '../api/client'
import PostCard from '../components/PostCard'
import SiteHeader from '../components/SiteHeader'
import EditProfileModal from '../components/EditProfileModal'
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
  commentsCount?: number | null
  isFollowing?: boolean
}

const UserProfile = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { token } = theme.useToken()
  const [activeTab, setActiveTab] = useState('posts')
  const [editModalVisible, setEditModalVisible] = useState(false)
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
  const [commentsState, setCommentsState] = useState<LoadState<UserCommentItem[]>>({
    data: [],
    loading: false,
    error: null,
  })
  const [followModal, setFollowModal] = useState<{
    visible: boolean
    type: 'followers' | 'following'
  }>({
    visible: false,
    type: 'followers',
  })
  const [followListState, setFollowListState] = useState<LoadState<FollowUserItem[]>>({
    data: [],
    loading: false,
    error: null,
  })
  const [followTotal, setFollowTotal] = useState(0)
  const [followPage, setFollowPage] = useState(1)

  const isSelf = Boolean(user && id && user.id === id)

  const loadProfile = useCallback(async () => {
    if (!id) return
    setProfileState(prev => ({ ...prev, loading: true }))
    setPostsState(prev => ({ ...prev, loading: true }))

    try {
      // 1. Load Profile Data
      let profileData: ProfileData
      if (isSelf) {
        const me = await fetchCurrentUser()
        profileData = {
          id: me.id,
          nickname: me.nickname,
          bio: me.bio,
          avatarUrl: me.avatar,
          coverUrl: me.cover,
          createdAt: me.created_at,
          followersCount: me.followers_count ?? 0,
          followingCount: me.following_count ?? 0,
          commentsCount: me.comments_count ?? 0,
        }
      } else {
        const pubUser = await fetchUserProfile(id)
        profileData = {
          id: pubUser.id,
          nickname: pubUser.nickname,
          bio: pubUser.bio,
          avatarUrl: pubUser.avatar,
          coverUrl: pubUser.cover,
          createdAt: pubUser.created_at,
          followersCount: pubUser.followers_count,
          followingCount: pubUser.following_count,
          isFollowing: pubUser.is_following,
        }
      }
      setProfileState({ data: profileData, loading: false, error: null })

      // 2. Load Posts
      const posts = await fetchPosts(1, 20)
      const filtered = posts.items.filter((post) => String(post.author.id) === id)
      setPostsState({ data: filtered, loading: false, error: null })

    } catch (error) {
      setProfileState(prev => ({ ...prev, loading: false, error: getErrorMessage(error) }))
      setPostsState(prev => ({ ...prev, loading: false }))
    }
  }, [id, isSelf])

  const loadCommentsList = useCallback(async () => {
    if (!id) return
    setCommentsState(prev => ({ ...prev, loading: true }))
    try {
      const res = await fetchUserComments(id, 1, 20)
      setCommentsState({ data: res.items, loading: false, error: null })
    } catch (error) {
      setCommentsState({ data: [], loading: false, error: getErrorMessage(error) })
    }
  }, [id])

  const loadFollowList = useCallback(async (type: 'followers' | 'following', page = 1) => {
    if (!id) return
    setFollowListState(prev => ({ ...prev, loading: true }))
    try {
      const res = type === 'followers'
        ? await fetchFollowers(id, page, 20)
        : await fetchFollowing(id, page, 20)
      setFollowListState({ data: res.items, loading: false, error: null })
      setFollowTotal(res.total)
      setFollowPage(page)
    } catch (error) {
      setFollowListState({ data: [], loading: false, error: getErrorMessage(error) })
    }
  }, [id])

  const openFollowModal = (type: 'followers' | 'following') => {
    setFollowModal({ visible: true, type })
    loadFollowList(type, 1)
  }

  const closeFollowModal = () => {
    setFollowModal(prev => ({ ...prev, visible: false }))
  }

  useEffect(() => {
    loadProfile()
    loadCommentsList()
  }, [loadProfile, loadCommentsList])

  const handleFollowToggle = async () => {
    if (!user) {
      message.info('请先登录')
      navigate('/login', { state: { from: window.location.pathname } })
      return
    }
    if (!profileState.data) return

    const isFollowing = profileState.data.isFollowing
    const targetId = profileState.data.id
    
    // Optimistic Update
    setProfileState(prev => {
      if (!prev.data) return prev
      return {
        ...prev,
        data: {
          ...prev.data,
          isFollowing: !isFollowing,
          followersCount: (prev.data.followersCount || 0) + (isFollowing ? -1 : 1)
        }
      }
    })

    try {
      if (isFollowing) {
        await unfollowUser(targetId)
      } else {
        await followUser(targetId)
      }
    } catch (error) {
      // Revert on error
      setProfileState(prev => {
        if (!prev.data) return prev
        return {
          ...prev,
          data: {
            ...prev.data,
            isFollowing: isFollowing, // revert
            followersCount: (prev.data.followersCount || 0) + (isFollowing ? 1 : -1)
          }
        }
      })
      message.error(getErrorMessage(error))
    }
  }

  const statsPosts = useMemo(() => postsState.data.length, [postsState.data.length])
  const statsComments = useMemo(() => profileState.data?.commentsCount ?? 0, [profileState.data?.commentsCount])


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
              <div style={{ height: 160, background: profileState.data.coverUrl ? `url(${profileState.data.coverUrl}) center/cover no-repeat` : 'linear-gradient(120deg, #f6d365 0%, #fda085 100%)' }} />
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
                      <Button onClick={() => setEditModalVisible(true)}>Edit Profile</Button>
                    ) : (
                      <>
                        <Button 
                          type={profileState.data.isFollowing ? 'default' : 'primary'}
                          onClick={handleFollowToggle}
                        >
                          {profileState.data.isFollowing ? 'Unfollow' : 'Follow'}
                        </Button>
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
                    <div onClick={() => openFollowModal('following')} style={{ cursor: 'pointer' }}>
                      <Statistic title="Following" value={profileState.data.followingCount || 0} />
                    </div>
                  </Col>
                  <Col>
                    <div onClick={() => openFollowModal('followers')} style={{ cursor: 'pointer' }}>
                      <Statistic title="Followers" value={profileState.data.followersCount || 0} />
                    </div>
                  </Col>
                  <Col>
                    <Statistic title="Comments" value={statsComments} />
                  </Col>
                </Row>
              </div>
            </Card>

            {/* Edit Profile Modal */}
            <EditProfileModal
              visible={editModalVisible}
              onClose={() => setEditModalVisible(false)}
              onSuccess={loadProfile}
              user={profileState.data ? {
                id: profileState.data.id,
                nickname: profileState.data.nickname,
                avatar: profileState.data.avatarUrl || '',
                cover: profileState.data.coverUrl || '',
                bio: profileState.data.bio || '',
                created_at: profileState.data.createdAt || '',
              } : null}
            />

            {/* Follow List Modal */}
            <Modal
              open={followModal.visible}
              onCancel={closeFollowModal}
              footer={null}
              title={followModal.type === 'followers' ? 'Followers' : 'Following'}
            >
              {followListState.loading ? (
                <div style={{ padding: 16 }}>
                  <PostSkeletonList count={2} />
                </div>
              ) : followListState.error ? (
                <ErrorState message={followListState.error} onRetry={() => loadFollowList(followModal.type, followPage)} />
              ) : (
                <List
                  dataSource={followListState.data}
                  locale={{ emptyText: 'No users' }}
                  pagination={{
                    current: followPage,
                    total: followTotal,
                    pageSize: 20,
                    onChange: (page) => loadFollowList(followModal.type, page),
                  }}
                  renderItem={(item) => (
                    <List.Item onClick={() => { closeFollowModal(); navigate(`/u/${item.id}`) }} style={{ cursor: 'pointer' }}>
                      <List.Item.Meta
                        avatar={<Avatar src={item.avatar} icon={<UserOutlined />} />}
                        title={item.nickname}
                        description={item.bio || '暂无简介'}
                      />
                    </List.Item>
                  )}
                />
              )}
            </Modal>

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
                    label: `Comments (${statsComments})`,
                    key: 'comments',
                    children: (
                      <div style={{ paddingTop: 16 }}>
                        {commentsState.loading ? (
                          <PostSkeletonList count={2} />
                        ) : commentsState.error ? (
                          <ErrorState message={commentsState.error} onRetry={loadCommentsList} />
                        ) : commentsState.data.length === 0 ? (
                          <Empty description="No comments yet" />
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {commentsState.data.map((comment) => (
                              <Card key={comment.id} bordered style={{ borderRadius: 12 }}>
                                <div style={{ marginBottom: 8 }}>
                                  <Typography.Text type="secondary">在帖子</Typography.Text>
                                  <Button 
                                    type="link" 
                                    onClick={() => navigate(`/post/${comment.post_id}`)}
                                    style={{ padding: 0, marginLeft: 4 }}
                                  >
                                    {comment.post_id}
                                  </Button>
                                </div>
                                <Typography.Paragraph style={{ marginBottom: 0 }}>
                                  {comment.content || '...'}
                                </Typography.Paragraph>
                                <Typography.Text type="secondary" style={{ fontSize: '0.8rem' }}>
                                  {formatRelativeTimeUTC8(comment.created_at)}
                                </Typography.Text>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    )
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
