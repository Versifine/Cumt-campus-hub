import { useCallback, useEffect, useRef } from 'react'
import type { JSONContent } from '@tiptap/react'

type DraftConfig = {
  key: string
  debounceMs?: number
  enabled?: boolean
}

type DraftData = {
  json: JSONContent | null
  text: string
  savedAt: number
}

// 从草稿中移除 blob URL 图片
const sanitizeDraftContent = (json: unknown): unknown => {
  if (!json || typeof json !== 'object') return json

  const node = json as { type?: string; attrs?: { src?: string }; content?: unknown[] }

  // 移除 blob URL 图片
  if (node.type === 'image' && node.attrs?.src?.startsWith('blob:')) {
    return null
  }

  // 递归处理
  if (Array.isArray(node.content)) {
    const filtered = node.content.map(sanitizeDraftContent).filter(Boolean)
    return { ...node, content: filtered }
  }

  return json
}

export const useDraft = (config: DraftConfig) => {
  const { key, debounceMs = 1500, enabled = true } = config
  const timerRef = useRef<number | null>(null)
  const lastSavedRef = useRef<string>('')

  const loadDraft = useCallback((): DraftData | null => {
    if (!enabled) return null
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const data = JSON.parse(raw) as DraftData
      // 清理 blob URL
      data.json = sanitizeDraftContent(data.json) as JSONContent | null
      return data
    } catch {
      return null
    }
  }, [key, enabled])

  const saveDraft = useCallback(
    (json: JSONContent | null, text: string) => {
      if (!enabled) return

      // 取消之前的定时器
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }

      // 防抖保存
      timerRef.current = window.setTimeout(() => {
        const sanitized = sanitizeDraftContent(json)
        const hash = JSON.stringify(sanitized)

        // 内容无变化则跳过
        if (hash === lastSavedRef.current) return

        lastSavedRef.current = hash
        const data: DraftData = {
          json: sanitized as JSONContent | null,
          text,
          savedAt: Date.now(),
        }
        localStorage.setItem(key, JSON.stringify(data))
      }, debounceMs)
    },
    [key, debounceMs, enabled],
  )

  const clearDraft = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
    }
    localStorage.removeItem(key)
    lastSavedRef.current = ''
  }, [key])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [])

  return { loadDraft, saveDraft, clearDraft }
}
