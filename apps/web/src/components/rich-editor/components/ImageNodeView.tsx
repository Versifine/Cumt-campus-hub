import { useCallback, useEffect, useRef, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Spin, Button, Input, Space, Typography, Image } from 'antd'
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons'

const { Text } = Typography

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
  const inputRef = useRef<any>(null)

  useEffect(() => {
    setCaptionValue(caption)
  }, [caption])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
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
    <NodeViewWrapper style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '16px 0', position: 'relative' }}>
      <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
        <Image
          src={node.attrs.src as string}
          alt={caption || 'image'}
          preview={false}
          style={{ 
            opacity: uploading || error ? 0.5 : 1, 
            maxWidth: '100%', 
            height: 'auto',
            maxHeight: 512,
            display: 'block'
          }}
        />
        
        {uploading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.1)'
          }}>
            <Spin tip="上传中..." />
          </div>
        )}

        {error && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            color: '#fff',
            gap: 12
          }}>
            <Text type="danger" style={{ color: '#ff4d4f' }}>上传失败</Text>
            <Space>
              <Button 
                size="small" 
                icon={<ReloadOutlined />} 
                onClick={() => uploadId && onRetry?.(uploadId)}
              >
                重试
              </Button>
              <Button 
                size="small" 
                danger 
                icon={<DeleteOutlined />} 
                onClick={() => {
                  if (uploadId && onRemove) onRemove(uploadId)
                  else deleteNode()
                }}
              >
                移除
              </Button>
            </Space>
          </div>
        )}
      </div>

      {showCaption && !uploading && !error && (
        <div style={{ marginTop: 8, width: '100%', maxWidth: 400, textAlign: 'center' }}>
          {isEditing ? (
            <Input
              ref={inputRef}
              value={captionValue}
              onChange={(e) => setCaptionValue(e.target.value)}
              onBlur={handleCaptionSubmit}
              onKeyDown={handleKeyDown}
              placeholder="添加图片说明..."
              size="small"
              style={{ textAlign: 'center' }}
            />
          ) : (
            <Text 
              type="secondary" 
              style={{ cursor: 'pointer', fontSize: '0.85rem', fontStyle: 'italic' }}
              onClick={() => setIsEditing(true)}
            >
              {caption || '点击添加说明'}
            </Text>
          )}
        </div>
      )}
    </NodeViewWrapper>
  )
}
