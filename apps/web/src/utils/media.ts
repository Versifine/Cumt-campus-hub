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

const parseContentJSON = (value: unknown) => {
  if (!value) {
    return null
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown
    } catch {
      return null
    }
  }
  return value
}

const extractMediaFromJSON = (doc: unknown): MediaItem[] => {
  if (!doc || typeof doc !== 'object') {
    return []
  }
  const items: MediaItem[] = []
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') {
      return
    }
    if (node.type === 'image' && node.attrs?.src) {
      items.push({
        url: node.attrs.src as string,
        type: 'image',
        alt: node.attrs.alt as string | undefined,
        width: node.attrs.width as number | undefined,
        height: node.attrs.height as number | undefined,
      })
    }
    if (Array.isArray(node.content)) {
      node.content.forEach(visit)
    }
  }
  visit(doc)
  return items
}

const extractMediaFromMarkdown = (markdown: string | null | undefined) => {
  if (!markdown) {
    return []
  }
  const pattern = /!\[[^\]]*]\(([^)]+)\)/g
  const items: MediaItem[] = []
  let match = pattern.exec(markdown)
  while (match) {
    const url = match[1]
    if (url) {
      items.push({ url, type: 'image' })
    }
    match = pattern.exec(markdown)
  }
  return items
}

const extractInlineMedia = (comment: {
  content_md?: string | null
  content_json?: unknown
}) => {
  const jsonDoc = parseContentJSON(comment.content_json)
  if (jsonDoc) {
    return extractMediaFromJSON(jsonDoc)
  }
  return extractMediaFromMarkdown(comment.content_md)
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

export const extractMediaFromContent = (contentJson: unknown) => {
  const jsonDoc = parseContentJSON(contentJson)
  if (!jsonDoc) {
    return [] as MediaItem[]
  }
  return extractMediaFromJSON(jsonDoc)
}
