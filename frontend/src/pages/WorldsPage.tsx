import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { World } from '../lib/api'
import { IconButton } from '../components/IconButton'
import { IconPlus, IconTrash } from '../components/icons'
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
    <div className="page">
      <div className="page-head">
        <h2>Mundos</h2>
        <div className="btn-row">
          <IconButton
            label="Crear nuevo mundo"
            textShort="Nuevo"
            busy={creating}
            busyLabel="Creando mundo…"
            busyShort="…"
            onClick={() => void onCreate()}
          >
            <IconPlus />
          </IconButton>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {!items && !error && <div className="loading">Cargando…</div>}

      {items && (
        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Estado</th>
                <th>Actualizado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id}>
                  <td>
                    <Link to={`/worlds/${w.id}`}>{w.name}</Link>
                  </td>
                  <td>{toSpanishStatus(w.status)}</td>
                  <td>
                    <small className="muted">{w.updated_at}</small>
                  </td>
                  <td>
                    <IconButton
                      label={`Borrar mundo «${w.name}»`}
                      textShort="Borrar"
                      busy={deletingWorldId === w.id}
                      busyLabel="Borrando…"
                      busyShort="…"
                      className="btn-icon--inline"
                      onClick={() => void onDeleteWorld(w)}
                    >
                      <IconTrash />
                    </IconButton>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="muted" colSpan={4}>
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

