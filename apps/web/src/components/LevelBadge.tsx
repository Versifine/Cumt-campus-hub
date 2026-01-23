import { Tag } from 'antd'

type LevelBadgeProps = {
  level?: number | null
  title?: string | null
  compact?: boolean
}

const titleToLevel: Record<string, number> = {
  萌新: 1,
  进阶: 2,
  老鸟: 3,
  大佬: 4,
}

const resolveLevel = (level?: number | null, title?: string | null) => {
  if (typeof level === 'number' && level > 0) return level
  if (title && titleToLevel[title]) return titleToLevel[title]
  return null
}

const getLevelColor = (level?: number | null) => {
  if (!level || level <= 1) return undefined
  if (level === 2) return 'blue'
  if (level === 3) return 'gold'
  return 'volcano'
}

const LevelBadge = ({ level, title, compact }: LevelBadgeProps) => {
  const resolvedLevel = resolveLevel(level, title)
  if (!resolvedLevel) return null
  const label = title ? `Lv${resolvedLevel} · ${title}` : `Lv${resolvedLevel}`

  return (
    <Tag
      color={getLevelColor(resolvedLevel)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        verticalAlign: 'middle',
        marginInlineStart: 0,
        fontSize: compact ? '0.7rem' : '0.8rem',
        padding: compact ? '0 6px' : '2px 8px',
        lineHeight: compact ? '18px' : '22px',
        height: compact ? 18 : 22,
      }}
    >
      {label}
    </Tag>
  )
}

export default LevelBadge
