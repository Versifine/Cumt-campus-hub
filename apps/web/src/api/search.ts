import { apiRequest } from './client'

export type SearchPostsResponse<T> = {
  data: T[]
  total: number
  page: number
  page_size: number
}

export type SearchUsersResponse<T> = {
  data: T[]
  total: number
  page: number
  page_size: number
}

export const fetchSearchPosts = async <T>(
  query: string,
  page = 1,
  pageSize = 20,
): Promise<SearchPostsResponse<T>> => {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    page_size: String(pageSize),
  })

  return apiRequest<SearchPostsResponse<T>>(`/search/posts?${params.toString()}`)
}

export const fetchSearchUsers = async <T>(
  query: string,
  page = 1,
  pageSize = 20,
): Promise<SearchUsersResponse<T>> => {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    page_size: String(pageSize),
  })

  return apiRequest<SearchUsersResponse<T>>(`/search/users?${params.toString()}`)
}
