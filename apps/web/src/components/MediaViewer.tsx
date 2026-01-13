import { useEffect, useRef } from 'react'
import { PhotoSlider } from 'react-photo-view'
import 'react-photo-view/dist/react-photo-view.css'
import type { MediaItem } from '../utils/media'

type MediaViewerProps = {
  items: MediaItem[]
  open: boolean
  startIndex?: number
  onClose: () => void
}

const MediaViewer = ({ items, open, startIndex = 0, onClose }: MediaViewerProps) => {
  const indexRef = useRef(startIndex)

  useEffect(() => {
    if (open) {
      indexRef.current = startIndex
    }
  }, [open, startIndex])

  if (items.length === 0) {
    return null
  }

  const images = items
    .filter((item) => item.type === 'image')
    .map((item) => ({
      src: item.url,
      key: item.url,
    }))

  return (
    <PhotoSlider
      images={images}
      visible={open}
      onClose={onClose}
      index={indexRef.current}
      onIndexChange={(i) => {
        indexRef.current = i
      }}
      maskOpacity={0.9}
      toolbarRender={({ rotate, onRotate, onScale, scale, index }) => (
        <div className="media-viewer-toolbar">
          <span className="media-viewer-toolbar__index">
            {index + 1} / {images.length}
          </span>
          <div className="media-viewer-toolbar__actions">
            <button
              type="button"
              className="media-viewer-toolbar__btn"
              onClick={() => onScale(scale + 0.5)}
              title="放大"
            >
              +
            </button>
            <button
              type="button"
              className="media-viewer-toolbar__btn"
              onClick={() => onScale(scale - 0.5)}
              title="缩小"
            >
              −
            </button>
            <button
              type="button"
              className="media-viewer-toolbar__btn"
              onClick={() => onRotate(rotate + 90)}
              title="旋转"
            >
              ↻
            </button>
            <a
              className="media-viewer-toolbar__btn"
              href={items[index]?.url}
              target="_blank"
              rel="noreferrer"
              title="在新标签页打开"
            >
              ↗
            </a>
          </div>
        </div>
      )}
    />
  )
}

export default MediaViewer
