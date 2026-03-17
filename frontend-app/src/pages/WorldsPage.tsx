import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { World } from '../lib/api'

export function WorldsPage() {
  const [items, setItems] = useState<World[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  async function reload() {
    setError(null)
    try {
      setItems(await api.listWorlds())
    } catch (e) {
      setError(String(e))
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const rows = useMemo(() => items ?? [], [items])

  async function onCreate() {
    setCreating(true)
    setError(null)
    try {
      await api.createWorld({ name: 'Nuevo mundo' })
      await reload()
    } catch (e) {
      setError(String(e))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Worlds</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => void reload()}>Recargar</button>
          <button onClick={() => void onCreate()} disabled={creating}>
            {creating ? 'Creando…' : 'Crear'}
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'salmon' }}>{error}</div>}
      {!items && !error && <div>Cargando…</div>}

      {items && (
        <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'rgba(255,255,255,0.04)' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: 10 }}>Nombre</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Estado</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <td style={{ padding: 10 }}>
                    <Link to={`/worlds/${w.id}`}>{w.name}</Link>
                  </td>
                  <td style={{ padding: 10 }}>{w.status}</td>
                  <td style={{ padding: 10 }}>
                    <small style={{ opacity: 0.8 }}>{w.updated_at}</small>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td style={{ padding: 10, opacity: 0.8 }} colSpan={3}>
                    No hay mundos todavía.
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

