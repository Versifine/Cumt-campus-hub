import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchBoards, type Board } from '../api/boards'
import { getErrorMessage } from '../api/client'
import { createPost } from '../api/posts'
import { uploadInlineImage } from '../api/uploads'
import { RichEditor, type RichEditorHandle, type RichEditorValue } from '../components/rich-editor'
import SectionCard from '../components/SectionCard'
import SiteHeader from '../components/SiteHeader'
import { ErrorState } from '../components/StateBlocks'
import TagInput from '../components/TagInput'
import { useAuth } from '../context/AuthContext'
import { clearDraft, loadDraft, saveDraft } from '../utils/drafts'

const maxInlineImageSize = 100 * 1024 * 1024
const postDraftKey = 'draft:post'

type PostDraftPayload = {
  title: string
  boardId: string
  content: RichEditorValue
  tags: string[]
}

// Check if content JSON contains any image nodes (including blob URLs)
const hasImageNodes = (json: unknown): boolean => {
  if (!json || typeof json !== 'object') {
    return false
  }
  const node = json as { type?: string; content?: unknown[] }
  if (node.type === 'image') {
    return true
  }
  if (Array.isArray(node.content)) {
    return node.content.some(hasImageNodes)
  }
  return false
}

// Remove image nodes with blob: URLs from TipTap JSON content
// These URLs are temporary and won't work after page reload
const sanitizeContentJson = (json: unknown): unknown => {
  if (!json || typeof json !== 'object') {
    return json
  }
  const node = json as { type?: string; attrs?: { src?: string }; content?: unknown[] }
  // Remove image nodes with blob URLs
  if (node.type === 'image' && node.attrs?.src?.startsWith('blob:')) {
    return null
  }
  // Recursively process content array
  if (Array.isArray(node.content)) {
    const filtered = node.content
      .map(sanitizeContentJson)
      .filter((item): item is object => item !== null)
    return { ...node, content: filtered }
  }
  return json
}

const Submit = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [boardId, setBoardId] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState<RichEditorValue>({
    json: null,
    text: '',
  })
  const editorRef = useRef<RichEditorHandle | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [draftHint, setDraftHint] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadBoards = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    try {
      const data = await fetchBoards()
      setBoards(data)
    } catch (error) {
      setLoadError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBoards()
  }, [loadBoards])

  useEffect(() => {
    const draft = loadDraft<PostDraftPayload>(postDraftKey)
    if (!draft) {
      return
    }
    setTitle(draft.data.title ?? '')
    setBoardId(draft.data.boardId ?? '')
    // Sanitize draft content to remove blob URLs that won't work after reload
    const draftContent = draft.data.content ?? { json: null, text: '' }
    const sanitizedJson = sanitizeContentJson(draftContent.json)
    setContent({ json: sanitizedJson as typeof draftContent.json, text: draftContent.text })
    setTags(draft.data.tags ?? [])
  }, [])

  useEffect(() => {
    if (boards.length === 0) {
      return
    }
    if (!boardId || !boards.some((board) => board.id === boardId)) {
      setBoardId(boards[0].id)
    }
  }, [boards, boardId])

  useEffect(() => {
    const hasDraft =
      title.trim() !== '' ||
      content.text.trim() !== '' ||
      Boolean(content.json) ||
      tags.length > 0

    if (!hasDraft) {
      clearDraft(postDraftKey)
      return
    }

    const timer = window.setTimeout(() => {
      // 保存前清理 blob URL，只保存已上传成功的图片
      const sanitizedContent = {
        json: sanitizeContentJson(content.json),
        text: content.text,
      }
      saveDraft(postDraftKey, {
        title,
        boardId,
        content: sanitizedContent,
        tags,
      })
      setDraftHint('草稿已保存')
      window.setTimeout(() => setDraftHint(null), 1200)
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [boardId, content, tags, title])

  const canSubmit = useMemo(() => {
    if (boards.length === 0 || !boardId.trim()) {
      return false
    }
    if (!title.trim()) {
      return false
    }
    // Allow submit if there's text content OR any image nodes (including uploading ones)
    return content.text.trim() !== '' || hasImageNodes(content.json)
  }, [boardId, boards.length, content, title])

  const handleInlineImageUpload = async (file: File) => {
    if (!user) {
      setSubmitError('请先登录后上传图片')
      throw new Error('unauthorized')
    }
    if (!file.type.startsWith('image/')) {
      setSubmitError('仅支持图片文件')
      throw new Error('unsupported image')
    }
    if (file.size > maxInlineImageSize) {
      setSubmitError('图片不能超过 100MB')
      throw new Error('image too large')
    }
    return uploadInlineImage(file)
  }

  const handleSaveDraft = () => {
    saveDraft(postDraftKey, {
      title,
      boardId,
      content,
      tags,
    })
    setDraftHint('草稿已保存')
    window.setTimeout(() => setDraftHint(null), 1200)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    if (boards.length === 0) {
      return
    }
    if (!title.trim()) {
      setSubmitError('请填写标题')
      return
    }
    if (!boardId) {
      setSubmitError('请选择版块')
      return
    }

    if (!content.text.trim() && !hasImageNodes(content.json)) {
      setSubmitError('请输入内容或插入图片')
      return
    }

    setSubmitting(true)

    try {
      const uploadResult = await editorRef.current?.flushUploads()
      if (uploadResult?.failed) {
        setSubmitError('图片上传失败，请重试')
        return
      }
      const resolvedJson = uploadResult?.json ?? content.json
      // Safety check: ensure no blob URLs are being submitted
      const jsonStr = JSON.stringify(resolvedJson ?? {})
      if (jsonStr.includes('blob:')) {
        setSubmitError('部分图片上传失败，请检查图片并重试')
        return
      }
      await createPost({
        board_id: boardId,
        title: title.trim(),
        content: content.text.trim(),
        content_json: resolvedJson ?? undefined,
        tags,
      })
      clearDraft(postDraftKey)
      setTitle('')
      setContent({ json: null, text: '' })
      setTags([])
      navigate('/')
    } catch (error) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="form-page">
        <SectionCard title="发布帖子">
          {loading ? (
            <div className="page-status">正在加载版块...</div>
          ) : loadError ? (
            <ErrorState message={loadError} onRetry={loadBoards} />
          ) : (
            <form className="post-form" onSubmit={handleSubmit}>
              {boards.length === 0 ? (
                <div className="form-note">
                  暂无版块，暂时无法发帖。请先在后端初始化至少一个版块。
                </div>
              ) : null}
              <label className="form-field">
                <span className="form-label">版块</span>
                <select
                  className="form-select"
                  value={boards.length === 0 ? '' : boardId}
                  onChange={(event) => setBoardId(event.target.value)}
                  disabled={boards.length === 0}
                >
                  {boards.length === 0 ? (
                    <option value="">暂无版块</option>
                  ) : (
                    boards.map((board) => (
                      <option key={board.id} value={board.id}>
                        {board.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="form-field">
                <span className="form-label">标题</span>
                <input
                  className="form-input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="请输入帖子标题"
                  required
                />
              </label>
              <div className="editor-shell">
                <TagInput value={tags} onChange={setTags} maxTags={8} placeholder="Add tags" />
                <RichEditor
                  ref={editorRef}
                  value={content}
                  onChange={setContent}
                  onImageUpload={handleInlineImageUpload}
                  deferredUpload
                  placeholder="Body text (optional)"
                  disabled={submitting}
                />
                <div className="form-hint">支持拖拽/粘贴图片，单张图片不超过 100MB。</div>
                {draftHint ? <div className="draft-hint">{draftHint}</div> : null}
                <div className="editor-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleSaveDraft}
                    disabled={submitting}
                  >
                    Save Draft
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting || !canSubmit}
                  >
                    {submitting ? '提交中...' : 'Post'}
                  </button>
                </div>
              </div>
              {submitError ? <div className="form-error">{submitError}</div> : null}
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleCancel}
                  disabled={submitting}
                >
                  取消
                </button>
              </div>
            </form>
          )}
        </SectionCard>
      </main>
    </div>
  )
}

export default Submit


