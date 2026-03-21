import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { World } from '../lib/api'
import { formatError } from '../lib/errors'
import { toSpanishStatus } from '../lib/statusLabels'

export function WorldsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<World[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deletingWorldId, setDeletingWorldId] = useState<string | null>(null)

  async function reload() {
    setError(null)
    try {
      setItems(await api.listWorlds())
    } catch (e) {
      setError(formatError(e))
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
      const created = await api.createWorld({ name: 'Nuevo mundo' })
      await reload()
      navigate(`/worlds/${created.id}`)
    } catch (e) {
      setError(formatError(e))
    } finally {
      setCreating(false)
    }
  }

  async function onDeleteWorld(world: World) {
    let campaignCount = 0
    try {
      const usage = await api.getWorldUsage(world.id)
      campaignCount = usage.campaign_count
    } catch (e) {
      setError(formatError(e))
      return
    }

    if (campaignCount > 0) {
      window.alert(`No puedes borrar "${world.name}" porque está siendo usado por ${campaignCount} campaña(s).`)
      return
    }

    const ok = window.confirm(
      `¿Seguro que quieres borrar "${world.name}"? Actualmente lo usan ${campaignCount} campaña(s). Esta acción no se puede deshacer.`,
    )
    if (!ok) return

    setDeletingWorldId(world.id)
    setError(null)
    try {
      await api.deleteWorld(world.id)
      await reload()
    } catch (e) {
      setError(formatError(e))
    } finally {
      setDeletingWorldId(null)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Mundos</h2>
        <div style={{ display: 'flex', gap: 8 }}>
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
                <th style={{ textAlign: 'left', padding: 10 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <td style={{ padding: 10 }}>
                    <Link to={`/worlds/${w.id}`}>{w.name}</Link>
                  </td>
                  <td style={{ padding: 10 }}>{toSpanishStatus(w.status)}</td>
                  <td style={{ padding: 10 }}>
                    <small style={{ opacity: 0.8 }}>{w.updated_at}</small>
                  </td>
                  <td style={{ padding: 10 }}>
                    <button onClick={() => void onDeleteWorld(w)} disabled={deletingWorldId === w.id}>
                      {deletingWorldId === w.id ? 'Borrando…' : 'Borrar'}
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td style={{ padding: 10, opacity: 0.8 }} colSpan={4}>
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

