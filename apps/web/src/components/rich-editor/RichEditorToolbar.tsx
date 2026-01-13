import { memo, useCallback, useMemo, useRef, type ChangeEvent, type MouseEvent } from 'react'
import type { Editor } from '@tiptap/react'
import { ToolbarButton } from './components/ToolbarButton'
import { ToolbarGroup } from './components/ToolbarGroup'

type ToolbarProps = {
  editor: Editor | null
  disabled?: boolean
  onImageUpload?: (file: File) => void
}

type ToolbarItem = {
  id: string
  label: string
  title: string
  command: string
  args?: Record<string, unknown>
}

type ToolbarGroupConfig = {
  id: string
  items: ToolbarItem[]
}

const TOOLBAR_GROUPS: ToolbarGroupConfig[] = [
  {
    id: 'format',
    items: [
      { id: 'bold', label: 'B', title: 'Bold', command: 'toggleBold' },
      { id: 'italic', label: 'I', title: 'Italic', command: 'toggleItalic' },
      { id: 'strike', label: 'S', title: 'Strike', command: 'toggleStrike' },
    ],
  },
  {
    id: 'heading',
    items: [
      { id: 'heading', label: 'H2', title: 'Heading 2', command: 'toggleHeading', args: { level: 2 } },
      {
        id: 'heading',
        label: 'H3',
        title: 'Heading 3',
        command: 'toggleHeading',
        args: { level: 3 },
      },
      { id: 'blockquote', label: 'Quote', title: 'Blockquote', command: 'toggleBlockquote' },
    ],
  },
  {
    id: 'list',
    items: [
      { id: 'bulletList', label: 'UL', title: 'Bullet List', command: 'toggleBulletList' },
      { id: 'orderedList', label: 'OL', title: 'Ordered List', command: 'toggleOrderedList' },
    ],
  },
  {
    id: 'code',
    items: [
      { id: 'code', label: '</>', title: 'Inline Code', command: 'toggleCode' },
      { id: 'codeBlock', label: '{ }', title: 'Code Block', command: 'toggleCodeBlock' },
    ],
  },
]

export const RichEditorToolbar = memo(({ editor, disabled, onImageUpload }: ToolbarProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleMouseDown = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
  }, [])

  // 缓存按钮状态计算
  const buttonStates = useMemo(() => {
    if (!editor) return {}

    const states: Record<string, { active: boolean; canToggle: boolean }> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const can = editor.can() as any

    for (const group of TOOLBAR_GROUPS) {
      for (const item of group.items) {
        const stateKey = item.args ? `${item.id}_${JSON.stringify(item.args)}` : item.id
        const isActive = item.args
          ? editor.isActive(item.id, item.args)
          : editor.isActive(item.id)
        const canToggle = item.args
          ? (can[item.command]?.(item.args) ?? true)
          : (can[item.command]?.() ?? true)
        states[stateKey] = { active: isActive, canToggle }
      }
    }
    return states
  }, [editor])

  const handleCommand = useCallback(
    (command: string, args?: Record<string, unknown>) => {
      if (!editor) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain = editor.chain().focus() as any
      if (args) {
        chain[command]?.(args).run()
      } else {
        chain[command]?.().run()
      }
    },
    [editor],
  )

  const handleSetLink = useCallback(() => {
    if (!editor) return
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', previous ?? '')
    if (url === null) return
    if (url.trim() === '') {
      editor.chain().focus().unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }, [editor])

  const handleImageButton = useCallback(() => {
    if (disabled || !onImageUpload) return
    fileInputRef.current?.click()
  }, [disabled, onImageUpload])

  const handleImageChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (disabled || !onImageUpload) {
        event.target.value = ''
        return
      }
      const files = Array.from(event.target.files ?? []).filter((file) =>
        file.type.startsWith('image/'),
      )
      event.target.value = ''
      files.forEach(onImageUpload)
    },
    [disabled, onImageUpload],
  )

  return (
    <div className="rich-editor__toolbar">
      {TOOLBAR_GROUPS.map((group) => (
        <ToolbarGroup key={group.id}>
          {group.items.map((item, index) => {
            const stateKey = item.args ? `${item.id}_${JSON.stringify(item.args)}` : item.id
            const state = buttonStates[stateKey]
            return (
              <ToolbarButton
                key={`${item.id}-${index}`}
                label={item.label}
                title={item.title}
                active={state?.active ?? false}
                disabled={disabled || !(state?.canToggle ?? true)}
                onMouseDown={handleMouseDown}
                onClick={() => handleCommand(item.command, item.args)}
              />
            )
          })}
        </ToolbarGroup>
      ))}
      <ToolbarGroup>
        <ToolbarButton
          label="Link"
          title="Insert link"
          active={editor?.isActive('link') ?? false}
          disabled={disabled}
          onMouseDown={handleMouseDown}
          onClick={handleSetLink}
        />
        <ToolbarButton
          label="Image"
          title="Insert image"
          className="rich-editor__tool--wide"
          disabled={disabled || !onImageUpload}
          onMouseDown={handleMouseDown}
          onClick={handleImageButton}
        />
      </ToolbarGroup>
      <input
        ref={fileInputRef}
        className="rich-editor__file"
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageChange}
        disabled={disabled}
      />
    </div>
  )
})

RichEditorToolbar.displayName = 'RichEditorToolbar'
