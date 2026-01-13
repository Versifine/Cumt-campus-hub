import { useCallback, useEffect, useRef } from 'react'
import type { Editor, JSONContent } from '@tiptap/react'
import type { RichEditorValue } from '../types'

type SyncConfig = {
  value: RichEditorValue
  onChange: (value: RichEditorValue) => void
}

export const useEditorSync = (editor: Editor | null, config: SyncConfig) => {
  const configRef = useRef(config)
  const lastJsonHashRef = useRef<string>('')
  const syncLockRef = useRef(false)

  // 在 effect 中更新 ref
  useEffect(() => {
    configRef.current = config
  }, [config])

  // 内部更新 -> 外部
  useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      // 跳过外部更新触发的事件
      if (syncLockRef.current) return

      const json = editor.getJSON()
      const text = editor.getText()
      const hash = JSON.stringify(json ?? {})

      // 只有内容真正变化时才触发 onChange
      if (hash !== lastJsonHashRef.current) {
        lastJsonHashRef.current = hash
        configRef.current.onChange({ json, text })
      }
    }

    editor.on('update', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor])

  // 外部更新 -> 内部
  useEffect(() => {
    if (!editor) return

    const newHash = JSON.stringify(config.value.json ?? {})
    if (newHash === lastJsonHashRef.current) return

    // 锁定同步，避免循环
    syncLockRef.current = true
    lastJsonHashRef.current = newHash

    // 保存选区位置
    const { from, to } = editor.state.selection

    editor.commands.setContent(config.value.json ?? '', false)

    // 尝试恢复选区（如果位置仍有效）
    try {
      const docSize = editor.state.doc.content.size
      const safeFrom = Math.min(from, docSize)
      const safeTo = Math.min(to, docSize)
      if (safeFrom > 0 || safeTo > 0) {
        editor.commands.setTextSelection({ from: safeFrom, to: safeTo })
      }
    } catch {
      // 忽略选区恢复失败
    }

    // 解锁
    requestAnimationFrame(() => {
      syncLockRef.current = false
    })
  }, [editor, config.value.json])

  const setContent = useCallback(
    (json: JSONContent | null) => {
      if (!editor) return
      syncLockRef.current = true
      lastJsonHashRef.current = JSON.stringify(json ?? {})
      editor.commands.setContent(json ?? '', false)
      requestAnimationFrame(() => {
        syncLockRef.current = false
      })
    },
    [editor],
  )

  return { setContent }
}
