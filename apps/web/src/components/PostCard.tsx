import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Card, 
  Avatar, 
  Typography, 
  Button, 
  Space, 
  Tag, 
  Image, 
  message, 
  Dropdown,
  Carousel,
  theme
} from 'antd'
import { 
  LikeOutlined, 
  LikeFilled, 
  DislikeOutlined, 
  DislikeFilled, 
  MessageOutlined, 
  ShareAltOutlined, 
  MoreOutlined, 
  UserOutlined,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons'
import type { AttachmentItem, PostItem } from '../api/posts'
import { clearVote, votePost } from '../api/posts'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { formatRelativeTimeUTC8 } from '../utils/time'
import { extractMediaFromContent, type MediaItem } from '../utils/media'

const { Text, Title, Paragraph } = Typography

type PostCardProps = {
  post: PostItem
}

type VoteState = -1 | 0 | 1
type VoteAction = 1 | -1

const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])
const videoExtensions = new Set(['mp4', 'webm', 'ogg'])

const getFileExtension = (filename: string) => {
  const parts = filename.split('.')
  if (parts.length < 2) return ''
  return parts[parts.length - 1].toLowerCase()
}

const getAttachmentKind = (attachment: AttachmentItem) => {
  const ext = getFileExtension(attachment.filename)
  if (imageExtensions.has(ext)) return 'image'
  if (videoExtensions.has(ext)) return 'video'
  return 'file'
}

const getBoardName = (post: PostItem) => {
  const record = post as any
  const boardName = record.board?.name ?? record.board_name
  return boardName?.trim() || null
}

const normalizeVote = (value: number | undefined): VoteState => {
  if (value === 1) return 1
  if (value === -1) return -1
  return 0
}

const PostCard = ({ post }: PostCardProps) => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { token } = theme.useToken()
  
  const timeLabel = formatRelativeTimeUTC8(post.created_at)
  const boardName = getBoardName(post)
  const authorAvatar = (post.author as any).avatar_url ?? null
  const commentCount = (post as any).comment_count ?? (post as any).comments ?? 0
  
  const content = post.content?.trim()
  const inlineMedia = extractMediaFromContent(post.content_json)
  const attachments = post.attachments ?? []

  // Build media list
  const mediaItems: MediaItem[] = inlineMedia.length > 0 
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

  const [vote, setVote] = useState<VoteState>(normalizeVote(post.my_vote))
  const [score, setScore] = useState(post.score ?? 0)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setVote(normalizeVote(post.my_vote))
    setScore(post.score ?? 0)
  }, [post.my_vote, post.score, post.id])

  const handleVote = (nextVote: VoteAction) => async (e: MouseEvent) => {
    e.stopPropagation()
    if (!user) {
      message.info('请先登录')
      return
    }
    if (pending) return
    setPending(true)
    try {
      const response = nextVote === vote 
        ? await clearVote(post.id) 
        : await votePost(post.id, nextVote)
      setVote(normalizeVote(response.my_vote))
      setScore(response.score)
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  const navigateToPost = () => navigate(`/post/${post.id}`)

  const handleShare = async (e: MouseEvent) => {
    e.stopPropagation()
    const url = new URL(`/post/${post.id}`, window.location.origin).toString()
    try {
      await navigator.clipboard.writeText(url)
      message.success('链接已复制')
    } catch {
      message.error('复制失败')
    }
  }

  const images = mediaItems.filter(m => m.type === 'image')

  return (
    <Card
      hoverable
      onClick={navigateToPost}
      style={{ marginBottom: 16, borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
      bodyStyle={{ padding: '20px 24px' }}
    >
      {/* Header: Author & Meta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <Space align="center" size={12} onClick={(e) => { e.stopPropagation(); navigate(`/u/${post.author.id}`) }} style={{ cursor: 'pointer' }}>
          <Avatar 
            src={authorAvatar} 
            icon={<UserOutlined />} 
            style={{ backgroundColor: token.colorPrimary }}
          >
            {post.author.nickname?.[0]?.toUpperCase()}
          </Avatar>
          <div style={{ lineHeight: 1.2 }}>
            <Text strong style={{ display: 'block' }}>{post.author.nickname}</Text>
            <Text type="secondary" style={{ fontSize: '0.8rem' }}>
              {timeLabel} · {boardName && <Tag bordered={false} style={{ marginLeft: 4 }}>{boardName}</Tag>}
            </Text>
          </div>
        </Space>
        
        <Dropdown menu={{ items: [{ key: 'report', label: '举报' }] }} trigger={['click']}>
           <Button type="text" icon={<MoreOutlined />} onClick={(e) => e.stopPropagation()} />
        </Dropdown>
      </div>

      {/* Content */}
      <div style={{ marginBottom: 12 }}>
        <Title level={4} style={{ marginTop: 0, marginBottom: 8, fontSize: '1.1rem' }}>
          {post.title}
        </Title>
        {content && (
          <Paragraph ellipsis={{ rows: 3 }} type="secondary" style={{ fontSize: '0.95rem' }}>
            {content}
          </Paragraph>
        )}
      </div>

      {/* Media Preview */}
      {images.length > 0 && (
        <div style={{ marginBottom: 16 }} onClick={(e) => e.stopPropagation()}>
          <Image.PreviewGroup>
            <Carousel 
              arrows 
              infinite={false}
              prevArrow={<Button type="text" icon={<LeftOutlined />} />}
              nextArrow={<Button type="text" icon={<RightOutlined />} />}
              style={{ 
                background: '#f5f5f5', 
                borderRadius: 8,
                overflow: 'hidden'
              }}
            >
              {images.map((img, idx) => (
                <div key={idx}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    height: 400,
                    position: 'relative'
                  }}>
                    <Image 
                      src={img.url} 
                      alt="post media"
                      style={{ maxHeight: 400, maxWidth: '100%', objectFit: 'contain' }}
                    />
                  </div>
                </div>
              ))}
            </Carousel>
          </Image.PreviewGroup>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
        <Button 
          type="text" 
          icon={vote === 1 ? <LikeFilled style={{ color: token.colorPrimary }} /> : <LikeOutlined />}
          onClick={handleVote(1)}
          style={{ color: vote === 1 ? token.colorPrimary : undefined }}
        >
          {score}
        </Button>
        <Button 
          type="text" 
          icon={vote === -1 ? <DislikeFilled style={{ color: token.colorPrimary }} /> : <DislikeOutlined />}
          onClick={handleVote(-1)}
          style={{ color: vote === -1 ? token.colorPrimary : undefined }}
        />
        <Button 
          type="text" 
          icon={<MessageOutlined />}
          onClick={(e) => { e.stopPropagation(); navigateToPost() }}
        >
          {commentCount}
        </Button>
        <Button 
          type="text" 
          icon={<ShareAltOutlined />}
          onClick={handleShare}
        >
          分享
        </Button>
      </div>
    </Card>
  )
}

export default PostCard
