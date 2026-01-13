import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { extractMediaFromContent } from '../../utils/media'
import MediaViewer from '../MediaViewer'

type RichContentProps = {
  contentJson?: unknown
  contentText?: string
  variant?: 'post' | 'comment'
}

const parseContent = (value: unknown) => {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  return value
}

type ImageNodeViewProps = NodeViewProps & {
  showCaption?: boolean
}

const ImageNodeView = ({ node, extension }: ImageNodeViewProps) => {
  const src = node.attrs.src as string
  const alt = (node.attrs.alt as string) || ''
  const [needsBg, setNeedsBg] = useState(false)
  const showCaption = (extension.options as { showCaption?: boolean })?.showCaption ?? true

  const checkNeedsBg = useCallback((img: HTMLImageElement) => {
    if (!img.naturalWidth || !img.naturalHeight) return
    const wrap = img.closest('.rich-content__image-container') as HTMLElement | null
    if (!wrap) return
    const containerWidth = wrap.clientWidth
    const maxHeight = 512
    const displayHeight = Math.min(img.naturalHeight, maxHeight)
    const displayWidth = (displayHeight / img.naturalHeight) * img.naturalWidth
    setNeedsBg(displayWidth < containerWidth * 0.85)
  }, [])

  return (
    <NodeViewWrapper className="rich-content__image-block" data-src={src}>
      <div className={`rich-content__image-container ${needsBg ? 'needs-bg' : ''}`}>
        {needsBg ? (
          <div className="rich-content__image-bg" style={{ backgroundImage: `url(${src})` }} />
        ) : null}
        <img
          className="rich-content__image"
          src={src}
          alt={alt}
          draggable={false}
          onLoad={(e) => checkNeedsBg(e.currentTarget)}
        />
      </div>
      {showCaption && alt && <figcaption className="rich-content__caption">{alt}</figcaption>}
    </NodeViewWrapper>
  )
}

// 只读扩展配置 - 根据是否显示 caption 创建
const createReadonlyExtensions = (showCaption: boolean) => [
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
    addOptions() {
      return {
        ...this.parent?.(),
        showCaption,
      }
    },
    addNodeView() {
      return ReactNodeViewRenderer(ImageNodeView)
    },
  }),
]

const RichContent = ({ contentJson, contentText, variant = 'post' }: RichContentProps) => {
  const content = useMemo(() => {
    const parsed = parseContent(contentJson)
    if (parsed) return parsed
    return contentText ?? ''
  }, [contentJson, contentText])

  const mediaItems = useMemo(() => extractMediaFromContent(contentJson), [contentJson])
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)

  const handleOpen = useCallback(
    (src: string) => {
      const index = mediaItems.findIndex((item) => item.url === src)
      if (index < 0) return false
      setViewerIndex(index)
      setViewerOpen(true)
      return true
    },
    [mediaItems],
  )

  // 使用 useMemo 创建稳定的扩展配置
  // 帖子模式显示 caption，评论模式不显示
  const showCaption = variant === 'post'
  const extensions = useMemo(() => createReadonlyExtensions(showCaption), [showCaption])

  // 使用 ref 跟踪初始化状态
  const isInitializedRef = useRef(false)

  // 创建编辑器 - 只初始化一次
  const editor = useEditor(
    {
      extensions,
      content: '',
      editable: false,
    },
    [],
  )

  // 通过命令更新内容，而非重建 editor
  useEffect(() => {
    if (!editor) return

    // 首次初始化或内容变化时更新
    if (!isInitializedRef.current || content) {
      editor.commands.setContent(content, false)
      isInitializedRef.current = true
    }
  }, [editor, content])

  const handleContentClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement
      const block = target.closest('.rich-content__image-block') as HTMLElement | null
      if (!block) return
      const src = block.dataset.src
      if (src) handleOpen(src)
    },
    [handleOpen],
  )

  if (!editor) return null

  return (
    <div
      className={`rich-content ${variant === 'comment' ? 'rich-content--comment' : ''}`}
      onClick={handleContentClick}
    >
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
