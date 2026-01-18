import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { InlineImage, type InlineImageOptions } from './InlineImage'

export type ExtensionsConfig = {
  placeholder?: string
  onImageRetry?: (uploadId: string) => void
  onImageRemove?: (uploadId: string) => void
  variant?: 'post' | 'comment'
}

export const createExtensions = (config: ExtensionsConfig) => {
  const imageOptions: InlineImageOptions = {
    onRetry: config.onImageRetry,
    onRemove: config.onImageRemove,
    showCaption: config.variant !== 'comment',
  }

  return [
    Document,
    Paragraph,
    Text,
    StarterKit.configure({
      document: false,
      paragraph: false,
      text: false,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      HTMLAttributes: {
        rel: 'noopener noreferrer',
        target: '_blank',
      },
    }),
    InlineImage.configure(imageOptions),
    Placeholder.configure({
      placeholder: config.placeholder ?? 'Body text (optional)',
    }),
  ]
}

export { InlineImage } from './InlineImage'
