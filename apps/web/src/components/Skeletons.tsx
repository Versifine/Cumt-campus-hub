import { Skeleton, Card } from 'antd'

type SkeletonProps = {
  count?: number
}

export const BoardSkeletonList = ({ count = 4 }: SkeletonProps) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    {Array.from({ length: count }).map((_, index) => (
      <Skeleton 
        key={`board-skeleton-${index}`} 
        active 
        title={{ width: '40%' }} 
        paragraph={{ rows: 1, width: '90%' }} 
      />
    ))}
  </div>
)

export const PostSkeletonList = ({ count = 4 }: SkeletonProps) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    {Array.from({ length: count }).map((_, index) => (
      <Card key={`post-skeleton-${index}`} bordered={false} style={{ borderRadius: 12 }}>
        <Skeleton active avatar paragraph={{ rows: 2 }} />
      </Card>
    ))}
  </div>
)
