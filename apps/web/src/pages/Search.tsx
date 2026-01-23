import { useCallback, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Layout, Tabs, List, Card, Avatar, Typography, Tag, Empty, Spin, Space, theme, Button } from 'antd'
import { UserOutlined, LikeOutlined, MessageOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useInfiniteQuery } from '@tanstack/react-query'
import { getErrorMessage } from '../api/client'
import { fetchSearchPosts, fetchSearchUsers } from '../api/search'
import LevelBadge from '../components/LevelBadge'
import SiteHeader from '../components/SiteHeader'
import { ErrorState } from '../components/StateBlocks'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'

const { Content } = Layout
const { Title, Text, Paragraph } = Typography

interface PostResult {
  id: string
  board_id: string
  author_id: string
  author_name: string
  author_level?: number
  author_level_title?: string
  title: string
  content: string
  tags: string[]
  created_at: string
  score: number
  comment_count: number
}

interface UserResult {
  id: string
  nickname: string
  avatar: string
  bio: string
  created_at: string
  level?: number
  level_title?: string
}

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const tabKey = searchParams.get('tab') || 'posts'
  
  const { token } = theme.useToken()

  const pageSize = 20
  const postsQuery = useInfiniteQuery({
    queryKey: ['search-posts', query],
    initialPageParam: 1,
    enabled: Boolean(query),
    queryFn: ({ pageParam }) => fetchSearchPosts<PostResult>(query, pageParam, pageSize),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.data.length, 0)
      return loaded >= lastPage.total ? undefined : allPages.length + 1
    },
  })

  const usersQuery = useInfiniteQuery({
    queryKey: ['search-users', query],
    initialPageParam: 1,
    enabled: Boolean(query),
    queryFn: ({ pageParam }) => fetchSearchUsers<UserResult>(query, pageParam, pageSize),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.data.length, 0)
      return loaded >= lastPage.total ? undefined : allPages.length + 1
    },
  })

  const posts = useMemo(
    () => postsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [postsQuery.data],
  )
  const users = useMemo(
    () => usersQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [usersQuery.data],
  )
  const postsTotal = postsQuery.data?.pages[0]?.total ?? 0
  const usersTotal = usersQuery.data?.pages[0]?.total ?? 0
  const postsErrorMessage = postsQuery.error ? getErrorMessage(postsQuery.error) : null
  const usersErrorMessage = usersQuery.error ? getErrorMessage(usersQuery.error) : null

  const handleTabChange = (key: string) => {
    setSearchParams({ q: query, tab: key })
  }

  const handleLoadMorePosts = useCallback(() => {
    if (!postsQuery.hasNextPage || postsQuery.isFetchingNextPage) return
    void postsQuery.fetchNextPage()
  }, [postsQuery])

  const handleLoadMoreUsers = useCallback(() => {
    if (!usersQuery.hasNextPage || usersQuery.isFetchingNextPage) return
    void usersQuery.fetchNextPage()
  }, [usersQuery])

  const { ref: postsSentinelRef, isSupported: postsScrollSupported } = useInfiniteScroll({
    onLoadMore: handleLoadMorePosts,
    enabled: tabKey === 'posts' && Boolean(postsQuery.hasNextPage),
  })

  const { ref: usersSentinelRef, isSupported: usersScrollSupported } = useInfiniteScroll({
    onLoadMore: handleLoadMoreUsers,
    enabled: tabKey === 'users' && Boolean(usersQuery.hasNextPage),
  })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const renderPostItem = (post: PostResult) => (
    <List.Item key={post.id}>
      <Card 
        hoverable 
        style={{ width: '100%' }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Link to={`/post/${post.id}`} style={{ color: 'inherit' }}>
          <Title level={5} style={{ marginBottom: 8 }}>
            {post.title}
          </Title>
          <Paragraph 
            ellipsis={{ rows: 2 }} 
            style={{ color: token.colorTextSecondary, marginBottom: 12 }}
          >
            {post.content}
          </Paragraph>
          <Space split={<span style={{ color: token.colorTextQuaternary }}>·</span>}>
            <Space size={6} wrap>
              <Text type="secondary">
                <UserOutlined style={{ marginRight: 4 }} />
                {post.author_name || '匿名用户'}
              </Text>
              <LevelBadge level={post.author_level} title={post.author_level_title} compact />
            </Space>
            <Text type="secondary">
              <LikeOutlined style={{ marginRight: 4 }} />
              {post.score}
            </Text>
            <Text type="secondary">
              <MessageOutlined style={{ marginRight: 4 }} />
              {post.comment_count}
            </Text>
            <Text type="secondary">
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              {formatDate(post.created_at)}
            </Text>
          </Space>
          {post.tags && post.tags.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {post.tags.map((tag, idx) => (
                <Tag key={idx} color="blue">{tag}</Tag>
              ))}
            </div>
          )}
        </Link>
      </Card>
    </List.Item>
  )

  const renderUserItem = (user: UserResult) => (
    <List.Item key={user.id}>
      <Card 
        hoverable 
        style={{ width: '100%' }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Link to={`/u/${user.id}`} style={{ color: 'inherit', display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar 
            size={56} 
            src={user.avatar} 
            icon={<UserOutlined />}
            style={{ backgroundColor: token.colorPrimary, flexShrink: 0 }}
          >
            {user.nickname?.[0]?.toUpperCase()}
          </Avatar>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Title level={5} style={{ marginBottom: 4 }}>
              <Space size={8} wrap>
                <span>{user.nickname}</span>
                <LevelBadge level={user.level} title={user.level_title} compact />
              </Space>
            </Title>
            <Paragraph 
              ellipsis={{ rows: 2 }} 
              style={{ color: token.colorTextSecondary, marginBottom: 0 }}
            >
              {user.bio || '这个用户很懒，什么都没写...'}
            </Paragraph>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              加入于 {formatDate(user.created_at)}
            </Text>
          </div>
        </Link>
      </Card>
    </List.Item>
  )

  const tabItems = [
    {
      key: 'posts',
      label: `帖子${postsTotal > 0 ? ` (${postsTotal})` : ''}`,
      children: postsQuery.isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : postsErrorMessage ? (
        <ErrorState message={postsErrorMessage} onRetry={postsQuery.refetch} />
      ) : posts.length > 0 ? (
        <>
          <List
            dataSource={posts}
            renderItem={renderPostItem}
            split={false}
            style={{ marginBottom: 24 }}
          />
          {postsQuery.isFetchingNextPage && (
            <div style={{ textAlign: 'center', color: token.colorTextSecondary, paddingBottom: 16 }}>
              Loading more...
            </div>
          )}
          {postsQuery.hasNextPage && <div ref={postsSentinelRef} style={{ height: 1 }} />}
          {!postsScrollSupported && postsQuery.hasNextPage && (
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Button onClick={handleLoadMorePosts}>加载更多</Button>
            </div>
          )}
          {!postsQuery.hasNextPage && posts.length > 0 && (
            <div style={{ textAlign: 'center', color: token.colorTextSecondary, paddingBottom: 16 }}>
              已经到底了
            </div>
          )}
        </>
      ) : (
        <Empty description="没有找到相关帖子" style={{ padding: 48 }} />
      ),
    },
    {
      key: 'users',
      label: `用户${usersTotal > 0 ? ` (${usersTotal})` : ''}`,
      children: usersQuery.isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : usersErrorMessage ? (
        <ErrorState message={usersErrorMessage} onRetry={usersQuery.refetch} />
      ) : users.length > 0 ? (
        <>
          <List
            dataSource={users}
            renderItem={renderUserItem}
            split={false}
            style={{ marginBottom: 24 }}
          />
          {usersQuery.isFetchingNextPage && (
            <div style={{ textAlign: 'center', color: token.colorTextSecondary, paddingBottom: 16 }}>
              Loading more...
            </div>
          )}
          {usersQuery.hasNextPage && <div ref={usersSentinelRef} style={{ height: 1 }} />}
          {!usersScrollSupported && usersQuery.hasNextPage && (
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Button onClick={handleLoadMoreUsers}>加载更多</Button>
            </div>
          )}
          {!usersQuery.hasNextPage && users.length > 0 && (
            <div style={{ textAlign: 'center', color: token.colorTextSecondary, paddingBottom: 16 }}>
              已经到底了
            </div>
          )}
        </>
      ) : (
        <Empty description="没有找到相关用户" style={{ padding: 48 }} />
      ),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#FAF8F5' }}>
      <SiteHeader />
      <Content style={{ padding: '24px 48px', maxWidth: 960, margin: '0 auto', width: '100%' }}>
        {query ? (
          <>
            <Title level={4} style={{ marginBottom: 24 }}>
              搜索结果："{query}"
            </Title>
            <Tabs 
              activeKey={tabKey} 
              onChange={handleTabChange} 
              items={tabItems}
            />
          </>
        ) : (
          <Empty 
            description="请输入搜索关键词" 
            style={{ padding: 96 }} 
          />
        )}
      </Content>
    </Layout>
  )
}

export default Search
