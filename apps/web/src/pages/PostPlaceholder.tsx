import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { 
  Layout, 
  Card, 
  Avatar, 
  Button, 
  Space, 
  Tag, 
  Typography, 
  Image, 
  message, 
  Dropdown,
  Popconfirm,
  theme,
  Alert
} from 'antd'
import { useQuery } from '@tanstack/react-query'
import { 
  LikeOutlined, 
  LikeFilled, 
  DislikeOutlined, 
  DislikeFilled, 
  ShareAltOutlined,
  MoreOutlined,
  UserOutlined,
  MessageOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { getErrorMessage } from '../api/client'
import { uploadInlineImage } from '../api/uploads'
import {
  createComment,
  clearCommentVote,
  clearVote,
  deleteComment,
  deletePost,
  fetchComments,
  fetchPostDetail,
  votePost,
  voteComment,
  type CommentItem,
  type PostDetail,
} from '../api/posts'
import { RichContent, RichEditor, type RichEditorHandle, type RichEditorValue } from '../components/rich-editor'
import SiteHeader from '../components/SiteHeader'
import { ErrorState } from '../components/StateBlocks'
import ReportModal from '../components/ReportModal'
import { useAuth } from '../context/useAuth'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'
import { extractMediaFromContent, normalizeMediaFromAttachments } from '../utils/media'
import { clearDraft, loadDraft, saveDraft } from '../utils/drafts'
import { formatRelativeTimeUTC8 } from '../utils/time'

const { Content } = Layout
const { Title, Text } = Typography

type LoadState<T> = {
  data: T
  loading: boolean
  error: string | null
}

const normalizeVote = (value: number | undefined) => value === 1 ? 1 : value === -1 ? -1 : 0
const draftKeyPrefix = 'draft:comment:'
const commentBatchSize = 8

type ThreadedComment = CommentItem & {
  children: ThreadedComment[]
}

const buildCommentTree = (comments: CommentItem[]) => {
  const map = new Map<string, ThreadedComment>()
  const roots: ThreadedComment[] = []

  // First pass: create nodes
  comments.forEach(c => {
    map.set(c.id, { ...c, children: [] })
  })

  // Second pass: link nodes
  comments.forEach(c => {
    const node = map.get(c.id)
    if (!node) return

    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  const sortAsc = (a: ThreadedComment, b: ThreadedComment) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  const sortDesc = (a: ThreadedComment, b: ThreadedComment) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

  const sortRecursive = (nodes: ThreadedComment[], depth = 0) => {
    nodes.sort(depth === 0 ? sortDesc : sortAsc)
    nodes.forEach(n => sortRecursive(n.children, depth + 1))
  }

  sortRecursive(roots)
  return roots
}

// Extracted Comment Form Component
type CommentFormProps = {
  onSubmit: (content: RichEditorValue) => Promise<void>
  onCancel?: () => void
  draftId: string
  autoFocus?: boolean
  placeholder?: string
  submitLabel?: string
}

const CommentForm = ({ onSubmit, onCancel, draftId, autoFocus, placeholder, submitLabel = 'Comment' }: CommentFormProps) => {
  const { user } = useAuth()
  const { token } = theme.useToken()
  const editorRef = useRef<RichEditorHandle | null>(null)
  
  const [value, setValue] = useState<RichEditorValue>({ json: null, text: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load draft
  useEffect(() => {
    const draft = loadDraft<any>(draftId)
    if (draft) {
      setValue(draft.data.content)
    }
  }, [draftId])

  // Save draft
  useEffect(() => {
    const hasDraft = value.text.trim() || value.json
    if (hasDraft) {
      const timer = setTimeout(() => {
        saveDraft(draftId, { content: value })
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [value, draftId])

  // Focus on mount if requested
  useEffect(() => {
    if (autoFocus) {
      // Small delay to ensure editor is ready
      setTimeout(() => editorRef.current?.focus(), 50)
    }
  }, [autoFocus])

  const handleSubmit = async () => {
    if (!user) return
    const hasText = value.text.trim()
    if (!hasText && !value.json) return message.warning('请输入内容')

    setSubmitting(true)
    setError(null)
    try {
      const uploadRes = await editorRef.current?.flushUploads()
      if (uploadRes?.failed) throw new Error('图片上传失败')
      
      const contentToSubmit = {
        ...value,
        json: uploadRes?.json ?? value.json
      }

      await onSubmit(contentToSubmit)
      
      // Cleanup
      setValue({ json: null, text: '' })
      clearDraft(draftId)
      editorRef.current?.setContent(null)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) {
    return (
      <div style={{ padding: 16, background: token.colorFillQuaternary, borderRadius: 8, textAlign: 'center' }}>
        <Text type="secondary">请先 <Link to="/login">登录</Link> 后参与讨论</Text>
      </div>
    )
  }

  return (
    <div style={{ background: token.colorFillQuaternary, padding: 12, borderRadius: 8 }}>
      <RichEditor
        ref={editorRef}
        value={value}
        onChange={setValue}
        onImageUpload={(file) => uploadInlineImage(file)}
        deferredUpload
        placeholder={placeholder}
        disabled={submitting}
        variant="comment"
      />
      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <Space>
          {onCancel && (
            <Button disabled={submitting} onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button 
            type="primary" 
            onClick={handleSubmit} 
            loading={submitting}
          >
            {submitLabel}
          </Button>
        </Space>
      </div>
      {error && <Alert type="error" message={error} style={{ marginTop: 8 }} />}
    </div>
  )
}

const PostPlaceholder = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { token } = theme.useToken()

  const [state, setState] = useState<LoadState<PostDetail | null>>({
    data: null,
    loading: true,
    error: null,
  })
  const {
    data: commentsData,
    isLoading: commentsLoading,
    error: commentsError,
    refetch: refetchComments,
  } = useQuery({
    queryKey: ['comments', id],
    queryFn: () => fetchComments(id ?? ''),
    enabled: Boolean(id),
  })
  const comments = useMemo(() => commentsData ?? [], [commentsData])
  const commentsErrorMessage = commentsError ? getErrorMessage(commentsError) : null
  
  // Active reply target ID (null means no active reply)
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null)

  const [postVote, setPostVote] = useState(0)
  const [postScore, setPostScore] = useState(0)
  const [postVotePending, setPostVotePending] = useState(false)

  const [commentVotes, setCommentVotes] = useState<Record<string, number>>({})
  const [commentScores, setCommentScores] = useState<Record<string, number>>({})
  const [commentVotePending, setCommentVotePending] = useState<Record<string, boolean>>({})

  const [visibleRootCount, setVisibleRootCount] = useState(commentBatchSize)

  // Report Modal State
  const [reportModal, setReportModal] = useState<{
    visible: boolean
    targetType: 'post' | 'comment'
    targetId: string
  }>({
    visible: false,
    targetType: 'post',
    targetId: '',
  })

  useEffect(() => {
    const voteMap: Record<string, number> = {}
    const scoreMap: Record<string, number> = {}
    comments.forEach((comment) => {
      voteMap[comment.id] = normalizeVote(comment.my_vote)
      scoreMap[comment.id] = comment.score || 0
    })
    setCommentVotes(voteMap)
    setCommentScores(scoreMap)
  }, [comments])

  useEffect(() => {
    setVisibleRootCount(commentBatchSize)
  }, [comments])

  const threadedComments = useMemo(() => buildCommentTree(comments), [comments])
  const visibleComments = useMemo(
    () => threadedComments.slice(0, visibleRootCount),
    [threadedComments, visibleRootCount],
  )
  const hasMoreComments = threadedComments.length > visibleRootCount

  const handleLoadMoreComments = useCallback(() => {
    if (!hasMoreComments) return
    setVisibleRootCount((prev) => Math.min(prev + commentBatchSize, threadedComments.length))
  }, [hasMoreComments, threadedComments.length])

  const { ref: commentsSentinelRef, isSupported: commentsScrollSupported } = useInfiniteScroll({
    onLoadMore: handleLoadMoreComments,
    enabled: hasMoreComments,
  })

  // Media calculations
  const postInlineMedia = useMemo(() => state.data ? extractMediaFromContent(state.data.content_json) : [], [state.data])
  const postAttachmentMedia = useMemo(() => state.data ? normalizeMediaFromAttachments(state.data.attachments) : [], [state.data])
  const postExtraMedia = useMemo(() => {
     const inlineUrls = new Set(postInlineMedia.map(item => item.url))
     return postAttachmentMedia.filter(item => !inlineUrls.has(item.url))
  }, [postAttachmentMedia, postInlineMedia])

  // Data Loading
  const loadPost = useCallback(async () => {
    if (!id) return
    setState(prev => ({ ...prev, loading: true }))
    try {
      const data = await fetchPostDetail(id)
      setPostVote(normalizeVote(data.my_vote))
      setPostScore(data.score || 0)
      setState({ data, loading: false, error: null })
    } catch (error) {
      setState({ data: null, loading: false, error: getErrorMessage(error) })
    }
  }, [id])

  useEffect(() => {
    loadPost()
  }, [loadPost])

  // Actions
  const handlePostVote = async (nextVote: number) => {
    if (!user) return message.info('请先登录')
    if (postVotePending || !id) return
    setPostVotePending(true)
    try {
      const res = postVote === nextVote ? await clearVote(id) : await votePost(id, nextVote as 1 | -1)
      setPostVote(normalizeVote(res.my_vote))
      setPostScore(res.score)
    } catch (e) {
      message.error(getErrorMessage(e))
    } finally {
      setPostVotePending(false)
    }
  }

  const handleCommentVote = async (commentId: string, nextVote: number) => {
    if (!user) return message.info('请先登录')
    if (commentVotePending[commentId] || !id) return
    
    setCommentVotePending(prev => ({ ...prev, [commentId]: true }))
    try {
      const current = commentVotes[commentId]
      const res = current === nextVote 
        ? await clearCommentVote(id, commentId)
        : await voteComment(id, commentId, nextVote as 1 | -1)
      
      setCommentVotes(prev => ({ ...prev, [commentId]: normalizeVote(res.my_vote) }))
      setCommentScores(prev => ({ ...prev, [commentId]: res.score }))
    } catch (e) {
      message.error(getErrorMessage(e))
    } finally {
      setCommentVotePending(prev => ({ ...prev, [commentId]: false }))
    }
  }

  const handleCreateComment = async (content: RichEditorValue, parentId?: string) => {
    if (!id) return
    await createComment(id, {
      content: content.text.trim(),
      content_json: content.json,
      parent_id: parentId ?? null,
    })
    
    // Refresh comments and close reply box if applicable
    await refetchComments()
    if (parentId) {
      setActiveReplyId(null)
    }
    message.success('评论成功')
  }

  const handleDeletePost = async () => {
    if (!id) return
    try {
      await deletePost(id)
      message.success('已删除')
      navigate('/')
    } catch (e) {
      message.error(getErrorMessage(e))
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!id) return
    try {
      await deleteComment(id, commentId)
      message.success('已删除')
      void refetchComments()
    } catch (e) {
      message.error(getErrorMessage(e))
    }
  }

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      message.success('链接已复制')
    } catch {
      message.error('复制失败')
    }
  }

  const handleOpenReport = (type: 'post' | 'comment', id: string) => {
    if (!user) {
      message.info('请先登录')
      return
    }
    setReportModal({
      visible: true,
      targetType: type,
      targetId: id,
    })
  }

  const renderCommentNode = (item: ThreadedComment) => {
    const isSelf = user && item.author.id === user.id
    const isOP = state.data && item.author.id === state.data.author.id
    const hasChildren = item.children.length > 0
    const isReplying = activeReplyId === item.id

    return (
      <div key={item.id} style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {/* Left Column: Avatar & Thread Line */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Avatar 
              src={item.author.avatar_url ?? (item.author as any).avatar} 
              icon={<UserOutlined />} 
              size={28}
              style={{ backgroundColor: isOP ? token.colorPrimary : undefined, flexShrink: 0 }}
            >
              {item.author.nickname?.[0]?.toUpperCase()}
            </Avatar>
            {hasChildren && (
              <div 
                style={{ 
                  width: 2, 
                  flex: 1, 
                  backgroundColor: token.colorBorderSecondary, 
                  marginTop: 8,
                  marginBottom: 8,
                  borderRadius: 1
                }} 
              />
            )}
          </div>

          {/* Right Column: Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Meta Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text strong style={{ fontSize: '0.9rem' }}>{item.author.nickname}</Text>
              {isOP && <Tag color="blue" bordered={false} style={{ margin: 0, fontSize: '0.75rem', lineHeight: '18px' }}>OP</Tag>}
              <Text type="secondary" style={{ fontSize: '0.8rem' }}>· {formatRelativeTimeUTC8(item.created_at)}</Text>
            </div>

            {/* Content Body */}
            <div style={{ fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 6 }}>
              <RichContent contentJson={item.content_json} contentText={item.content} variant="comment" />
            </div>

            {/* Action Bar */}
            <Space size={4}>
              <Button 
                type="text" 
                size="small" 
                icon={commentVotes[item.id] === 1 ? <LikeFilled style={{ color: token.colorPrimary }} /> : <LikeOutlined />}
                style={{ 
                  color: commentVotes[item.id] === 1 ? token.colorPrimary : token.colorTextSecondary,
                  fontSize: '0.8rem',
                  padding: '0 8px' 
                }}
                onClick={() => handleCommentVote(item.id, 1)}
              >
                {commentScores[item.id] || 'Vote'}
              </Button>
              <Button 
                type="text" 
                size="small" 
                icon={commentVotes[item.id] === -1 ? <DislikeFilled style={{ color: token.colorPrimary }} /> : <DislikeOutlined />}
                style={{ 
                  color: commentVotes[item.id] === -1 ? token.colorPrimary : token.colorTextSecondary,
                  fontSize: '0.8rem',
                  padding: '0 8px'
                }}
                onClick={() => handleCommentVote(item.id, -1)}
              />
              <Button 
                type="text" 
                size="small" 
                icon={<MessageOutlined />} 
                style={{ color: token.colorTextSecondary, fontSize: '0.8rem', padding: '0 8px' }}
                onClick={() => setActiveReplyId(isReplying ? null : item.id)}
              >
                Reply
              </Button>
              {isSelf && (
                <Popconfirm title="确定删除?" onConfirm={() => handleDeleteComment(item.id)}>
                  <Button type="text" danger size="small" style={{ fontSize: '0.8rem', padding: '0 8px' }}>Delete</Button>
                </Popconfirm>
              )}
              {!isSelf && (
                <Button 
                  type="text" 
                  size="small" 
                  style={{ color: token.colorTextDescription, fontSize: '0.8rem', padding: '0 8px' }}
                  onClick={() => handleOpenReport('comment', item.id)}
                >
                  举报
                </Button>
              )}
            </Space>

            {/* Inline Reply Form */}
            {isReplying && (
              <div style={{ marginTop: 12 }}>
                <CommentForm
                  onSubmit={(val) => handleCreateComment(val, item.id)}
                  onCancel={() => setActiveReplyId(null)}
                  draftId={`${draftKeyPrefix}${id}:reply:${item.id}`}
                  autoFocus
                  placeholder={`Reply to ${item.author.nickname}...`}
                  submitLabel="Reply"
                />
              </div>
            )}
          </div>
        </div>

        {/* Nested Children */}
        {hasChildren && (
          <div style={{ paddingLeft: 34 }}>{/* 28px(avatar) + 6px(gap) roughly */}
            {item.children.map(child => renderCommentNode(child))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <SiteHeader />
      <Content style={{ maxWidth: 840, margin: '24px auto', width: '100%', padding: '0 24px' }}>
        <Button type="text" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
          ← 返回
        </Button>

        {state.loading ? (
          <Card loading />
        ) : state.error ? (
          <ErrorState message={state.error} onRetry={loadPost} />
        ) : state.data && (
          <Card 
            bordered={false} 
            style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
            bodyStyle={{ padding: '24px 32px' }}
          >
             {/* Header */}
            <div style={{ marginBottom: 20 }}>
               <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                 <Title level={3} style={{ margin: 0 }}>{state.data.title}</Title>
                 <Dropdown 
                   menu={{ 
                     items: [
                       ...(user && state.data.author.id === user.id ? [{ 
                         key: 'del', 
                         label: '删除帖子', 
                         danger: true, 
                         onClick: handleDeletePost 
                       }] : []),
                       ...(user && state.data.author.id !== user.id ? [{
                         key: 'report',
                         label: '举报帖子',
                         icon: <WarningOutlined />,
                         onClick: () => handleOpenReport('post', state.data!.id)
                       }] : [])
                     ] 
                   }}
                 >
                   <Button type="text" icon={<MoreOutlined />} />
                 </Dropdown>
               </Space>
               
                <Space style={{ marginTop: 12 }}>
                  <Avatar src={state.data.author.avatar_url ?? (state.data.author as any).avatar} icon={<UserOutlined />} />
                 <Text strong>{state.data.author.nickname}</Text>
                 <Text type="secondary">· {formatRelativeTimeUTC8(state.data.created_at)}</Text>
                 <Tag>{state.data.board?.name}</Tag>
               </Space>
            </div>

            {/* Content */}
            <div style={{ fontSize: '1.05rem', lineHeight: 1.7, marginBottom: 24 }}>
              <RichContent contentJson={state.data.content_json} contentText={state.data.content} />
            </div>

            {/* Extra Media Gallery */}
            {postExtraMedia.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <Image.PreviewGroup>
                  <Space wrap size={8}>
                    {postExtraMedia.map((media, i) => (
                      <Image 
                        key={i}
                        src={media.url}
                        width={120}
                        height={120}
                        style={{ objectFit: 'cover', borderRadius: 8 }}
                      />
                    ))}
                  </Space>
                </Image.PreviewGroup>
              </div>
            )}

            {/* Actions */}
            <Space size="large" style={{ marginTop: 16, borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 16, width: '100%' }}>
              <Button 
                type="text" 
                size="large"
                icon={postVote === 1 ? <LikeFilled style={{ color: token.colorPrimary }} /> : <LikeOutlined />}
                onClick={() => handlePostVote(1)}
              >
                {postScore}
              </Button>
              <Button 
                type="text" 
                size="large"
                icon={postVote === -1 ? <DislikeFilled style={{ color: token.colorPrimary }} /> : <DislikeOutlined />}
                onClick={() => handlePostVote(-1)}
              />
              <Button type="text" size="large" icon={<MessageOutlined />}>
                {comments.length}
              </Button>
              <Button type="text" size="large" icon={<ShareAltOutlined />} onClick={handleShare}>
                分享
              </Button>
            </Space>

            {/* Comments Section */}
            <div style={{ marginTop: 40 }}>
              <div style={{ marginBottom: 24 }}>
                <Title level={5}>评论 ({comments.length})</Title>
                {/* Main Comment Form */}
                <div style={{ marginTop: 16 }}>
                  <CommentForm
                    onSubmit={(val) => handleCreateComment(val)}
                    draftId={`${draftKeyPrefix}${id}:main`}
                    placeholder={user ? "写下你的评论..." : "请先登录"}
                    submitLabel="Post Comment"
                  />
                </div>
              </div>

              {/* Comment List */}
              {commentsLoading ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: token.colorTextSecondary }}>
                  Loading discussion...
                </div>
              ) : commentsErrorMessage ? (
                <ErrorState message={commentsErrorMessage} onRetry={refetchComments} />
              ) : comments.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: token.colorTextSecondary }}>
                  No comments yet. Be the first to share what you think!
                </div>
              ) : (
                <div style={{ marginBottom: 48 }}>
                  {visibleComments.map((node) => renderCommentNode(node))}
                  {hasMoreComments && <div ref={commentsSentinelRef} style={{ height: 1 }} />}
                  {!commentsScrollSupported && hasMoreComments && (
                    <div style={{ textAlign: 'center', marginTop: 16 }}>
                      <Button onClick={handleLoadMoreComments}>加载更多评论</Button>
                    </div>
                  )}
                  {!hasMoreComments && threadedComments.length > 0 && (
                    <div style={{ textAlign: 'center', color: token.colorTextSecondary, marginTop: 16 }}>
                      已经到底了
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}
        {/* Report Modal */}
        <ReportModal
          visible={reportModal.visible}
          targetType={reportModal.targetType}
          targetId={reportModal.targetId}
          onClose={() => setReportModal(prev => ({ ...prev, visible: false }))}
        />
      </Content>
    </Layout>
  )
}

export default PostPlaceholder
