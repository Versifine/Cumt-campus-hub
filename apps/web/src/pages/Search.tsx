import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Layout, Tabs, List, Card, Avatar, Typography, Tag, Empty, Spin, Pagination, Space, theme } from 'antd'
import { UserOutlined, LikeOutlined, MessageOutlined, ClockCircleOutlined } from '@ant-design/icons'
import SiteHeader from '../components/SiteHeader'

const { Content } = Layout
const { Title, Text, Paragraph } = Typography

interface PostResult {
  id: string
  board_id: string
  author_id: string
  author_name: string
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
}

interface SearchResponse<T> {
  data: T[]
  total: number
  page: number
  page_size: number
}

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const tabKey = searchParams.get('tab') || 'posts'
  const currentPage = parseInt(searchParams.get('page') || '1', 10)
  
  const { token } = theme.useToken()
  
  const [posts, setPosts] = useState<PostResult[]>([])
  const [users, setUsers] = useState<UserResult[]>([])
  const [postsTotal, setPostsTotal] = useState(0)
  const [usersTotal, setUsersTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // Fetch search results
  useEffect(() => {
    if (!query) {
      setPosts([])
      setUsers([])
      setPostsTotal(0)
      setUsersTotal(0)
      return
    }

    const fetchResults = async () => {
      setLoading(true)
      try {
        if (tabKey === 'posts') {
          const res = await fetch(`/api/v1/search/posts?q=${encodeURIComponent(query)}&page=${currentPage}`)
          if (res.ok) {
            const data: SearchResponse<PostResult> = await res.json()
            setPosts(data.data || [])
            setPostsTotal(data.total)
          }
        } else {
          const res = await fetch(`/api/v1/search/users?q=${encodeURIComponent(query)}&page=${currentPage}`)
          if (res.ok) {
            const data: SearchResponse<UserResult> = await res.json()
            setUsers(data.data || [])
            setUsersTotal(data.total)
          }
        }
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [query, tabKey, currentPage])

  const handleTabChange = (key: string) => {
    setSearchParams({ q: query, tab: key, page: '1' })
  }

  const handlePageChange = (page: number) => {
    setSearchParams({ q: query, tab: tabKey, page: String(page) })
  }

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
            <Text type="secondary">
              <UserOutlined style={{ marginRight: 4 }} />
              {post.author_name || '匿名用户'}
            </Text>
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
              {user.nickname}
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
      children: loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : posts.length > 0 ? (
        <>
          <List
            dataSource={posts}
            renderItem={renderPostItem}
            split={false}
            style={{ marginBottom: 24 }}
          />
          {postsTotal > 20 && (
            <div style={{ textAlign: 'center' }}>
              <Pagination 
                current={currentPage} 
                total={postsTotal} 
                pageSize={20}
                onChange={handlePageChange}
                showSizeChanger={false}
              />
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
      children: loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : users.length > 0 ? (
        <>
          <List
            dataSource={users}
            renderItem={renderUserItem}
            split={false}
            style={{ marginBottom: 24 }}
          />
          {usersTotal > 20 && (
            <div style={{ textAlign: 'center' }}>
              <Pagination 
                current={currentPage} 
                total={usersTotal} 
                pageSize={20}
                onChange={handlePageChange}
                showSizeChanger={false}
              />
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
