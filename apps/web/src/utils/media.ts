export type MediaKind = 'image' | 'video'

export type MediaItem = {
  url: string
  type: MediaKind
  width?: number
  height?: number
  alt?: string
}

type AttachmentLike = {
  url: string
  filename?: string
  type?: string
}

const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])
const videoExtensions = new Set(['mp4', 'webm', 'ogg'])

const getFileExtension = (value: string) => {
  const parts = value.split('.')
  if (parts.length < 2) {
    return ''
  }
  return parts[parts.length - 1].toLowerCase()
}

const inferMediaKind = (value: AttachmentLike) => {
  if (value.type) {
    if (value.type.startsWith('image/')) {
      return 'image'
    }
    if (value.type.startsWith('video/')) {
      return 'video'
    }
  }

  const filename = value.filename ?? value.url
  const ext = getFileExtension(filename)
  if (imageExtensions.has(ext)) {
    return 'image'
  }
  if (videoExtensions.has(ext)) {
    return 'video'
  }
  return 'image'
}

const normalizeFromAttachments = (attachments: AttachmentLike[] | undefined) => {
  if (!attachments || attachments.length === 0) {
    return []
  }
  return attachments.map((item) => ({
    url: item.url,
    type: inferMediaKind(item),
    alt: item.filename ?? 'media',
  }))
}

const extractInlineMedia = (comment: {
  content_md?: string | null
  content_json?: unknown
}) => {
  void comment
  return [] as MediaItem[]
}

export const normalizeCommentMedia = (comment: {
  attachments?: AttachmentLike[]
  content_md?: string | null
  content_json?: unknown
}) => {
  const candidates = [
    ...normalizeFromAttachments(comment.attachments),
    ...extractInlineMedia(comment),
  ]
  const seen = new Set<string>()
  const out: MediaItem[] = []
  for (const item of candidates) {
    if (!item.url || seen.has(item.url)) {
      continue
    }
    seen.add(item.url)
    out.push(item)
  }
  return out
}

export const normalizeMediaFromAttachments = (
  attachments: AttachmentLike[] | undefined,
) => {
  return normalizeCommentMedia({ attachments })
}
