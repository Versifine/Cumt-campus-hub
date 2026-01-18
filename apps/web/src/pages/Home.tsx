import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout, Row, Col, Typography, Button, Tag, Space, theme } from 'antd'
import { fetchBoards } from '../api/boards'
import { getErrorMessage } from '../api/client'
import { fetchPosts } from '../api/posts'
import BoardList from '../components/BoardList'
import PostCard from '../components/PostCard'
import SectionCard from '../components/SectionCard'
import SiteHeader from '../components/SiteHeader'
import { EmptyState, ErrorState } from '../components/StateBlocks'
import { BoardSkeletonList, PostSkeletonList } from '../components/Skeletons'
import type { Board } from '../api/boards'
import type { PostItem } from '../api/posts'

const { Content, Sider } = Layout
const { Title, Text } = Typography

type LoadState<T> = {
  data: T
  loading: boolean
  error: string | null
}

const Home = () => {
  const { token } = theme.useToken()
  const [boardsState, setBoardsState] = useState<LoadState<Board[]>>({
    data: [],
    loading: true,
    error: null,
  })
  const [postsState, setPostsState] = useState<LoadState<PostItem[]>>({
    data: [],
    loading: true,
    error: null,
  })
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null)

  const loadBoards = useCallback(async () => {
    setBoardsState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const data = await fetchBoards()
      setBoardsState({ data, loading: false, error: null })
    } catch (error) {
      setBoardsState({
        data: [],
        loading: false,
        error: getErrorMessage(error),
      })
    }
  }, [])

  const loadPosts = useCallback(async () => {
    setPostsState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const data = await fetchPosts(1, 20, activeBoardId ?? undefined)
      setPostsState({ data: data.items, loading: false, error: null })
    } catch (error) {
      setPostsState({
        data: [],
        loading: false,
        error: getErrorMessage(error),
      })
    }
  }, [activeBoardId])

  useEffect(() => {
    void loadBoards()
    void loadPosts()
  }, [loadBoards, loadPosts])

  const activeBoard = boardsState.data.find(
    (board) => board.id === activeBoardId,
  )

  const renderFeedHeader = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <Space>
        <Tag color={activeBoard ? 'geekblue' : 'orange'} style={{ fontSize: '0.9rem', padding: '4px 10px' }}>
          {activeBoard ? activeBoard.name : 'All Boards'}
        </Tag>
        {activeBoard && (
          <Button 
            type="link" 
            size="small" 
            onClick={() => setActiveBoardId(null)}
            style={{ padding: 0 }}
          >
            View All
          </Button>
        )}
      </Space>
    </div>
  )

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <SiteHeader />
      
      <Content style={{ 
        maxWidth: 1280, 
        margin: '24px auto', 
        width: '100%', 
        padding: '0 24px' 
      }}>
        <Row gutter={24}>
          {/* Left Sidebar: Boards */}
          <Col xs={0} md={6} lg={5}>
            <SectionCard title="Boards" style={{ position: 'sticky', top: 88 }}>
              {boardsState.loading ? (
                <BoardSkeletonList count={5} />
              ) : boardsState.error ? (
                <ErrorState message={boardsState.error} onRetry={loadBoards} />
              ) : boardsState.data.length === 0 ? (
                <EmptyState
                  title="No boards"
                  description="No boards available."
                />
              ) : (
                <BoardList
                  boards={boardsState.data}
                  activeBoardId={activeBoardId}
                  onSelect={setActiveBoardId}
                />
              )}
            </SectionCard>
          </Col>

          {/* Main Feed */}
          <Col xs={24} md={18} lg={13}>
            <SectionCard 
              title={activeBoard ? 'Board Posts' : 'Latest Posts'}
              actions={renderFeedHeader()}
            >
              {postsState.loading ? (
                <PostSkeletonList count={4} />
              ) : postsState.error ? (
                <ErrorState message={postsState.error} onRetry={loadPosts} />
              ) : postsState.data.length === 0 ? (
                <EmptyState
                  title="No posts yet"
                  description={
                    activeBoard
                      ? 'This board has no posts yet.'
                      : 'Be the first to start a discussion.'
                  }
                  action={
                    <Button type="primary" href="/post/demo">
                      查看示例帖子
                    </Button>
                  }
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {postsState.data.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              )}
            </SectionCard>
          </Col>

          {/* Right Sidebar: Bulletin */}
          <Col xs={0} lg={6}>
            <SectionCard title="Bulletin" style={{ position: 'sticky', top: 88 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Text strong style={{ fontSize: '1.05rem' }}>Campus Updates</Text>
                <Text type="secondary">
                  Weekly highlights and campus-wide notices will appear here.
                </Text>
                <Text type="secondary" style={{ fontSize: '0.8rem', marginTop: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Stay tuned
                </Text>
              </div>
            </SectionCard>
          </Col>
        </Row>
      </Content>
    </Layout>
  )
}

export default Home
