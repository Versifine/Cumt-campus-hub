import { List, Typography, theme } from 'antd'
import type { Board } from '../api/boards'

const { Text } = Typography

type BoardListProps = {
  boards: Board[]
  activeBoardId?: string | null
  onSelect?: (boardId: string | null) => void
}

const BoardList = ({ boards, activeBoardId, onSelect }: BoardListProps) => {
  const { token } = theme.useToken()

  // Include "All Boards" as the first item
  const allItems = [
    { id: null, name: 'All Boards', description: 'Latest posts across campus.' },
    ...boards
  ]

  return (
    <List
      itemLayout="horizontal"
      dataSource={allItems}
      split={false}
      renderItem={(item) => {
        const isActive = item.id === activeBoardId
        return (
          <List.Item
            onClick={() => onSelect?.(item.id ?? null)}
            style={{
              cursor: 'pointer',
              padding: '12px 16px',
              borderRadius: token.borderRadiusLG,
              marginBottom: 8,
              border: `1px solid ${isActive ? token.colorPrimary : 'transparent'}`,
              background: isActive ? token.colorPrimaryBg : 'rgba(255,255,255,0.5)',
              transition: 'all 0.2s',
            }}
            className="hover:bg-gray-50" // You might want to remove this if not using Tailwind
          >
            <div style={{ width: '100%' }}>
              <div style={{ 
                fontWeight: 600, 
                color: isActive ? token.colorPrimaryTextActive : token.colorText 
              }}>
                {item.name}
              </div>
              <Text type="secondary" style={{ fontSize: '0.85rem' }}>
                {item.description}
              </Text>
            </div>
          </List.Item>
        )
      }}
    />
  )
}

export default BoardList
