import { useMemo } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'

type RichContentProps = {
  contentJson?: unknown
  contentText?: string
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

const RichContent = ({ contentJson, contentText }: RichContentProps) => {
  const content = useMemo(() => {
    const parsed = parseContent(contentJson)
    if (parsed) {
      return parsed
    }
    return contentText ?? ''
  }, [contentJson, contentText])

  const editor = useEditor({
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
      Image.configure({
        HTMLAttributes: {
          class: 'rich-content__image',
        },
      }),
    ],
    content,
    editable: false,
  })

  if (!editor) {
    return null
  }

  return (
    <div className="rich-content">
      <EditorContent editor={editor} />
    </div>
  )
}

export default RichContent
