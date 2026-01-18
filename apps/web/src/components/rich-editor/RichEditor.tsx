import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import type { EditorView } from '@tiptap/pm/view'
import { theme } from 'antd'
import { createExtensions } from './extensions'
import { useImageUpload } from './hooks/useImageUpload'
import { useEditorSync } from './hooks/useEditorSync'
import { RichEditorToolbar } from './RichEditorToolbar'
import type { RichEditorHandle, RichEditorProps } from './types'

// Helper for stable callbacks
const createStableCallback = <T extends (...args: Parameters<T>) => ReturnType<T>>(
  ref: React.MutableRefObject<T>,
): T => {
  return ((...args: Parameters<T>) => ref.current(...args)) as T
}

const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(
  ({ value, onChange, onImageUpload, placeholder, disabled, deferredUpload, variant = 'post' }, ref) => {
    const editorRef = useRef<Editor | null>(null)
    const disabledRef = useRef(disabled)
    const { token } = theme.useToken()

    useEffect(() => {
      disabledRef.current = disabled
    }, [disabled])

    const imageUpload = useImageUpload(editorRef, { deferredUpload, onImageUpload })

    const retryRef = useRef(imageUpload.retryUpload)
    const removeRef = useRef(imageUpload.removeImage)
    const insertRef = useRef(imageUpload.insertImage)

    useEffect(() => {
      retryRef.current = imageUpload.retryUpload
      removeRef.current = imageUpload.removeImage
      insertRef.current = imageUpload.insertImage
    }, [imageUpload.retryUpload, imageUpload.removeImage, imageUpload.insertImage])

    /* eslint-disable react-hooks/refs */
    const stableRetry = useMemo(() => createStableCallback(retryRef), [])
    const stableRemove = useMemo(() => createStableCallback(removeRef), [])
    const stableInsert = useMemo(() => createStableCallback(insertRef), [])
    /* eslint-enable react-hooks/refs */

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

    const editor = useEditor(
      {
        extensions,
        content: value.json ?? '',
        editorProps: {
          handlePaste,
          handleDrop,
        },
        editable: !disabled,
      },
      [extensions, handlePaste, handleDrop],
    )

    useEffect(() => {
      editorRef.current = editor
    }, [editor])

    const { setContent } = useEditorSync(editor, { value, onChange })

    useEffect(() => {
      if (!editor) return
      editor.setEditable(!disabled)
    }, [editor, disabled])

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
      <div 
        style={{ 
          border: `1px solid ${token.colorBorder}`, 
          borderRadius: token.borderRadiusLG,
          overflow: 'hidden',
          backgroundColor: disabled ? token.colorBgContainerDisabled : token.colorBgContainer,
          transition: 'all 0.2s',
          opacity: disabled ? 0.7 : 1
        }}
        onFocus={(e) => {
           e.currentTarget.style.borderColor = token.colorPrimary
           e.currentTarget.style.boxShadow = `0 0 0 2px ${token.colorPrimaryBg}`
        }}
        onBlur={(e) => {
           e.currentTarget.style.borderColor = token.colorBorder
           e.currentTarget.style.boxShadow = 'none'
        }}
        tabIndex={-1} // Allow focus handling
      >
        <RichEditorToolbar
          editor={editor}
          disabled={disabled}
          onImageUpload={onImageUpload ? stableInsert : undefined}
        />
        <div style={{ minHeight: variant === 'comment' ? 80 : 200, cursor: 'text' }} onClick={() => editor?.commands.focus()}>
          <EditorContent editor={editor} />
        </div>
      </div>
    )
  },
)

RichEditor.displayName = 'RichEditor'

export default RichEditor
