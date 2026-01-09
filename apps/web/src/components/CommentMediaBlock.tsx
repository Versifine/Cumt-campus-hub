import { useMemo, useRef, useState, type MouseEvent } from 'react'
import type { MediaItem } from '../utils/media'
import MediaViewer from './MediaViewer'

type CommentMediaBlockProps = {
  media: MediaItem[]
  variant?: 'comment' | 'post'
}

const buildLayout = (count: number) => {
  if (count <= 1) {
    return 'single'
  }
  if (count === 2) {
    return 'two'
  }
  if (count === 3) {
    return 'three'
  }
  return 'four'
}

const appendCacheBuster = (url: string, token: number) => {
  if (!token) {
    return url
  }
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}t=${token}`
}

const CommentMediaBlock = ({ media, variant = 'comment' }: CommentMediaBlockProps) => {
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)

  const items = media ?? []
  const total = items.length
  const layout = buildLayout(total)
  const visibleItems = total > 4 ? items.slice(0, 4) : items
  const extraCount = total > 4 ? total - 4 : 0

  const handleOpen = (index: number) => {
    setViewerIndex(index)
    setViewerOpen(true)
  }

  if (total === 0) {
    return null
  }

  return (
    <div className={`media-block media-block--${variant}`}>
      <div className={`media-grid media-grid--${layout}`}>
        {visibleItems.map((item, index) => (
          <MediaThumb
            key={`${item.url}-${index}`}
            item={item}
            index={index}
            layout={layout}
            overlayCount={extraCount > 0 && index === 3 ? extraCount : 0}
            onClick={handleOpen}
          />
        ))}
      </div>
      <MediaViewer
        items={items}
        open={viewerOpen}
        startIndex={viewerIndex}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  )
}

type MediaThumbProps = {
  item: MediaItem
  index: number
  layout: string
  overlayCount: number
  onClick: (index: number) => void
}

const MediaThumb = ({ item, index, layout, overlayCount, onClick }: MediaThumbProps) => {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [retryToken, setRetryToken] = useState(0)
  const thumbRef = useRef<HTMLButtonElement>(null)

  const handleRetry = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    setError(false)
    setLoaded(false)
    setRetryToken((prev) => prev + 1)
  }

  const sourceUrl = useMemo(
    () => appendCacheBuster(item.url, retryToken),
    [item.url, retryToken],
  )

  const className = [
    'media-thumb',
    `media-thumb--${layout}`,
    `media-thumb--${index + 1}`,
    loaded ? 'is-loaded' : '',
    error ? 'is-error' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      ref={thumbRef}
      className={className}
      onClick={() => onClick(index)}
      aria-label={item.alt ? `查看 ${item.alt}` : '查看媒体'}
    >
      {!loaded && !error ? <div className="media-thumb__skeleton" /> : null}
      {error ? (
        <div className="media-thumb__error">
          <span>加载失败</span>
          <button type="button" onClick={handleRetry}>
            重试
          </button>
        </div>
      ) : null}
      {item.type === 'video' ? (
        <video
          key={sourceUrl}
          className="media-thumb__media"
          src={sourceUrl}
          muted
          playsInline
          preload="metadata"
          onLoadedData={() => setLoaded(true)}
          onError={() => {
            setLoaded(false)
            setError(true)
          }}
        />
      ) : (
        <img
          key={sourceUrl}
          className="media-thumb__media"
          src={sourceUrl}
          alt={item.alt ?? 'media'}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false)
            setError(true)
          }}
        />
      )}
      {item.type === 'video' ? <span className="media-thumb__play">视频</span> : null}
      {overlayCount > 0 ? <span className="media-thumb__overlay">+{overlayCount}</span> : null}
    </button>
  )
}

export default CommentMediaBlock
