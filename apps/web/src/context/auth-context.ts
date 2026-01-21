import { createContext } from 'react'
import type { AuthUser } from '../store/auth'

export type AuthContextValue = {
  user: AuthUser | null
  checking: boolean
  token: string | null
  setUser: (user: AuthUser | null) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
