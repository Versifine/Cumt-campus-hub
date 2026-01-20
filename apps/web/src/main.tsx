import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { ConfigProvider, App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import router from './router'

type AuthInvalidDetail = {
  from?: string
}

const attachAuthListener = () => {
  const windowRef = window as Window & { __authListenerAttached?: boolean }
  if (windowRef.__authListenerAttached) {
    return
  }

  windowRef.__authListenerAttached = true

  window.addEventListener('auth:invalid', (event) => {
    const detail = (event as CustomEvent<AuthInvalidDetail>).detail
    const currentPath = router.state.location.pathname
    if (currentPath === '/login') {
      return
    }

    router.navigate('/login', {
      replace: true,
      state: { from: detail?.from },
    })
  })
}

attachAuthListener()

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#c55f24',
          borderRadius: 8,
          fontFamily: "'Space Grotesk', 'Noto Sans SC', sans-serif",
        },
      }}
    >
      <App>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </QueryClientProvider>
      </App>
    </ConfigProvider>
  </StrictMode>,
)
