import { useCallback, useRef, useState } from 'react'

type AdaptiveImageProps = {
  src: string
  width?: number
  height?: number
  alt?: string
  maxHeight?: number
  className?: string
  onClick?: () => void
}

/**
 * AdaptiveImage 实现 Reddit 风格的自适应图片显示：
 * - 图片宽度 100%，高度按比例自适应
 * - 超高图片限制最大高度，显示模糊背景
 */
const AdaptiveImage = ({
  src,
  width,
  height,
  alt = '',
  maxHeight = 512,
  className = '',
  onClick,
}: AdaptiveImageProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [needsBg, setNeedsBg] = useState(false)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      setLoaded(true)
      setError(false)
      const img = e.currentTarget
      const imgW = img.naturalWidth
      const imgH = img.naturalHeight
      if (imgW && imgH) {
        setNaturalSize({ w: imgW, h: imgH })
        // 检查实际渲染后图片是否被裁剪（需要模糊背景）
        // 使用 requestAnimationFrame 等待布局完成
        requestAnimationFrame(() => {
          const container = containerRef.current
          if (!container) return
          // 如果容器高度被 max-height 限制了，需要模糊背景
          const containerH = container.clientHeight
          const containerW = container.clientWidth
          // 按宽度 100% 计算的理论高度
          const theoreticalH = (containerW / imgW) * imgH
          // 如果理论高度超过容器实际高度（被 max-height 限制），需要背景
          setNeedsBg(theoreticalH > containerH + 5) // 5px 容差
        })
      }
    },
    [],
  )

  const handleError = useCallback(() => {
    setLoaded(false)
    setError(true)
  }, [])

  // 计算容器样式
  const computeContainerStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {}
    const w = naturalSize?.w ?? width
    const h = naturalSize?.h ?? height

    if (w && h && w > 0 && h > 0) {
      style.aspectRatio = `${w} / ${h}`
    } else {
      style.aspectRatio = '16 / 9'
    }
    style.maxHeight = `${maxHeight}px`

    return style
  }

  const containerClass = [
    'adaptive-image',
    loaded ? 'is-loaded' : '',
    error ? 'is-error' : '',
    needsBg ? 'needs-bg' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={containerRef}
      className={containerClass}
      style={computeContainerStyle()}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {/* 模糊背景层 */}
      {needsBg && !error ? (
        <div
          className="adaptive-image__bg"
          style={{ backgroundImage: `url(${src})` }}
        />
      ) : null}

      {/* 加载中骨架屏 */}
      {!loaded && !error ? <div className="adaptive-image__skeleton" /> : null}

      {/* 错误状态 */}
      {error ? (
        <div className="adaptive-image__error">
          <span>加载失败</span>
        </div>
      ) : null}

      {/* 主图 */}
      <img
        className="adaptive-image__img"
        src={src}
        alt={alt}
        loading="lazy"
        draggable={false}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  )
}

export default AdaptiveImage
