import { useCallback, useEffect, useRef, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

type InlineImageOptions = {
  onRetry?: (uploadId: string) => void
  onRemove?: (uploadId: string) => void
  showCaption?: boolean
}

export const ImageNodeView = ({ node, extension, deleteNode, updateAttributes }: NodeViewProps) => {
  const uploadId = node.attrs.uploadId as string | null
  const uploading = Boolean(node.attrs.uploading)
  const error = Boolean(node.attrs.error)
  const caption = (node.attrs.alt as string) || ''
  const options = extension.options as InlineImageOptions
  const onRetry = options.onRetry
  const onRemove = options.onRemove
  const showCaption = options.showCaption ?? true

  const [isEditing, setIsEditing] = useState(false)
  const [captionValue, setCaptionValue] = useState(caption)
  const inputRef = useRef<HTMLInputElement>(null)

  // 同步外部 caption 变化
  useEffect(() => {
    setCaptionValue(caption)
  }, [caption])

  // 编辑模式时聚焦输入框
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleCaptionSubmit = useCallback(() => {
    updateAttributes({ alt: captionValue.trim() })
    setIsEditing(false)
  }, [captionValue, updateAttributes])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleCaptionSubmit()
      } else if (e.key === 'Escape') {
        setCaptionValue(caption)
        setIsEditing(false)
      }
    },
    [caption, handleCaptionSubmit],
  )

  return (
    <NodeViewWrapper
      className={`rich-editor__image-block ${uploading ? 'is-uploading' : ''} ${error ? 'is-error' : ''}`}
    >
      <img
        src={node.attrs.src as string}
        alt={caption || 'image'}
        draggable={false}
      />
      {uploading && (
        <div className="rich-editor__image-overlay">
          <div className="rich-editor__image-spinner" />
          <span>上传中...</span>
        </div>
      )}
      {error && (
        <div className="rich-editor__image-overlay rich-editor__image-overlay--error">
          <span>上传失败</span>
          <div className="rich-editor__image-actions">
            <button
              type="button"
              onClick={() => {
                if (uploadId && onRetry) {
                  onRetry(uploadId)
                }
              }}
            >
              重试
            </button>
            <button
              type="button"
              onClick={() => {
                if (uploadId && onRemove) {
                  onRemove(uploadId)
                } else {
                  deleteNode()
                }
              }}
            >
              移除
            </button>
          </div>
        </div>
      )}
      {showCaption && (
        isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={captionValue}
            onChange={(e) => setCaptionValue(e.target.value)}
            onBlur={handleCaptionSubmit}
            onKeyDown={handleKeyDown}
            placeholder="添加图片说明..."
            className="rich-editor__caption-input"
          />
        ) : caption ? (
          <figcaption
            className="rich-editor__caption"
            onClick={() => setIsEditing(true)}
          >
            {caption}
          </figcaption>
        ) : (
          <button
            type="button"
            className="rich-editor__caption-add"
            onClick={() => setIsEditing(true)}
          >
            添加说明
          </button>
        )
      )}
    </NodeViewWrapper>
  )
}
