import { memo, useCallback, useMemo, useRef, type ChangeEvent, type MouseEvent } from 'react'
import type { Editor } from '@tiptap/react'
import { Button, Tooltip, Space, theme } from 'antd'
import {
  BoldOutlined,
  ItalicOutlined,
  StrikethroughOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  CodeOutlined,
  LinkOutlined,
  PictureOutlined,
  FontSizeOutlined
} from '@ant-design/icons'

type ToolbarProps = {
  editor: Editor | null
  disabled?: boolean
  onImageUpload?: (file: File) => void
}

type ToolbarItem = {
  id: string
  label?: string
  icon?: React.ReactNode
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
      { id: 'bold', icon: <BoldOutlined />, title: 'Bold', command: 'toggleBold' },
      { id: 'italic', icon: <ItalicOutlined />, title: 'Italic', command: 'toggleItalic' },
      { id: 'strike', icon: <StrikethroughOutlined />, title: 'Strike', command: 'toggleStrike' },
    ],
  },
  {
    id: 'heading',
    items: [
      { id: 'heading-2', label: 'H2', icon: <FontSizeOutlined />, title: 'Heading 2', command: 'toggleHeading', args: { level: 2 } },
      { id: 'heading-3', label: 'H3', icon: <FontSizeOutlined style={{ fontSize: '0.8em' }} />, title: 'Heading 3', command: 'toggleHeading', args: { level: 3 } },
      { id: 'blockquote', label: '""', title: 'Blockquote', command: 'toggleBlockquote' },
    ],
  },
  {
    id: 'list',
    items: [
      { id: 'bulletList', icon: <UnorderedListOutlined />, title: 'Bullet List', command: 'toggleBulletList' },
      { id: 'orderedList', icon: <OrderedListOutlined />, title: 'Ordered List', command: 'toggleOrderedList' },
    ],
  },
  {
    id: 'code',
    items: [
      { id: 'code', icon: <CodeOutlined />, title: 'Inline Code', command: 'toggleCode' },
      { id: 'codeBlock', label: '{}', title: 'Code Block', command: 'toggleCodeBlock' },
    ],
  },
]

export const RichEditorToolbar = memo(({ editor, disabled, onImageUpload }: ToolbarProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { token } = theme.useToken()

  const handleMouseDown = useCallback((e: MouseEvent) => {
    e.preventDefault()
  }, [])

  const buttonStates = useMemo(() => {
    if (!editor) return {}
    const states: Record<string, { active: boolean; canToggle: boolean }> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const can = editor.can() as any

    for (const group of TOOLBAR_GROUPS) {
      for (const item of group.items) {
        const stateKey = item.args ? `${item.id}_${JSON.stringify(item.args)}` : item.id
        const isActive = item.args
          ? editor.isActive(item.command.replace('toggle', '').toLowerCase(), item.args) || editor.isActive(item.id, item.args)
          : editor.isActive(item.id)
        
        // Tiptap naming quirks: heading vs toggleHeading. checking active state usually needs node name.
        // For simplicity, we trust editor.isActive logic which maps 'heading' -> heading node.
        
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

  if (!editor) return null

  return (
    <div style={{ 
      padding: '8px 12px', 
      borderBottom: `1px solid ${token.colorBorderSecondary}`,
      background: token.colorFillQuaternary,
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      alignItems: 'center'
    }}>
      {TOOLBAR_GROUPS.map((group, groupIdx) => (
        <Space key={group.id} style={{ marginRight: groupIdx < TOOLBAR_GROUPS.length - 1 ? 8 : 0 }}>
          {group.items.map((item, index) => {
            const stateKey = item.args ? `${item.id}_${JSON.stringify(item.args)}` : item.id
            const state = buttonStates[stateKey]
            return (
              <Tooltip key={`${item.id}-${index}`} title={item.title}>
                <Button
                  type={state?.active ? 'primary' : 'text'}
                  size="small"
                  icon={item.icon}
                  onMouseDown={handleMouseDown}
                  onClick={() => handleCommand(item.command, item.args)}
                  disabled={disabled || !(state?.canToggle ?? true)}
                  style={{ minWidth: 32 }}
                >
                  {item.label}
                </Button>
              </Tooltip>
            )
          })}
          {groupIdx < TOOLBAR_GROUPS.length - 1 && <div style={{ width: 1, height: 16, background: token.colorBorder }} />}
        </Space>
      ))}

      <Space>
        <div style={{ width: 1, height: 16, background: token.colorBorder }} />
        <Tooltip title="Link">
          <Button
            type={editor.isActive('link') ? 'primary' : 'text'}
            size="small"
            icon={<LinkOutlined />}
            onMouseDown={handleMouseDown}
            onClick={handleSetLink}
            disabled={disabled}
          />
        </Tooltip>
        <Tooltip title="Image">
          <Button
            type="text"
            size="small"
            icon={<PictureOutlined />}
            onMouseDown={handleMouseDown}
            onClick={handleImageButton}
            disabled={disabled || !onImageUpload}
          />
        </Tooltip>
      </Space>

      <input
        ref={fileInputRef}
        style={{ display: 'none' }}
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
