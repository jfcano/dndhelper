import type { CSSProperties, ReactNode } from 'react'
import './tabbar.css'

/** Contenedor de pestañas con el mismo aspecto en toda la app. */
export function TabBar({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div role="tablist" className={['tab-bar', className].filter(Boolean).join(' ')} style={style}>
      {children}
    </div>
  )
}

export function TabButton({
  active,
  children,
  onSelect,
}: {
  active: boolean
  children: ReactNode
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      className="tab-bar__btn"
      aria-selected={active}
      disabled={active}
      onClick={() => {
        if (!active) onSelect()
      }}
    >
      {children}
    </button>
  )
}
