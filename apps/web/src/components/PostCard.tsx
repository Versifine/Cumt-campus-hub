import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AttachmentItem, PostItem } from '../api/posts'
import { clearVote, votePost } from '../api/posts'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { formatRelativeTimeUTC8 } from '../utils/time'
import { extractMediaFromContent, type MediaItem } from '../utils/media'
import InlineAvatar from './InlineAvatar'
import MediaViewer from './MediaViewer'

type PostCardProps = {
  post: PostItem
}

type VoteState = -1 | 0 | 1
type VoteAction = 1 | -1

const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])
const videoExtensions = new Set(['mp4', 'webm', 'ogg'])

const getFileExtension = (filename: string) => {
  const parts = filename.split('.')
  if (parts.length < 2) {
    return ''
  }
  return parts[parts.length - 1].toLowerCase()
}

const getAttachmentKind = (attachment: AttachmentItem) => {
  const ext = getFileExtension(attachment.filename)
  if (imageExtensions.has(ext)) {
    return 'image'
  }
  if (videoExtensions.has(ext)) {
    return 'video'
  }
  return 'file'
}

const getBoardName = (post: PostItem) => {
  const record = post as PostItem & {
    board?: { name?: string }
    board_name?: string
  }
  const boardName = record.board?.name ?? record.board_name
  if (!boardName || typeof boardName !== 'string') {
    return null
  }
  const trimmed = boardName.trim()
  return trimmed.length > 0 ? trimmed : null
}

const getCommentCount = (post: PostItem) => {
  const record = post as PostItem & {
    comment_count?: number
    comments?: number
    reply_count?: number
  }
  const count = record.comment_count ?? record.comments ?? record.reply_count
  return typeof count === 'number' ? count : 0
}

// 智能模糊背景图片组件
type SmartMediaProps = {
  item: MediaItem
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void
}

const SmartMedia = ({ item, onClick }: SmartMediaProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [needsBg, setNeedsBg] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const checkNeedsBg = useCallback((img: HTMLImageElement) => {
    const container = containerRef.current
    if (!container || !img.naturalWidth || !img.naturalHeight) {
      return
    }
    // 计算图片在 max-height 限制下的显示宽度
    const containerWidth = container.clientWidth
    const maxHeight = 512
    const displayHeight = Math.min(img.naturalHeight, maxHeight)
    const displayWidth = (displayHeight / img.naturalHeight) * img.naturalWidth
    // 如果图片显示宽度小于容器宽度的 85%，需要模糊背景
    setNeedsBg(displayWidth < containerWidth * 0.85)
  }, [])

  if (item.type === 'video') {
    return (
      <div className="post-card__media-inner" ref={containerRef}>
        <video src={item.url} controls preload="metadata" />
      </div>
    )
  }

  return (
    <div
      className={`post-card__media-inner ${needsBg ? 'needs-bg' : ''}`}
      ref={containerRef}
      onClick={onClick}
    >
      {needsBg && loaded ? (
        <div
          className="post-card__media-bg"
          style={{ backgroundImage: `url(${item.url})` }}
        />
      ) : null}
      <img
        src={item.url}
        alt={item.alt ?? 'media'}
        loading="lazy"
        onLoad={(e) => {
          setLoaded(true)
          checkNeedsBg(e.currentTarget)
        }}
      />
    </div>
  )
}

const normalizeVote = (value: number | undefined): VoteState => {
  if (value === 1) {
    return 1
  }
  if (value === -1) {
    return -1
  }
  return 0
}

const PostCard = ({ post }: PostCardProps) => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const timeLabel = formatRelativeTimeUTC8(post.created_at)
  const boardName = getBoardName(post)
  const authorAvatar = (post.author as { avatar_url?: string | null }).avatar_url ?? null
  const commentCount = getCommentCount(post)
  const baseScore = typeof post.score === 'number' ? post.score : 0
  const baseVote = normalizeVote(post.my_vote)
  const content = post.content?.trim()
  const inlineMedia = extractMediaFromContent(post.content_json)
  const primaryInline = inlineMedia[0]
  const attachments = post.attachments ?? []

  // Build media list for viewer
  const mediaItems: MediaItem[] = primaryInline
    ? inlineMedia
    : attachments
        .map((att) => {
          const kind = getAttachmentKind(att)
          if (kind === 'file') return null
          return {
            type: kind,
            url: att.url,
            alt: att.filename,
            width: att.width,
            height: att.height,
          } as MediaItem
        })
        .filter((item): item is MediaItem => item !== null)

  const [vote, setVote] = useState<VoteState>(baseVote)
  const [score, setScore] = useState(baseScore)
  const [shareLabel, setShareLabel] = useState('分享')
  const [pending, setPending] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)
  const [previewIndex, setPreviewIndex] = useState(0)

  useEffect(() => {
    setVote(baseVote)
    setScore(baseScore)
  }, [baseVote, baseScore, post.id])

  const metaItems = [timeLabel].filter(
    (item): item is string => Boolean(item),
  )

  const navigateToPost = () => {
    navigate(`/post/${post.id}`)
  }

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      navigateToPost()
    }
  }

  const stopCardNavigation = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const stopCardPropagation = (
    event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>,
  ) => {
    event.stopPropagation()
  }

  const handleVote = (nextVote: VoteAction) => async (
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    stopCardNavigation(event)
    setHint(null)

    if (!user) {
      setHint('请先登录后再投票')
      return
    }

    if (pending) {
      return
    }

    setPending(true)

    try {
      const response =
        nextVote === vote
          ? await clearVote(post.id)
          : await votePost(post.id, nextVote)

      setVote(normalizeVote(response.my_vote))
      setScore(response.score)
    } catch (error) {
      setHint(getErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  const handleComment = (event: MouseEvent<HTMLButtonElement>) => {
    stopCardNavigation(event)
    navigateToPost()
  }

  const handleAuthorClick = (event: MouseEvent<HTMLButtonElement>) => {
    stopCardNavigation(event)
    navigate(`/u/${post.author.id}`)
  }

  const handleShare = async (event: MouseEvent<HTMLButtonElement>) => {
    stopCardNavigation(event)

    const url = new URL(`/post/${post.id}`, window.location.origin).toString()

    try {
      await navigator.clipboard.writeText(url)
      setShareLabel('已复制')
    } catch {
      setShareLabel('复制失败')
    } finally {
      window.setTimeout(() => setShareLabel('分享'), 1500)
    }
  }

  const handleMediaClick = (event: MouseEvent<HTMLDivElement>) => {
    stopCardNavigation(event)
    if (mediaItems.length > 0) {
      setViewerIndex(previewIndex)
      setViewerOpen(true)
    }
  }

  const handlePrevMedia = (event: MouseEvent<HTMLButtonElement>) => {
    stopCardNavigation(event)
    setPreviewIndex((prev) => (prev - 1 + mediaItems.length) % mediaItems.length)
  }

  const handleNextMedia = (event: MouseEvent<HTMLButtonElement>) => {
    stopCardNavigation(event)
    setPreviewIndex((prev) => (prev + 1) % mediaItems.length)
  }

  return (
    <article
      className="post-card"
      role="link"
      tabIndex={0}
      aria-label={post.title}
      onClick={navigateToPost}
      onKeyDown={handleCardKeyDown}
    >
      <div className="post-card__body">
        <div className="post-card__top">
          <h3 className="post-card__title">{post.title}</h3>
          <details className="action-menu post-card__menu">
            <summary
              className="action-menu__trigger"
              aria-label="更多操作"
              onClick={stopCardPropagation}
              onKeyDown={stopCardPropagation}
            >
              ...
            </summary>
            <div className="action-menu__panel" role="menu" onClick={stopCardPropagation}>
              <span className="action-menu__empty">暂无操作</span>
            </div>
          </details>
        </div>
        <div className="post-card__meta">
          <span className="post-card__meta-item">
            <button
              type="button"
              className="post-card__meta-button"
              onClick={handleAuthorClick}
            >
              <InlineAvatar name={post.author.nickname} src={authorAvatar} size={28} />
              <span>{post.author.nickname}</span>
            </button>
          </span>
          {metaItems.map((item, index) => (
            <span key={`${item}-${index}`} className="post-card__meta-item">
              {item}
            </span>
          ))}
          {boardName ? <span className="post-card__badge">{boardName}</span> : null}
        </div>
        {content ? <p className="post-card__content">{content}</p> : null}
        {mediaItems.length > 0 ? (
          <div className="post-card__media-carousel">
            <div className="post-card__media">
              <SmartMedia item={mediaItems[previewIndex]} onClick={handleMediaClick} />
            </div>
            {mediaItems.length > 1 ? (
              <>
                <button
                  type="button"
                  className="post-card__carousel-btn post-card__carousel-btn--prev"
                  onClick={handlePrevMedia}
                  aria-label="上一张"
                >
                  {'<'}
                </button>
                <button
                  type="button"
                  className="post-card__carousel-btn post-card__carousel-btn--next"
                  onClick={handleNextMedia}
                  aria-label="下一张"
                >
                  {'>'}
                </button>
                <div className="post-card__carousel-indicator">
                  {previewIndex + 1} / {mediaItems.length}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
        <div className="post-card__actions">
          <div className="post-card__vote-group" aria-label="点赞与点踩">
            <button
              type="button"
              className={vote === 1 ? 'post-card__vote-btn is-active' : 'post-card__vote-btn'}
              onClick={handleVote(1)}
              aria-pressed={vote === 1}
              disabled={pending}
            >
              赞
            </button>
            <span className="post-card__vote-score" aria-label={`分值 ${score}`}>
              {score}
            </span>
            <button
              type="button"
              className={vote === -1 ? 'post-card__vote-btn is-active' : 'post-card__vote-btn'}
              onClick={handleVote(-1)}
              aria-pressed={vote === -1}
              disabled={pending}
            >
              踩
            </button>
          </div>
          <button type="button" className="post-card__action" onClick={handleComment}>
            评论
            <span className="post-card__action-count">{commentCount}</span>
          </button>
          <button type="button" className="post-card__action" onClick={handleShare}>
            {shareLabel}
          </button>
        </div>
        {hint ? <div className="post-card__hint">{hint}</div> : null}
      </div>
      <MediaViewer
        items={mediaItems}
        open={viewerOpen}
        startIndex={viewerIndex}
        onClose={() => setViewerOpen(false)}
      />
    </article>
  )
}

export default PostCard
