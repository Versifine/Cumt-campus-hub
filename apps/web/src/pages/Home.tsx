import { useCallback, useEffect, useMemo, useState } from 'react'
import { Layout, Row, Col, Typography, Button, Tag, Space, Radio } from 'antd'
import { useInfiniteQuery } from '@tanstack/react-query'
import { getErrorMessage } from '../api/client'
import { fetchPosts } from '../api/posts'
import BoardList from '../components/BoardList'
import PostCard from '../components/PostCard'
import SectionCard from '../components/SectionCard'
import SiteHeader from '../components/SiteHeader'
import { EmptyState, ErrorState } from '../components/StateBlocks'
import { BoardSkeletonList, PostSkeletonList } from '../components/Skeletons'
import { useBoards } from '../hooks/useBoards'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'

const { Content } = Layout
const { Text } = Typography

const Home = () => {
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'latest' | 'hot'>('latest')

  const {
    data: boards = [],
    isLoading: boardsLoading,
    error: boardsError,
    refetch: refetchBoards,
  } = useBoards()

  const postsPageSize = 20
  const {
    data: postsPages,
    isLoading: postsLoading,
    error: postsError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchPosts,
  } = useInfiniteQuery({
    queryKey: ['posts', activeBoardId, sortBy],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchPosts(pageParam, postsPageSize, activeBoardId ?? undefined, undefined, sortBy),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0)
      return loaded >= lastPage.total ? undefined : allPages.length + 1
    },
  })

  const posts = useMemo(
    () => postsPages?.pages.flatMap((page) => page.items) ?? [],
    [postsPages],
  )

  const postsErrorMessage = postsError ? getErrorMessage(postsError) : null

  const handleLoadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return
    void fetchNextPage()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const { ref: postsSentinelRef, isSupported: postsScrollSupported } = useInfiniteScroll({
    onLoadMore: handleLoadMore,
    enabled: Boolean(hasNextPage),
  })

  useEffect(() => {
    if (activeBoardId && !boards.some((board) => board.id === activeBoardId)) {
      setActiveBoardId(null)
    }
  }, [boards, activeBoardId])

  const activeBoard = boards.find(
    (board) => board.id === activeBoardId,
  )

  const boardsErrorMessage = boardsError ? getErrorMessage(boardsError) : null

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
      <Radio.Group
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as 'latest' | 'hot')}
        buttonStyle="solid"
        size="small"
      >
        <Radio.Button value="latest">最新</Radio.Button>
        <Radio.Button value="hot">热门</Radio.Button>
      </Radio.Group>
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
              {boardsLoading ? (
                <BoardSkeletonList count={5} />
              ) : boardsErrorMessage ? (
                <ErrorState message={boardsErrorMessage} onRetry={refetchBoards} />
              ) : boards.length === 0 ? (
                <EmptyState
                  title="No boards"
                  description="No boards available."
                />
              ) : (
                <BoardList
                  boards={boards}
                  activeBoardId={activeBoardId}
                  onSelect={setActiveBoardId}
                />
              )}
            </SectionCard>
          </Col>

          {/* Main Feed */}
          <Col xs={24} md={18} lg={13}>
            <SectionCard 
              title={
                sortBy === 'hot'
                  ? 'Hot Posts'
                  : activeBoard
                    ? 'Board Posts'
                    : 'Latest Posts'
              }
              actions={renderFeedHeader()}
            >
              {postsLoading ? (
                <PostSkeletonList count={4} />
              ) : postsErrorMessage ? (
                <ErrorState message={postsErrorMessage} onRetry={refetchPosts} />
              ) : posts.length === 0 ? (
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
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                  {isFetchingNextPage && (
                    <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.45)', padding: '8px 0' }}>
                      Loading more...
                    </div>
                  )}
                  {hasNextPage && <div ref={postsSentinelRef} style={{ height: 1 }} />}
                  {!postsScrollSupported && hasNextPage && (
                    <div style={{ textAlign: 'center' }}>
                      <Button onClick={handleLoadMore}>加载更多</Button>
                    </div>
                  )}
                  {!hasNextPage && posts.length > 0 && (
                    <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.35)', padding: '8px 0' }}>
                      已经到底了
                    </div>
                  )}
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
