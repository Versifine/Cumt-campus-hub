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
  Progress,
  Tag,
  Empty,
  Typography,
  theme,
  message,
  Modal,
  List
} from 'antd'
import { UserOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchPosts } from '../api/posts'
import { 
  fetchCurrentUser, 
  fetchUserProfile, 
  fetchFollowers,
  fetchFollowing,
  fetchUserComments,
  followUser, 
  unfollowUser,
  type FollowUserItem,
} from '../api/users'
import { getErrorMessage } from '../api/client'
import PostCard from '../components/PostCard'
import SiteHeader from '../components/SiteHeader'
import EditProfileModal from '../components/EditProfileModal'
import { ErrorState } from '../components/StateBlocks'
import { PostSkeletonList } from '../components/Skeletons'
import { useAuth } from '../context/useAuth'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'
import { formatRelativeTimeUTC8 } from '../utils/time'
import LevelBadge from '../components/LevelBadge'

const { Content } = Layout
const { Title, Paragraph, Text } = Typography

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
  level?: number | null
  levelTitle?: string | null
  exp?: number | null
}

type ExpProgress = {
  min: number
  max: number
  percent: number
  remaining: number
  nextLevel?: number
  isMax: boolean
}

const getExpProgress = (exp?: number | null): ExpProgress => {
  const value = Math.max(0, exp ?? 0)
  if (value <= 50) {
    const max = 50
    return {
      min: 0,
      max,
      percent: Math.round((value / max) * 100),
      remaining: Math.max(0, max - value),
      nextLevel: 2,
      isMax: false,
    }
  }
  if (value <= 200) {
    const min = 51
    const max = 200
    return {
      min,
      max,
      percent: Math.round(((value - min) / (max - min)) * 100),
      remaining: Math.max(0, max - value),
      nextLevel: 3,
      isMax: false,
    }
  }
  if (value < 1000) {
    const min = 201
    const max = 1000
    return {
      min,
      max,
      percent: Math.round(((value - min) / (max - min)) * 100),
      remaining: Math.max(0, max - value),
      nextLevel: 4,
      isMax: false,
    }
  }
  return {
    min: 1000,
    max: 1000,
    percent: 100,
    remaining: 0,
    isMax: true,
  }
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

  const postsPageSize = 10
  const commentsPageSize = 10

  const postsQuery = useInfiniteQuery({
    queryKey: ['user-posts', id],
    initialPageParam: 1,
    enabled: Boolean(id),
    queryFn: ({ pageParam }) => fetchPosts(pageParam, postsPageSize, undefined, id),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0)
      return loaded >= lastPage.total ? undefined : allPages.length + 1
    },
  })

  const commentsQuery = useInfiniteQuery({
    queryKey: ['user-comments', id],
    initialPageParam: 1,
    enabled: Boolean(id),
    queryFn: ({ pageParam }) => fetchUserComments(id ?? '', pageParam, commentsPageSize),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0)
      return loaded >= lastPage.total ? undefined : allPages.length + 1
    },
  })

  const posts = useMemo(
    () => postsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [postsQuery.data],
  )
  const comments = useMemo(
    () => commentsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [commentsQuery.data],
  )
  const postsTotal = postsQuery.data?.pages[0]?.total ?? 0
  const commentsTotal = commentsQuery.data?.pages[0]?.total ?? 0
  const postsErrorMessage = postsQuery.error ? getErrorMessage(postsQuery.error) : null
  const commentsErrorMessage = commentsQuery.error ? getErrorMessage(commentsQuery.error) : null

  const handleLoadMorePosts = useCallback(() => {
    if (!postsQuery.hasNextPage || postsQuery.isFetchingNextPage) return
    void postsQuery.fetchNextPage()
  }, [postsQuery])

  const handleLoadMoreComments = useCallback(() => {
    if (!commentsQuery.hasNextPage || commentsQuery.isFetchingNextPage) return
    void commentsQuery.fetchNextPage()
  }, [commentsQuery])

  const { ref: postsSentinelRef, isSupported: postsScrollSupported } = useInfiniteScroll({
    onLoadMore: handleLoadMorePosts,
    enabled: activeTab === 'posts' && Boolean(postsQuery.hasNextPage),
  })

  const { ref: commentsSentinelRef, isSupported: commentsScrollSupported } = useInfiniteScroll({
    onLoadMore: handleLoadMoreComments,
    enabled: activeTab === 'comments' && Boolean(commentsQuery.hasNextPage),
  })

  const loadProfile = useCallback(async () => {
    if (!id) return
    setProfileState(prev => ({ ...prev, loading: true }))

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
          level: me.level ?? 1,
          levelTitle: me.level_title ?? '萌新',
          exp: me.exp ?? 0,
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
          commentsCount: pubUser.comments_count,
          isFollowing: pubUser.is_following,
          level: pubUser.level,
          levelTitle: pubUser.level_title,
          exp: pubUser.exp,
        }
      }
      setProfileState({ data: profileData, loading: false, error: null })
    } catch (error) {
      setProfileState(prev => ({ ...prev, loading: false, error: getErrorMessage(error) }))
    }
  }, [id, isSelf])

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
  }, [loadProfile])

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

  const statsPosts = useMemo(
    () => (postsTotal > 0 ? postsTotal : posts.length),
    [posts.length, postsTotal],
  )
  const statsComments = useMemo(
    () => (commentsTotal > 0 ? commentsTotal : profileState.data?.commentsCount ?? 0),
    [commentsTotal, profileState.data?.commentsCount],
  )

  const expValue = profileState.data?.exp ?? 0
  const expProgress = getExpProgress(expValue)


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
                
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <Title level={2} style={{ marginBottom: 0 }}>{profileState.data.nickname}</Title>
                  <LevelBadge
                    level={profileState.data.level}
                    title={profileState.data.levelTitle}
                  />
                </div>
                <Paragraph type="secondary" style={{ maxWidth: 600 }}>
                  {profileState.data.bio || 'This user has not written a bio yet.'}
                </Paragraph>

                <div style={{ marginTop: 16 }}>
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    <Space size={8} wrap>
                      <Text strong>经验</Text>
                      <Text type="secondary">{expValue} EXP</Text>
                      {expProgress.isMax ? (
                        <Text type="secondary">已达最高等级</Text>
                      ) : (
                        <Text type="secondary">
                          距离 Lv{expProgress.nextLevel} 还差 {expProgress.remaining} EXP
                        </Text>
                      )}
                    </Space>
                    <Progress percent={expProgress.percent} showInfo={false} strokeColor={token.colorPrimary} />
                  </Space>
                </div>

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
                        title={
                          <Space size={6} wrap>
                            <span>{item.nickname}</span>
                            <LevelBadge level={item.level} title={item.level_title} compact />
                          </Space>
                        }
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
                          {postsQuery.isLoading ? (
                            <PostSkeletonList count={3} />
                          ) : postsErrorMessage ? (
                            <ErrorState message={postsErrorMessage} onRetry={postsQuery.refetch} />
                          ) : posts.length === 0 ? (
                            <Empty description="No posts yet" />
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                              {posts.map(post => (
                                <PostCard key={post.id} post={post} />
                              ))}
                              {postsQuery.isFetchingNextPage && (
                                <div style={{ textAlign: 'center', color: token.colorTextSecondary }}>
                                  Loading more...
                                </div>
                              )}
                              {postsQuery.hasNextPage && <div ref={postsSentinelRef} style={{ height: 1 }} />}
                              {!postsScrollSupported && postsQuery.hasNextPage && (
                                <div style={{ textAlign: 'center' }}>
                                  <Button onClick={handleLoadMorePosts}>加载更多</Button>
                                </div>
                              )}
                              {!postsQuery.hasNextPage && posts.length > 0 && (
                                <div style={{ textAlign: 'center', color: token.colorTextSecondary }}>
                                  已经到底了
                                </div>
                              )}
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
                        {commentsQuery.isLoading ? (
                          <PostSkeletonList count={2} />
                        ) : commentsErrorMessage ? (
                          <ErrorState message={commentsErrorMessage} onRetry={commentsQuery.refetch} />
                        ) : comments.length === 0 ? (
                          <Empty description="No comments yet" />
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {comments.map((comment) => (
                              <Card
                                key={comment.id}
                                bordered
                                hoverable
                                onClick={() => navigate(`/post/${comment.post_id}?comment_id=${comment.id}`)}
                                style={{ borderRadius: 12, cursor: 'pointer' }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                                  <Space size={8} wrap>
                                    {comment.board_name && (
                                      <Tag color="geekblue" bordered={false} style={{ marginInlineStart: 0 }}>
                                        {comment.board_name}
                                      </Tag>
                                    )}
                                    <Typography.Text strong>
                                      {comment.post_title || comment.post_id}
                                    </Typography.Text>
                                    {comment.floor ? (
                                      <Tag color="blue" bordered={false} style={{ marginInlineStart: 0 }}>
                                        #{comment.floor}楼
                                      </Tag>
                                    ) : comment.is_reply ? (
                                      <Tag bordered={false} style={{ marginInlineStart: 0 }}>
                                        回复
                                      </Tag>
                                    ) : null}
                                  </Space>
                                  <Typography.Text type="secondary" style={{ fontSize: '0.8rem' }}>
                                    {formatRelativeTimeUTC8(comment.created_at)}
                                  </Typography.Text>
                                </div>
                                <Typography.Paragraph style={{ marginBottom: 8 }} ellipsis={{ rows: 2 }}>
                                  {comment.content || '...'}
                                </Typography.Paragraph>
                                <Typography.Text type="secondary" style={{ fontSize: '0.75rem' }}>
                                  点击卡片跳转到对应楼层
                                </Typography.Text>
                              </Card>
                            ))}
                            {commentsQuery.isFetchingNextPage && (
                              <div style={{ textAlign: 'center', color: token.colorTextSecondary }}>
                                Loading more...
                              </div>
                            )}
                            {commentsQuery.hasNextPage && <div ref={commentsSentinelRef} style={{ height: 1 }} />}
                            {!commentsScrollSupported && commentsQuery.hasNextPage && (
                              <div style={{ textAlign: 'center' }}>
                                <Button onClick={handleLoadMoreComments}>加载更多</Button>
                              </div>
                            )}
                            {!commentsQuery.hasNextPage && comments.length > 0 && (
                              <div style={{ textAlign: 'center', color: token.colorTextSecondary }}>
                                已经到底了
                              </div>
                            )}
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
