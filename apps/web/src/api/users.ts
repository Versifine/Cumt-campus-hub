import { apiRequest } from './client'

export type CurrentUser = {
  id: string
  nickname: string
  avatar: string
  cover: string
  bio: string
  created_at: string
  exp?: number
  level?: number
  level_title?: string
  posts_count?: number
  comments_count?: number
  followers_count?: number
  following_count?: number
}

export type UpdateUserInput = {
  nickname?: string
  bio?: string
  avatar?: string
  cover?: string
}

export const fetchCurrentUser = (): Promise<CurrentUser> =>
  apiRequest<CurrentUser>('/users/me')

export const updateCurrentUser = (data: UpdateUserInput): Promise<CurrentUser> =>
  apiRequest<CurrentUser>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  })

export const followUser = (userId: string): Promise<void> =>
  apiRequest(`/users/${userId}/follow`, { method: 'POST' })

export const unfollowUser = (userId: string): Promise<void> =>
  apiRequest(`/users/${userId}/follow`, { method: 'DELETE' })

export type PublicUser = {
  id: string
  nickname: string
  avatar: string
  cover: string
  bio: string
  created_at: string
  exp: number
  level: number
  level_title: string
  posts_count: number
  comments_count: number
  followers_count: number
  following_count: number
  is_following: boolean
}

export type FollowUserItem = {
  id: string
  nickname: string
  avatar: string
  bio: string
  created_at: string
  level?: number
  level_title?: string
}

export type FollowUserListResponse = {
  items: FollowUserItem[]
  total: number
}

export type UserCommentItem = {
  id: string
  post_id: string
  parent_id: string
  author_id: string
  content: string
  content_json?: unknown
  created_at: string
}

export type UserCommentListResponse = {
  items: UserCommentItem[]
  total: number
}

export const fetchUserProfile = (userId: string): Promise<PublicUser> =>
  apiRequest<PublicUser>(`/users/${userId}`)

export const fetchFollowers = (userId: string, page = 1, pageSize = 20): Promise<FollowUserListResponse> => {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  return apiRequest<FollowUserListResponse>(`/users/${userId}/followers?${params.toString()}`)
}

export const fetchFollowing = (userId: string, page = 1, pageSize = 20): Promise<FollowUserListResponse> => {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  return apiRequest<FollowUserListResponse>(`/users/${userId}/following?${params.toString()}`)
}

export const fetchUserComments = (userId: string, page = 1, pageSize = 20): Promise<UserCommentListResponse> => {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  return apiRequest<UserCommentListResponse>(`/users/${userId}/comments?${params.toString()}`)
}
