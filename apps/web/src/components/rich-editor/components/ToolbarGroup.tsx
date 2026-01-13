import { memo, type ReactNode } from 'react'

type ToolbarGroupProps = {
  children: ReactNode
}

export const ToolbarGroup = memo(({ children }: ToolbarGroupProps) => {
  return <div className="rich-editor__toolbar-group">{children}</div>
})

ToolbarGroup.displayName = 'ToolbarGroup'
