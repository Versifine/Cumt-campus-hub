import type { JSONContent } from '@tiptap/react'

export type UploadResult = {
  url: string
  width?: number
  height?: number
}

export type RichEditorValue = {
  json: JSONContent | null
  text: string
}

export type RichEditorHandle = {
  focus: () => void
  insertText: (text: string) => void
  setContent: (json: JSONContent | null) => void
  flushUploads: () => Promise<{ json: JSONContent | null; failed: boolean }>
}

export type RichEditorProps = {
  value: RichEditorValue
  onChange: (value: RichEditorValue) => void
  onImageUpload?: (file: File) => Promise<UploadResult>
  placeholder?: string
  disabled?: boolean
  deferredUpload?: boolean
  variant?: 'post' | 'comment'
}

export type UploadEntry = {
  file: File
  blobUrl: string
  status: 'pending' | 'uploading' | 'success' | 'error'
}

export type ImageUploadConfig = {
  deferredUpload?: boolean
  onImageUpload?: (file: File) => Promise<UploadResult>
}
