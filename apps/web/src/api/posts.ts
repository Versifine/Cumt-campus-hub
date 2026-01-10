import { apiRequest } from './client'

export type PostAuthor = {
  id: string
  nickname: string
}

export type AttachmentItem = {
  id: string
  filename: string
  url: string
  width?: number
  height?: number
}

export type PostItem = {
  id: string
  title: string
  author: PostAuthor
  created_at: string
  content?: string
  content_json?: unknown
  tags?: string[]
  attachments?: AttachmentItem[]
  board?: PostDetailBoard
  score?: number
  comment_count?: number
  award_count?: number
  my_vote?: number
}

export type PostListResponse = {
  items: PostItem[]
  total: number
}

export type PostDetailBoard = {
  id: string
  name: string
}

export type PostDetail = {
  id: string
  board: PostDetailBoard
  author: PostAuthor
  title: string
  content: string
  content_json?: unknown
  tags?: string[]
  attachments?: AttachmentItem[]
  created_at: string
  deleted_at: string | null
  score?: number
  my_vote?: number
  comment_count?: number
}

export type CreatePostInput = {
  board_id: string
  title: string
  content: string
  content_json?: unknown
  tags?: string[]
  attachments?: string[]
}

export type CreatePostResponse = {
  id: string
  board_id: string
  author_id: string
  title: string
  content: string
  content_json?: unknown
  tags?: string[]
  attachments?: AttachmentItem[]
  created_at: string
}

export type DeletePostResponse = {
  status: string
}

export type CommentItem = {
  id: string
  author: PostAuthor
  content: string
  content_json?: unknown
  tags?: string[]
  attachments?: AttachmentItem[]
  created_at: string
  parent_id?: string | null
  score?: number
  my_vote?: number
}

export type CreateCommentResponse = {
  id: string
  post_id: string
  author_id: string
  content: string
  content_json?: unknown
  tags?: string[]
  attachments?: AttachmentItem[]
  created_at: string
  parent_id?: string | null
  score?: number
  my_vote?: number
}

export type DeleteCommentResponse = {
  status: string
}

export type VoteResponse = {
  post_id: string
  score: number
  my_vote: number
}

export type CommentVoteResponse = {
  comment_id: string
  score: number
  my_vote: number
}

export const fetchPosts = (
  page: number,
  pageSize: number,
  boardId?: string,
): Promise<PostListResponse> => {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })

  if (boardId) {
    params.set('board_id', boardId)
  }

  return apiRequest<PostListResponse>(`/posts?${params.toString()}`)
}

export const fetchPostDetail = (postId: string): Promise<PostDetail> =>
  apiRequest<PostDetail>(`/posts/${postId}`)

export const createPost = (
  payload: CreatePostInput,
): Promise<CreatePostResponse> =>
  apiRequest<CreatePostResponse>('/posts', {
    method: 'POST',
    body: JSON.stringify({
      board_id: payload.board_id,
      title: payload.title,
      content: payload.content,
      ...(payload.content_json ? { content_json: payload.content_json } : {}),
      ...(payload.tags && payload.tags.length > 0 ? { tags: payload.tags } : {}),
      ...(payload.attachments && payload.attachments.length > 0
        ? { attachments: payload.attachments }
        : {}),
    }),
  })

export const deletePost = (postId: string): Promise<DeletePostResponse> =>
  apiRequest<DeletePostResponse>(`/posts/${postId}`, {
    method: 'DELETE',
  })

export const fetchComments = (postId: string): Promise<CommentItem[]> =>
  apiRequest<CommentItem[]>(`/posts/${postId}/comments`)

export type CreateCommentInput = {
  content: string
  content_json?: unknown
  tags?: string[]
  parent_id?: string | null
  attachments?: string[]
}

export const createComment = (
  postId: string,
  payload: CreateCommentInput,
): Promise<CreateCommentResponse> =>
  apiRequest<CreateCommentResponse>(`/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({
      content: payload.content,
      ...(payload.content_json ? { content_json: payload.content_json } : {}),
      ...(payload.tags && payload.tags.length > 0 ? { tags: payload.tags } : {}),
      ...(payload.parent_id ? { parent_id: payload.parent_id } : {}),
      ...(payload.attachments && payload.attachments.length > 0
        ? { attachments: payload.attachments }
        : {}),
    }),
  })

export const deleteComment = (
  postId: string,
  commentId: string,
): Promise<DeleteCommentResponse> =>
  apiRequest<DeleteCommentResponse>(`/posts/${postId}/comments/${commentId}`, {
    method: 'DELETE',
  })

export const voteComment = (
  postId: string,
  commentId: string,
  value: 1 | -1,
): Promise<CommentVoteResponse> =>
  apiRequest<CommentVoteResponse>(`/posts/${postId}/comments/${commentId}/votes`, {
    method: 'POST',
    body: JSON.stringify({ value }),
  })

export const clearCommentVote = (
  postId: string,
  commentId: string,
): Promise<CommentVoteResponse> =>
  apiRequest<CommentVoteResponse>(`/posts/${postId}/comments/${commentId}/votes`, {
    method: 'DELETE',
  })

export const votePost = (
  postId: string,
  value: 1 | -1,
): Promise<VoteResponse> =>
  apiRequest<VoteResponse>(`/posts/${postId}/votes`, {
    method: 'POST',
    body: JSON.stringify({ value }),
  })

export const clearVote = (postId: string): Promise<VoteResponse> =>
  apiRequest<VoteResponse>(`/posts/${postId}/votes`, {
    method: 'DELETE',
  })
