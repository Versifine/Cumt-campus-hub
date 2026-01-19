import { Card } from 'antd'
import type { ReactNode } from 'react'

type SectionCardProps = {
  title: string
  children: ReactNode
  actions?: ReactNode
  className?: string
  loading?: boolean
  style?: React.CSSProperties
}

const SectionCard = ({
  title,
  children,
  actions,
  className,
  loading = false,
  style,
}: SectionCardProps) => {
  return (
    <Card
      title={title}
      extra={actions}
      className={className}
      loading={loading}
      bordered={false}
      style={{ 
        borderRadius: 12, 
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        background: 'rgba(255,255,255,0.95)',
        ...style
      }}
      headStyle={{
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        fontSize: '0.95rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'rgba(0,0,0,0.65)'
      }}
      bodyStyle={{ padding: '16px 20px' }}
    >
      {children}
    </Card>
  )
}

export default SectionCard
