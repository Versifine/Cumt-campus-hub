import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchCurrentUser } from '../api/users'
import {
  clearAuth,
  getStoredUser,
  getToken,
  setStoredUser,
  type AuthUser,
} from '../store/auth'

type AuthContextValue = {
  user: AuthUser | null
  checking: boolean
  setUser: (user: AuthUser | null) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser())
  const [checking, setChecking] = useState<boolean>(() => Boolean(getToken()))

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setChecking(false)
      setUser(null)
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

  useEffect(() => {
    const handler = () => {
      clearAuth()
      setUser(null)
      setChecking(false)
    }

    window.addEventListener('auth:invalid', handler)
    return () => window.removeEventListener('auth:invalid', handler)
  }, [])

  const logout = () => {
    clearAuth()
    setUser(null)
  }

  const value = useMemo(
    () => ({
      user,
      checking,
      setUser,
      logout,
    }),
    [user, checking],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
