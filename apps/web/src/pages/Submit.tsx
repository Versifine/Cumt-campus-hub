import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Layout, 
  Card, 
  Form, 
  Input, 
  Select, 
  Button, 
  Alert, 
  Typography, 
  Space,
  message
} from 'antd'
import { getErrorMessage } from '../api/client'
import { createPost } from '../api/posts'
import { uploadInlineImage } from '../api/uploads'
import { RichEditor, type RichEditorHandle, type RichEditorValue } from '../components/rich-editor'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { useBoards } from '../hooks/useBoards'
import { clearDraft, loadDraft, saveDraft } from '../utils/drafts'

const { Content } = Layout
const { Text } = Typography

const maxInlineImageSize = 100 * 1024 * 1024
const postDraftKey = 'draft:post'

type PostDraftPayload = {
  title: string
  boardId: string
  content: RichEditorValue
  tags: string[]
}

const hasImageNodes = (json: unknown): boolean => {
  if (!json || typeof json !== 'object') return false
  const node = json as any
  if (node.type === 'image') return true
  if (Array.isArray(node.content)) return node.content.some(hasImageNodes)
  return false
}

const sanitizeContentJson = (json: unknown): unknown => {
  if (!json || typeof json !== 'object') return json
  const node = json as any
  if (node.type === 'image' && node.attrs?.src?.startsWith('blob:')) return null
  if (Array.isArray(node.content)) {
    const filtered = node.content.map(sanitizeContentJson).filter((item: any) => item !== null)
    return { ...node, content: filtered }
  }
  return json
}

const Submit = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [form] = Form.useForm()

  const [content, setContent] = useState<RichEditorValue>({ json: null, text: '' })
  const editorRef = useRef<RichEditorHandle | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    data: boards = [],
    isLoading: boardsLoading,
    error: boardsError,
    refetch: refetchBoards,
  } = useBoards()

  // Load draft
  useEffect(() => {
    const draft = loadDraft<PostDraftPayload>(postDraftKey)
    if (draft) {
      form.setFieldsValue({
        title: draft.data.title,
        boardId: draft.data.boardId,
        tags: draft.data.tags
      })
      const draftContent = draft.data.content ?? { json: null, text: '' }
      const sanitizedJson = sanitizeContentJson(draftContent.json)
      setContent({ json: sanitizedJson as any, text: draftContent.text })
    }
  }, [form])

  // Auto save draft
  useEffect(() => {
    const values = form.getFieldsValue()
    const hasDraft = values.title || content.text || hasImageNodes(content.json) || (values.tags && values.tags.length > 0)

    if (!hasDraft) {
      clearDraft(postDraftKey)
      return
    }

    const timer = setTimeout(() => {
      saveDraft(postDraftKey, {
        title: values.title,
        boardId: values.boardId,
        content: { json: sanitizeContentJson(content.json) as any, text: content.text },
        tags: values.tags
      })
    }, 1500)

    return () => clearTimeout(timer)
  }, [content, form])

  const handleInlineImageUpload = async (file: File) => {
    if (!user) {
      message.error('请先登录')
      throw new Error('unauthorized')
    }
    if (file.size > maxInlineImageSize) {
      message.error('图片过大')
      throw new Error('too large')
    }
    return uploadInlineImage(file)
  }

  const handleSubmit = async (values: any) => {
    if (!content.text.trim() && !hasImageNodes(content.json)) {
      setSubmitError('请输入内容或插入图片')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const uploadResult = await editorRef.current?.flushUploads()
      if (uploadResult?.failed) {
        setSubmitError('部分图片上传失败')
        return
      }

      const resolvedJson = uploadResult?.json ?? content.json
      if (JSON.stringify(resolvedJson).includes('blob:')) {
        setSubmitError('图片尚未上传完成')
        return
      }

      await createPost({
        board_id: values.boardId,
        title: values.title.trim(),
        content: content.text.trim(),
        content_json: resolvedJson ?? undefined,
        tags: values.tags,
      })

      clearDraft(postDraftKey)
      message.success('发布成功')
      navigate('/')
    } catch (error) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  // Set default board if available
  useEffect(() => {
    if (boards.length > 0 && !form.getFieldValue('boardId')) {
      form.setFieldsValue({ boardId: boards[0].id })
    }
  }, [boards, form])

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <SiteHeader />
      <Content style={{ maxWidth: 840, margin: '24px auto', width: '100%', padding: '0 24px' }}>
        <Card title="发布帖子" bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <Form 
            form={form} 
            layout="vertical" 
            onFinish={handleSubmit}
            disabled={boardsLoading || submitting}
          >
            <Form.Item 
              name="boardId" 
              label="版块" 
              rules={[{ required: true, message: '请选择版块' }]}
            >
              <Select placeholder="选择版块" loading={boardsLoading}>
                {boards.map(b => (
                  <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>

            {boardsError && (
              <Alert
                type="error"
                showIcon
                message={getErrorMessage(boardsError)}
                action={(
                  <Button size="small" onClick={() => void refetchBoards()}>
                    重试
                  </Button>
                )}
                style={{ marginBottom: 16 }}
              />
            )}

            <Form.Item 
              name="title" 
              label="标题" 
              rules={[{ required: true, message: '请输入标题' }]}
            >
              <Input placeholder="请输入帖子标题" size="large" />
            </Form.Item>

            <Form.Item label="内容">
              <RichEditor
                ref={editorRef}
                value={content}
                onChange={setContent}
                onImageUpload={handleInlineImageUpload}
                deferredUpload
                placeholder="分享你的想法..."
                disabled={submitting}
              />
              <Text type="secondary" style={{ fontSize: '0.8rem', marginTop: 8, display: 'block' }}>
                支持拖拽上传图片
              </Text>
            </Form.Item>

            <Form.Item name="tags" label="标签">
              <Select mode="tags" placeholder="输入标签按回车" tokenSeparators={[',', ' ']} />
            </Form.Item>

            {submitError && <Alert type="error" message={submitError} showIcon style={{ marginBottom: 16 }} />}

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={submitting} size="large">
                  发布
                </Button>
                <Button onClick={() => navigate(-1)}>取消</Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </Content>
    </Layout>
  )
}

export default Submit
