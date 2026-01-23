import { apiRequest } from './client'
import type { AuthUser } from '../store/auth'

export type AuthResponse = {
  token: string
  user: AuthUser
}

export type RegisterResponse = {
  message: string
}

export type VerifyEmailResponse = {
  message: string
}

export type ResendVerificationResponse = {
  message: string
}

export const login = (account: string, password: string): Promise<AuthResponse> =>
  apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ account, password }),
  })

export const register = (
  account: string,
  password: string,
  confirmPassword: string,
  nickname: string,
): Promise<RegisterResponse> =>
  apiRequest<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      account,
      password,
      confirm_password: confirmPassword,
      nickname,
    }),
  })

export const verifyEmail = (token: string): Promise<VerifyEmailResponse> =>
  apiRequest<VerifyEmailResponse>(`/auth/verify-email?token=${encodeURIComponent(token)}`, {
    method: 'GET',
  })

export const resendVerification = (account: string): Promise<ResendVerificationResponse> =>
  apiRequest<ResendVerificationResponse>('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ account }),
  })
