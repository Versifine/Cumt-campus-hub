import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchCurrentUser } from '../api/users'
import {
  clearAuth,
  getStoredUser,
  getToken,
  setStoredUser,
  type AuthUser,
} from '../store/auth'
import { AuthContext } from './auth-context'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const storedToken = getToken()
    return storedToken ? getStoredUser() : null
  })
  const [checking, setChecking] = useState<boolean>(() => Boolean(getToken()))
  const token = getToken()

  useEffect(() => {
    const storedToken = getToken()
    if (!storedToken) {
      if (getStoredUser()) {
        clearAuth()
      }
      return
    }

    fetchCurrentUser()
      .then((profile) => {
        const nextUser = { 
          id: profile.id, 
          nickname: profile.nickname,
          avatar: profile.avatar,
        }
        setUser(nextUser)
        setStoredUser(nextUser)
      })
      .catch(() => {
        clearAuth()
        setUser(null)
      })
      .finally(() => {
        setChecking(false)
      })
  }, [])

  const handleAuthInvalid = useCallback(() => {
    clearAuth()
    setUser(null)
    setChecking(false)
  }, [])

  useEffect(() => {
    window.addEventListener('auth:invalid', handleAuthInvalid)
    return () => window.removeEventListener('auth:invalid', handleAuthInvalid)
  }, [handleAuthInvalid])

  const logout = () => {
    clearAuth()
    setUser(null)
  }

  const value = useMemo(
    () => ({
      user,
      checking,
      token,
      setUser,
      logout,
    }),
    [user, checking, token],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
