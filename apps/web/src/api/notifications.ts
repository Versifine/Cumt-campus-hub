import { apiRequest } from './client'

export type NotificationItem = {
  id: string
  actor_id: string
  actor_name: string
  actor_avatar: string
  type: 'comment' | 'reply' | 'follow' | 'like'
  target_type: string
  target_id: string
  read: boolean
  created_at: string
}

export type NotificationsResponse = {
  data: NotificationItem[]
  total: number
  page: number
  page_size: number
}

export type UnreadCountResponse = {
  count: number
}

export const fetchNotifications = async (
  page = 1,
  pageSize = 20,
): Promise<NotificationsResponse> => {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  return apiRequest<NotificationsResponse>(`/notifications?${params.toString()}`)
}

export const fetchUnreadCount = async (): Promise<UnreadCountResponse> =>
  apiRequest<UnreadCountResponse>('/notifications/unread-count')

export const markNotificationRead = async (id: string): Promise<{ success: boolean }> =>
  apiRequest<{ success: boolean }>(`/notifications/${id}`, {
    method: 'PATCH',
  })

export const markAllNotificationsRead = async (): Promise<{ success: boolean }> =>
  apiRequest<{ success: boolean }>('/notifications/read-all', {
    method: 'POST',
  })
