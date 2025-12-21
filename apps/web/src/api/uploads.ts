import { apiRequest } from './client'

export type UploadImageResponse = {
  url: string
  width?: number
  height?: number
}

export const uploadInlineImage = (file: File): Promise<UploadImageResponse> => {
  const formData = new FormData()
  formData.append('file', file)

  return apiRequest<UploadImageResponse>('/api/uploads/images', {
    method: 'POST',
    body: formData,
  })
}
