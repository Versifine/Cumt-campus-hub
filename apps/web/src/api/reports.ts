import { apiRequest } from './client'

export type ReportTargetType = 'post' | 'comment' | 'user'

export type ReportRequest = {
  target_type: ReportTargetType
  target_id: string
  reason: string
  detail: string
}

export type ReportResponse = {
  id: string
  status: string
  created_at: string
}

export const createReport = async (data: ReportRequest): Promise<ReportResponse> => {
  return apiRequest<ReportResponse>('reports', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export type ReportItem = {
  id: string
  target_type: string
  target_id: string
  reporter_id: string
  reason: string
  detail: string
  status: string
  action: string
  note: string
  handled_by: string
  created_at: string
  updated_at: string
}

export type ReportListResponse = {
  items: ReportItem[]
  total: number
}

export const fetchReports = async (page = 1, pageSize = 20, status?: string): Promise<ReportListResponse> => {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  if (status) {
    params.set('status', status)
  }
  return apiRequest<ReportListResponse>(`/reports?${params.toString()}`)
}

export const updateReport = async (
  reportId: string, 
  data: { status: string; action?: string; note?: string }
): Promise<ReportItem> => {
  return apiRequest<ReportItem>(`/reports/${reportId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}
