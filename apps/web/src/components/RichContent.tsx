import { useCallback, useMemo, useRef, useState } from 'react'
import {
  EditorContent,
  useEditor,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { extractMediaFromContent } from '../utils/media'
import MediaViewer from './MediaViewer'

type RichContentProps = {
  contentJson?: unknown
  contentText?: string
  variant?: 'post' | 'comment'
}

const parseContent = (value: unknown) => {
  if (!value) {
    return null
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  return value
}

const ImageNodeView = ({ node }: NodeViewProps) => {
  const src = node.attrs.src as string
  const alt = (node.attrs.alt as string) || ''
  const [needsBg, setNeedsBg] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const checkNeedsBg = (img: HTMLImageElement) => {
    const wrap = wrapRef.current
    if (!wrap || !img.naturalWidth || !img.naturalHeight) {
      return
    }
    // 检查图片是否能填满容器宽度
    const containerWidth = wrap.clientWidth
    const maxHeight = 512
    const displayHeight = Math.min(img.naturalHeight, maxHeight)
    const displayWidth = (displayHeight / img.naturalHeight) * img.naturalWidth
    // 如果图片显示宽度小于容器宽度的 85%，需要模糊背景
    setNeedsBg(displayWidth < containerWidth * 0.85)
  }

  return (
    <NodeViewWrapper
      className={`rich-content__image-wrap ${needsBg ? 'needs-bg' : ''}`}
      ref={wrapRef}
    >
      {needsBg ? (
        <div
          className="rich-content__image-bg"
          style={{ backgroundImage: `url(${src})` }}
        />
      ) : null}
      <img
        className="rich-content__image"
        src={src}
        alt={alt}
        draggable={false}
        onLoad={(e) => checkNeedsBg(e.currentTarget)}
      />
    </NodeViewWrapper>
  )
}

const RichContent = ({ contentJson, contentText, variant = 'post' }: RichContentProps) => {
  const content = useMemo(() => {
    const parsed = parseContent(contentJson)
    if (parsed) {
      return parsed
    }
    return contentText ?? ''
  }, [contentJson, contentText])

  const mediaItems = useMemo(
    () => extractMediaFromContent(contentJson),
    [contentJson],
  )
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)

  const handleOpen = useCallback(
    (src: string) => {
      const index = mediaItems.findIndex((item) => item.url === src)
      if (index < 0) {
        return false
      }
      setViewerIndex(index)
      setViewerOpen(true)
      return true
    },
    [mediaItems],
  )

  const editor = useEditor(
    {
      extensions: [
        Document,
        Paragraph,
        Text,
        StarterKit.configure({
          document: false,
          paragraph: false,
          text: false,
        }),
        Link.configure({
          openOnClick: true,
          HTMLAttributes: {
            rel: 'noopener noreferrer',
            target: '_blank',
          },
        }),
        Image.extend({
          addNodeView() {
            return ReactNodeViewRenderer(ImageNodeView)
          },
        }),
      ],
      content,
      editable: false,
    },
    [content],
  )

  const handleContentClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement
      const wrap = target.closest('.rich-content__image-wrap') as HTMLElement | null
      if (!wrap) {
        return
      }
      const src = wrap.dataset.src
      if (src) {
        handleOpen(src)
      }
    },
    [handleOpen],
  )

  if (!editor) {
    return null
  }

  return (
    <div className={`rich-content ${variant === 'comment' ? 'rich-content--comment' : ''}`} onClick={handleContentClick}>
      <EditorContent editor={editor} />
      <MediaViewer
        items={mediaItems}
        open={viewerOpen}
        startIndex={viewerIndex}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  )
}

export default RichContent
