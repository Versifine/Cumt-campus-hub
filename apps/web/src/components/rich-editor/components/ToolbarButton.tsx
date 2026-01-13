import { memo, type MouseEvent } from 'react'

type ToolbarButtonProps = {
  label: string
  title: string
  active?: boolean
  disabled?: boolean
  className?: string
  onMouseDown?: (e: MouseEvent<HTMLButtonElement>) => void
  onClick?: () => void
}

export const ToolbarButton = memo(
  ({ label, title, active, disabled, className, onMouseDown, onClick }: ToolbarButtonProps) => {
    const baseClass = 'rich-editor__tool'
    const classes = [baseClass, active ? 'is-active' : '', className ?? ''].filter(Boolean).join(' ')

    return (
      <button
        type="button"
        className={classes}
        onMouseDown={onMouseDown}
        onClick={onClick}
        title={title}
        disabled={disabled}
        aria-pressed={active}
      >
        <span className="rich-editor__tool-label">{label}</span>
      </button>
    )
  },
)

ToolbarButton.displayName = 'ToolbarButton'
