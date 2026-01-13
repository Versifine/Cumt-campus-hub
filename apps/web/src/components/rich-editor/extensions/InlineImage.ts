import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ImageNodeView } from '../components/ImageNodeView'

export type InlineImageOptions = {
  onRetry?: (uploadId: string) => void
  onRemove?: (uploadId: string) => void
  showCaption?: boolean
}

export const InlineImage = Image.extend<InlineImageOptions>({
  // 设置为 block 类型，这样插入图片后光标会正确显示在下一行
  group: 'block',

  // 图片是原子节点，不可编辑内部内容
  atom: true,

  // 可以被选中
  selectable: true,

  // 可以拖拽
  draggable: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      uploadId: {
        default: null,
      },
      uploading: {
        default: false,
        renderHTML: (attributes) => {
          if (!attributes.uploading) {
            return {}
          }
          return { 'data-uploading': 'true' }
        },
      },
      error: {
        default: false,
        renderHTML: (attributes) => {
          if (!attributes.error) {
            return {}
          }
          return { 'data-error': 'true' }
        },
      },
      width: {
        default: null,
      },
      height: {
        default: null,
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView)
  },
})
