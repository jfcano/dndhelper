import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { World } from '../lib/api'
import { ConfirmCascadeDeleteDialog } from '../components/ConfirmCascadeDeleteDialog'
import { IconButton } from '../components/IconButton'
import { IconPlus, IconTrash } from '../components/icons'
import { formatError } from '../lib/errors'
import { toSpanishStatus } from '../lib/statusLabels'

type WorldDeleteState = {
  world: World
  campaignCount: number
  campaignNames: string[]
}

export function WorldsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<World[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deletingWorldId, setDeletingWorldId] = useState<string | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<WorldDeleteState | null>(null)

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

  async function openDeleteWorldDialog(world: World) {
    setError(null)
    try {
      const usage = await api.getWorldUsage(world.id)
      let names: string[] = []
      if (usage.campaign_count > 0) {
        const linked = await api.listCampaignsForWorld(world.id, 50, 0)
        names = linked.map((c) => c.name)
      }
      setDeleteDialog({
        world,
        campaignCount: usage.campaign_count,
        campaignNames: names,
      })
    } catch (e) {
      setError(formatError(e))
    }
  }

  async function confirmDeleteWorld() {
    if (!deleteDialog) return
    const { world, campaignCount } = deleteDialog
    setDeletingWorldId(world.id)
    setError(null)
    try {
      await api.deleteWorld(world.id, { cascade: campaignCount > 0 })
      setDeleteDialog(null)
      await reload()
    } catch (e) {
      setError(formatError(e))
    } finally {
      setDeletingWorldId(null)
    }
  }

  const deleteDetails =
    deleteDialog && deleteDialog.campaignCount > 0
      ? [
          `${deleteDialog.campaignCount} campaña(s) vinculada(s): ${deleteDialog.campaignNames.length ? deleteDialog.campaignNames.join(', ') : '(sin cargar nombres)'}.`,
          'Cada campaña se eliminará por completo, incluidas todas sus sesiones, brief, historia y outlines guardados.',
        ]
      : undefined

  return (
    <div className="page">
      <ConfirmCascadeDeleteDialog
        open={deleteDialog !== null}
        onClose={() => {
          if (deletingWorldId === null) setDeleteDialog(null)
        }}
        title={`Borrar mundo «${deleteDialog?.world.name ?? ''}»`}
        description={
          deleteDialog && deleteDialog.campaignCount > 0
            ? 'Este mundo tiene campañas que dependen de él. Si continúas, se eliminarán en cascada.'
            : 'Vas a eliminar este mundo y sus datos (contenido, plantilla de imágenes en servidor).'
        }
        details={deleteDetails}
        confirmLabel="Borrar mundo"
        busy={deletingWorldId !== null}
        onConfirm={() => void confirmDeleteWorld()}
      />

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
                      onClick={() => void openDeleteWorldDialog(w)}
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
