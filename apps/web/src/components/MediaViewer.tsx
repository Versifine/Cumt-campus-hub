import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type TouchEvent,
} from 'react'
import type { MediaItem } from '../utils/media'

type MediaViewerProps = {
  items: MediaItem[]
  open: boolean
  startIndex?: number
  onClose: () => void
}

const clampIndex = (index: number, total: number) => {
  if (total <= 0) {
    return 0
  }
  if (index < 0) {
    return 0
  }
  if (index >= total) {
    return total - 1
  }
  return index
}

const appendCacheBuster = (url: string, token: number) => {
  if (!token) {
    return url
  }
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}t=${token}`
}

const MediaViewer = ({ items, open, startIndex = 0, onClose }: MediaViewerProps) => {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryToken, setRetryToken] = useState(0)

  const total = items.length
  const activeItem = items[activeIndex]

  const canNavigate = total > 1

  const goPrev = useCallback(() => {
    if (!canNavigate) {
      return
    }
    setActiveIndex((prev) => (prev - 1 + total) % total)
  }, [canNavigate, total])

  const goNext = useCallback(() => {
    if (!canNavigate) {
      return
    }
    setActiveIndex((prev) => (prev + 1) % total)
  }, [canNavigate, total])

  const handleClose = useCallback(() => {
    setZoomed(false)
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!open) {
      return
    }
    setActiveIndex(clampIndex(startIndex, total))
    setZoomed(false)
    setLoading(true)
    setError(false)
    setRetryToken(0)
  }, [open, startIndex, total])

  useEffect(() => {
    if (!open) {
      return
    }
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }
  const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose()
      }
      if (event.key === 'ArrowLeft') {
        goPrev()
      }
      if (event.key === 'ArrowRight') {
        goNext()
      }
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
    }
  }, [goNext, goPrev, handleClose, open])

  useEffect(() => {
    if (!open) {
      return
    }
    setLoading(true)
    setError(false)
    setZoomed(false)
    setRetryToken(0)
  }, [activeIndex, open])

  useEffect(() => {
    if (!open) {
      return
    }
    closeButtonRef.current?.focus()
  }, [open])

  const handlePanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') {
      return
    }
    const panel = panelRef.current
    if (!panel) {
      return
    }
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute('disabled'))
    if (focusable.length === 0) {
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (event.shiftKey && active === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    if (!touch) {
      return
    }
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current
    if (!start) {
      return
    }
    const touch = event.changedTouches[0]
    if (!touch) {
      touchStartRef.current = null
      return
    }
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    touchStartRef.current = null
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) {
      return
    }
    if (dx > 0) {
      goPrev()
    } else {
      goNext()
    }
  }

  const handleRetry = () => {
    setLoading(true)
    setError(false)
    setRetryToken((prev) => prev + 1)
  }

  const handleToggleZoom = () => {
    if (activeItem.type !== 'image') {
      return
    }
    setZoomed((prev) => !prev)
  }

  const sourceUrl = useMemo(
    () => appendCacheBuster(activeItem?.url ?? '', retryToken),
    [activeItem?.url, retryToken],
  )

  if (!open || total === 0 || !activeItem) {
    return null
  }

  return (
    <div className="media-viewer" role="dialog" aria-modal="true" aria-label="媒体查看">
      <div className="media-viewer__backdrop" onClick={handleClose} />
      <div
        className="media-viewer__panel"
        ref={panelRef}
        onKeyDown={handlePanelKeyDown}
      >
        <header className="media-viewer__header">
          <div className="media-viewer__meta">
            <span className="media-viewer__index">
              {activeIndex + 1} / {total}
            </span>
          </div>
          <div className="media-viewer__actions">
            <a
              className="media-viewer__link"
              href={activeItem.url}
              target="_blank"
              rel="noreferrer"
            >
              在新标签页打开
            </a>
            <button
              type="button"
              className="media-viewer__close"
              onClick={handleClose}
              ref={closeButtonRef}
            >
              关闭
            </button>
          </div>
        </header>
        <div
          className="media-viewer__body"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {canNavigate ? (
            <button
              type="button"
              className="media-viewer__nav media-viewer__nav--prev"
              onClick={goPrev}
              aria-label="上一张"
            >
              ‹
            </button>
          ) : null}
          <div
            className={
              zoomed ? 'media-viewer__stage media-viewer__stage--zoomed' : 'media-viewer__stage'
            }
            onDoubleClick={handleToggleZoom}
          >
            {!error && loading ? <div className="media-viewer__loading" /> : null}
            {error ? (
              <div className="media-viewer__error">
                <div>加载失败</div>
                <button type="button" onClick={handleRetry}>
                  重试
                </button>
              </div>
            ) : null}
            {activeItem.type === 'video' ? (
              <video
                key={sourceUrl}
                className="media-viewer__media"
                src={sourceUrl}
                controls
                preload="metadata"
                onLoadedData={() => setLoading(false)}
                onError={() => {
                  setLoading(false)
                  setError(true)
                }}
              />
            ) : (
              <img
                key={sourceUrl}
                className="media-viewer__media"
                src={sourceUrl}
                alt={activeItem.alt ?? 'media'}
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false)
                  setError(true)
                }}
              />
            )}
          </div>
          {canNavigate ? (
            <button
              type="button"
              className="media-viewer__nav media-viewer__nav--next"
              onClick={goNext}
              aria-label="下一张"
            >
              ›
            </button>
          ) : null}
        </div>
        <div className="media-viewer__hint">
          支持键盘方向键切换，双击图片放大，Esc 关闭
        </div>
      </div>
    </div>
  )
}

export default MediaViewer
