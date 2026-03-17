import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { Campaign } from '../lib/api'

export function CampaignsPage() {
  const [items, setItems] = useState<Campaign[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api
      .listCampaigns()
      .then((data) => {
        if (!alive) return
        setItems(data)
      })
      .catch((e) => {
        if (!alive) return
        setError(String(e))
      })
    return () => {
      alive = false
    }
  }, [])

  const rows = useMemo(() => items ?? [], [items])

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Campaigns</h2>
        <small style={{ opacity: 0.75 }}>Sólo lectura aquí (por ahora)</small>
      </div>

      {error && <div style={{ color: 'salmon' }}>{error}</div>}
      {!items && !error && <div>Cargando…</div>}

      {items && (
        <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'rgba(255,255,255,0.04)' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: 10 }}>Nombre</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Sistema</th>
                <th style={{ textAlign: 'left', padding: 10 }}>World</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Brief</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Outline</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <td style={{ padding: 10 }}>
                    <Link to={`/campaigns/${c.id}`}>{c.name}</Link>
                  </td>
                  <td style={{ padding: 10 }}>{c.system}</td>
                  <td style={{ padding: 10 }}>{c.world_id ? <code>{c.world_id.slice(0, 8)}…</code> : <em>—</em>}</td>
                  <td style={{ padding: 10 }}>{c.brief_status}</td>
                  <td style={{ padding: 10 }}>{c.outline_status}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td style={{ padding: 10, opacity: 0.8 }} colSpan={5}>
                    No hay campañas todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

