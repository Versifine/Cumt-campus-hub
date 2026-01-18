import { Result, Button } from 'antd'
import type { ReactNode } from 'react'

type ErrorStateProps = {
  message: string
  onRetry?: () => void
}

type EmptyStateProps = {
  title: string
  description?: string
  action?: ReactNode
}

export const ErrorState = ({ message, onRetry }: ErrorStateProps) => (
  <Result
    status="error"
    title="Something went wrong"
    subTitle={message}
    extra={
      onRetry && (
        <Button type="primary" onClick={onRetry}>
          Try Again
        </Button>
      )
    }
  />
)

export const EmptyState = ({ title, description, action }: EmptyStateProps) => (
  <Result
    title={title}
    subTitle={description}
    extra={action}
  />
)
