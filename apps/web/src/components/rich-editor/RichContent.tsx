import { useMemo } from 'react'
import {
  EditorContent,
  useEditor,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import ImageExtension from '@tiptap/extension-image'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { Image } from 'antd'

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

const ImageNodeView = ({ node, extension }: NodeViewProps) => {
  const src = node.attrs.src as string
  const alt = (node.attrs.alt as string) || ''
  const showCaption = (extension.options as { showCaption?: boolean })?.showCaption ?? true

  return (
    <NodeViewWrapper style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '16px 0' }}>
      <Image
        src={src}
        alt={alt}
        style={{ borderRadius: 8, maxWidth: '100%', height: 'auto', maxHeight: 512 }}
      />
      {showCaption && alt && (
        <span style={{ fontSize: '0.8rem', color: '#888', marginTop: 4, fontStyle: 'italic' }}>
          {alt}
        </span>
      )}
    </NodeViewWrapper>
  )
}

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
  ImageExtension.extend({
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

  const showCaption = variant === 'post'
  const extensions = useMemo(() => createReadonlyExtensions(showCaption), [showCaption])

  const editor = useEditor({
      extensions,
      content,
      editable: false,
      editorProps: {
        attributes: {
          class: 'rich-content', // Only for internal prose mirror styles if needed
        }
      }
    },
    [content, extensions],
  )

  if (!editor) return null

  // Update content if changed (though useEditor usually handles initial content, dynamic updates need this)
  // But strictly readonly usually doesn't change often. 
  // If we need dynamic updates:
  if (editor && content && JSON.stringify(editor.getJSON()) !== JSON.stringify(content)) {
     // careful with loops here, but usually content is stable
  }

  return (
    <div style={{ lineHeight: 1.6, color: 'rgba(0,0,0,0.88)' }}>
      <Image.PreviewGroup>
        <EditorContent editor={editor} />
      </Image.PreviewGroup>
    </div>
  )
}

export default RichContent
