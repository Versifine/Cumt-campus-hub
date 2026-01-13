import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import type { EditorView } from '@tiptap/pm/view'
import { createExtensions } from './extensions'
import { useImageUpload } from './hooks/useImageUpload'
import { useEditorSync } from './hooks/useEditorSync'
import { RichEditorToolbar } from './RichEditorToolbar'
import type { RichEditorHandle, RichEditorProps } from './types'

// 创建一个稳定的回调包装器
const createStableCallback = <T extends (...args: Parameters<T>) => ReturnType<T>>(
  ref: React.MutableRefObject<T>,
): T => {
  // 返回一个稳定的函数，内部通过 ref 调用最新的实现
  return ((...args: Parameters<T>) => ref.current(...args)) as T
}

const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(
  ({ value, onChange, onImageUpload, placeholder, disabled, deferredUpload, variant = 'post' }, ref) => {
    const editorRef = useRef<Editor | null>(null)
    const disabledRef = useRef(disabled)

    // 同步 disabled ref
    useEffect(() => {
      disabledRef.current = disabled
    }, [disabled])

    // 图片上传逻辑 - 在 editor 创建之前初始化
    const imageUpload = useImageUpload(editorRef, { deferredUpload, onImageUpload })

    // 使用 ref 存储回调的最新版本
    const retryRef = useRef(imageUpload.retryUpload)
    const removeRef = useRef(imageUpload.removeImage)
    const insertRef = useRef(imageUpload.insertImage)

    // 在 effect 中更新 ref
    useEffect(() => {
      retryRef.current = imageUpload.retryUpload
      removeRef.current = imageUpload.removeImage
      insertRef.current = imageUpload.insertImage
    }, [imageUpload.retryUpload, imageUpload.removeImage, imageUpload.insertImage])

    // 创建稳定的回调（只创建一次）
    // 注意：这里故意传递 ref 来创建稳定的回调包装器，ref.current 只在运行时被访问
    /* eslint-disable react-hooks/refs */
    const stableRetry = useMemo(() => createStableCallback(retryRef), [])
    const stableRemove = useMemo(() => createStableCallback(removeRef), [])
    const stableInsert = useMemo(() => createStableCallback(insertRef), [])
    /* eslint-enable react-hooks/refs */

    // 创建稳定的粘贴/拖放处理函数
    const handlePaste = useCallback(
      (_view: EditorView, event: ClipboardEvent) => {
        if (disabledRef.current) return false

        const items = Array.from(event.clipboardData?.items ?? [])
        const files = items
          .filter((item) => item.kind === 'file')
          .map((item) => item.getAsFile())
          .filter((item): item is File => Boolean(item))
          .filter((file) => file.type.startsWith('image/'))

        if (files.length === 0) return false
        files.forEach(stableInsert)
        return true
      },
      [stableInsert],
    )

    const handleDrop = useCallback(
      (_view: EditorView, event: DragEvent) => {
        if (disabledRef.current) return false

        const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
          file.type.startsWith('image/'),
        )
        if (files.length === 0) return false
        files.forEach(stableInsert)
        return true
      },
      [stableInsert],
    )

    // 使用 useMemo 创建稳定的扩展配置
    const extensions = useMemo(
      () =>
        createExtensions({
          placeholder,
          onImageRetry: stableRetry,
          onImageRemove: stableRemove,
          variant,
        }),
      [placeholder, stableRetry, stableRemove, variant],
    )

    // 创建编辑器
    const editor = useEditor(
      {
        extensions,
        content: value.json ?? '',
        editorProps: {
          attributes: { class: 'rich-editor__content' },
          handlePaste,
          handleDrop,
        },
        editable: !disabled,
      },
      [extensions, handlePaste, handleDrop],
    )

    // 同步 editorRef
    useEffect(() => {
      editorRef.current = editor
    }, [editor])

    // 内容同步逻辑
    const { setContent } = useEditorSync(editor, { value, onChange })

    // 更新 editable 状态
    useEffect(() => {
      if (!editor) return
      editor.setEditable(!disabled)
    }, [editor, disabled])

    // 暴露 ref 方法
    useImperativeHandle(
      ref,
      () => ({
        focus: () => editor?.commands.focus(),
        insertText: (text) => editor?.commands.insertContent(text),
        setContent,
        flushUploads: imageUpload.flushUploads,
      }),
      [editor, setContent, imageUpload.flushUploads],
    )

    return (
      <div className={`rich-editor ${disabled ? 'is-disabled' : ''}`}>
        <RichEditorToolbar
          editor={editor}
          disabled={disabled}
          onImageUpload={onImageUpload ? stableInsert : undefined}
        />
        <div className="rich-editor__body">
          <EditorContent editor={editor} />
        </div>
      </div>
    )
  },
)

RichEditor.displayName = 'RichEditor'

export default RichEditor
