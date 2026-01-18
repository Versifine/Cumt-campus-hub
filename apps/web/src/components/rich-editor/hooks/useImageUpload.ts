import { useCallback, useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import type { UploadEntry, ImageUploadConfig, UploadResult } from '../types'

type ImageNodeInfo = {
  pos: number
  attrs: Record<string, unknown>
  nodeSize: number
}

const createUploadId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export const useImageUpload = (
  editorRef: React.MutableRefObject<Editor | null>,
  config: ImageUploadConfig,
) => {
  const uploadsRef = useRef(new Map<string, UploadEntry>())
  const configRef = useRef(config)

  // 在 effect 中更新 ref
  useEffect(() => {
    configRef.current = config
  }, [config])

  // 使用 nodesBetween 查找图片节点，可提前终止遍历
  const findImageNode = useCallback(
    (uploadId: string): ImageNodeInfo | null => {
      const editor = editorRef.current
      if (!editor) return null

      let found: ImageNodeInfo | null = null
      editor.state.doc.nodesBetween(0, editor.state.doc.content.size, (node, pos) => {
        if (found) return false
        if (node.type.name === 'image' && node.attrs.uploadId === uploadId) {
          found = {
            pos,
            attrs: node.attrs as Record<string, unknown>,
            nodeSize: node.nodeSize,
          }
          return false
        }
        return true
      })
      return found
    },
    [editorRef],
  )

  // 更新图片节点属性
  const updateImageAttrs = useCallback(
    (uploadId: string, attrs: Record<string, unknown>) => {
      const editor = editorRef.current
      const nodeInfo = findImageNode(uploadId)
      if (!editor || !nodeInfo) return

      editor.view.dispatch(
        editor.state.tr.setNodeMarkup(nodeInfo.pos, undefined, { ...nodeInfo.attrs, ...attrs }),
      )
    },
    [editorRef, findImageNode],
  )

  // 开始上传
  const startUpload = useCallback(
    async (uploadId: string): Promise<boolean> => {
      const entry = uploadsRef.current.get(uploadId)
      const uploadFn = configRef.current.onImageUpload

      if (!entry || !uploadFn) {
        updateImageAttrs(uploadId, { uploading: false, error: true })
        return false
      }

      uploadsRef.current.set(uploadId, { ...entry, status: 'uploading' })
      updateImageAttrs(uploadId, { uploading: true, error: false })

      try {
        const result: UploadResult = await uploadFn(entry.file)
        updateImageAttrs(uploadId, {
          src: result.url,
          width: result.width ?? null,
          height: result.height ?? null,
          uploading: false,
          error: false,
        })

        // 清理 blob URL
        URL.revokeObjectURL(entry.blobUrl)
        uploadsRef.current.set(uploadId, { ...entry, status: 'success' })
        return true
      } catch {
        updateImageAttrs(uploadId, { uploading: false, error: true })
        uploadsRef.current.set(uploadId, { ...entry, status: 'error' })
        return false
      }
    },
    [updateImageAttrs],
  )

  // 插入图片
  const insertImage = useCallback(
    (file: File) => {
      const editor = editorRef.current
      if (!editor) return

      const uploadId = createUploadId()
      const blobUrl = URL.createObjectURL(file)

      uploadsRef.current.set(uploadId, { file, blobUrl, status: 'pending' })

      const shouldDefer = configRef.current.deferredUpload

      // 插入图片并在其后创建一个新段落，确保光标正确定位
      editor
        .chain()
        .focus()
        .insertContent([
          {
            type: 'image',
            attrs: {
              src: blobUrl,
              alt: '',
              uploadId,
              uploading: !shouldDefer,
              error: false,
            },
          },
          {
            type: 'paragraph',
          },
        ])
        .run()

      if (!shouldDefer) {
        void startUpload(uploadId)
      }
    },
    [editorRef, startUpload],
  )

  // 重试上传
  const retryUpload = useCallback(
    (uploadId: string) => {
      void startUpload(uploadId)
    },
    [startUpload],
  )

  // 移除图片
  const removeImage = useCallback(
    (uploadId: string) => {
      const editor = editorRef.current
      const nodeInfo = findImageNode(uploadId)
      if (!editor || !nodeInfo) return

      const deletePos = nodeInfo.pos
      const deleteSize = nodeInfo.nodeSize
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          tr.delete(deletePos, deletePos + deleteSize)
          return true
        })
        .run()

      const entry = uploadsRef.current.get(uploadId)
      if (entry) {
        URL.revokeObjectURL(entry.blobUrl)
        uploadsRef.current.delete(uploadId)
      }
    },
    [editorRef, findImageNode],
  )

  // 刷新所有待上传的图片
  const flushUploads = useCallback(async (): Promise<{
    json: ReturnType<Editor['getJSON']> | null
    failed: boolean
  }> => {
    const editor = editorRef.current
    if (!editor) return { json: null, failed: false }

    const pending = Array.from(uploadsRef.current.entries()).filter(
      ([, entry]) => entry.status === 'pending' || entry.status === 'error',
    )

    if (pending.length === 0) {
      return { json: editor.getJSON(), failed: false }
    }

    let hasFailed = false
    for (const [uploadId] of pending) {
      const success = await startUpload(uploadId)
      if (!success) hasFailed = true
    }

    return { json: editor.getJSON(), failed: hasFailed }
  }, [editorRef, startUpload])

  return {
    uploadsRef,
    insertImage,
    retryUpload,
    removeImage,
    flushUploads,
  }
}
