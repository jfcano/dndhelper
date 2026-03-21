import type { CSSProperties, ReactNode } from 'react'

const barStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 12,
  padding: 6,
  background: 'rgba(255,255,255,0.03)',
}

const tabButtonStyle = (active: boolean): CSSProperties => ({
  padding: '10px 18px',
  borderRadius: 10,
  border: active ? '1px solid rgba(255,255,255,0.35)' : '1px solid transparent',
  background: active ? 'rgba(255,255,255,0.16)' : 'transparent',
  fontSize: 15,
  fontWeight: 650,
  cursor: active ? 'default' : 'pointer',
  color: 'inherit',
})

/** Contenedor de pestañas con el mismo aspecto en toda la app. */
export function TabBar({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div role="tablist" style={{ ...barStyle, ...style }}>
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
      aria-selected={active}
      onClick={() => {
        if (!active) onSelect()
      }}
      style={tabButtonStyle(active)}
    >
      {children}
    </button>
  )
}
