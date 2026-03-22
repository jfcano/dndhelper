import { type ReactNode } from 'react'

export type PlayerDerived = {
  id: string
  name: string
  summary: string
  basicSheet: unknown
}

function formatSheetLabel(rawKey: string): string {
  return rawKey
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase())
}

function formatSheetScalar(value: unknown): string {
  if (value == null) return '(vacío)'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  return String(value)
}

export function renderStructuredSheet(value: unknown, level = 0): ReactNode {
  if (value == null) return <span style={{ opacity: 0.75 }}>(vacío)</span>

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <span>{String(value)}</span>
  }

  if (Array.isArray(value)) {
    if (!value.length) return <span style={{ opacity: 0.75 }}>(sin elementos)</span>
    return (
      <ul style={{ margin: 0, paddingLeft: level === 0 ? 18 : 16, display: 'grid', gap: 4 }}>
        {value.map((item, idx) => (
          <li key={`sheet-list-${level}-${idx}`}>{renderStructuredSheet(item, level + 1)}</li>
        ))}
      </ul>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (!entries.length) return <span style={{ opacity: 0.75 }}>(sin contenido)</span>
    const scalarEntries = entries.filter(([, v]) => v == null || ['string', 'number', 'boolean'].includes(typeof v))
    const complexEntries = entries.filter(([, v]) => !(v == null || ['string', 'number', 'boolean'].includes(typeof v)))

    return (
      <div style={{ display: 'grid', gap: 8, textAlign: 'left' }}>
        {scalarEntries.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(140px, 220px) 1fr',
              gap: 8,
              alignItems: 'start',
            }}
          >
            {scalarEntries.map(([k, v]) => (
              <div key={`sheet-scalar-row-${level}-${k}`} style={{ display: 'contents' }}>
                <div style={{ opacity: 0.85, fontWeight: 650 }}>{formatSheetLabel(k)}</div>
                <div>{formatSheetScalar(v)}</div>
              </div>
            ))}
          </div>
        )}

        {complexEntries.map(([k, v]) => (
          <div key={`sheet-key-${level}-${k}`} style={{ marginLeft: level > 0 ? 8 : 0 }}>
            <div style={{ fontWeight: 700, marginTop: scalarEntries.length > 0 ? 2 : 0 }}>{formatSheetLabel(k)}</div>
            <div style={{ marginLeft: 10, marginTop: 4 }}>{renderStructuredSheet(v, level + 1)}</div>
          </div>
        ))}
      </div>
    )
  }

  return <span>{String(value)}</span>
}
