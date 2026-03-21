import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { Campaign } from '../lib/api'
import { ConfirmCascadeDeleteDialog } from '../components/ConfirmCascadeDeleteDialog'
import { IconButton } from '../components/IconButton'
import { IconPlus, IconTrash } from '../components/icons'
import { formatError } from '../lib/errors'
import { toSpanishStatus } from '../lib/statusLabels'

function buildCampaignDeleteDetails(c: Campaign, sessionCount: number): string[] {
  const d: string[] = []
  if (sessionCount > 0) {
    d.push(`${sessionCount} sesión(es) con resúmenes, notas y contenido guardado`)
  }
  if (c.brief_draft || c.brief_final) {
    d.push('Resumen inicial (brief) y datos del asistente de campaña')
  }
  if (c.story_draft || c.story_final) {
    d.push('Historia / guion narrativo generado')
  }
  if (c.outline_draft || c.outline_final) {
    d.push('Outline de campaña')
  }
  if (c.world_id) {
    d.push('El mundo vinculado no se elimina; solo deja de estar asociado a esta campaña')
  }
  if (d.length === 0) {
    d.push('Todos los datos de la campaña en la base de datos')
  }
  return d
}

type CampaignDeleteState = { campaign: Campaign; sessionCount: number }

export function CampaignsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Campaign[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<CampaignDeleteState | null>(null)

  async function reload() {
    setError(null)
    try {
      setItems(await api.listCampaigns())
    } catch (e) {
      setError(formatError(e))
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  async function onCreateCampaign() {
    setCreating(true)
    setError(null)
    try {
      const created = await api.createCampaign({ name: 'Nueva campaña', system: '5e' })
      navigate(`/campaigns/${created.id}`)
    } catch (e) {
      setError(formatError(e))
    } finally {
      setCreating(false)
    }
  }

  async function openDeleteCampaignDialog(c: Campaign) {
    setError(null)
    try {
      const sessions = await api.listSessionsForCampaign(c.id, 200, 0)
      setDeleteDialog({ campaign: c, sessionCount: sessions.length })
    } catch (e) {
      setError(formatError(e))
    }
  }

  async function confirmDeleteCampaign() {
    if (!deleteDialog) return
    const { campaign } = deleteDialog
    setDeletingCampaignId(campaign.id)
    setError(null)
    try {
      await api.deleteCampaign(campaign.id, { cascade: true })
      setDeleteDialog(null)
      await reload()
    } catch (e) {
      setError(formatError(e))
    } finally {
      setDeletingCampaignId(null)
    }
  }

  const rows = useMemo(() => items ?? [], [items])

  return (
    <div className="page">
      <ConfirmCascadeDeleteDialog
        open={deleteDialog !== null}
        onClose={() => {
          if (deletingCampaignId === null) setDeleteDialog(null)
        }}
        title={`Borrar campaña «${deleteDialog?.campaign.name ?? ''}»`}
        description="Se eliminará la campaña y todo lo que depende solo de ella."
        details={deleteDialog ? buildCampaignDeleteDetails(deleteDialog.campaign, deleteDialog.sessionCount) : undefined}
        confirmLabel="Borrar campaña"
        busy={deletingCampaignId !== null}
        onConfirm={() => void confirmDeleteCampaign()}
      />

      <div className="page-head">
        <h2>Campañas</h2>
        <div className="btn-row">
          <IconButton
            label="Crear nueva campaña"
            textShort="Nueva"
            busy={creating}
            busyLabel="Creando campaña…"
            busyShort="…"
            onClick={() => void onCreateCampaign()}
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
                <th>Sistema</th>
                <th>Mundo</th>
                <th>Resumen inicial</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/campaigns/${c.id}`}>{c.name}</Link>
                  </td>
                  <td>{c.system}</td>
                  <td>{c.world_id ? <code>{c.world_id.slice(0, 8)}…</code> : <em>—</em>}</td>
                  <td>{toSpanishStatus(c.brief_status)}</td>
                  <td>
                    <IconButton
                      label={`Borrar campaña «${c.name}»`}
                      textShort="Borrar"
                      busy={deletingCampaignId === c.id}
                      busyLabel="Borrando…"
                      busyShort="…"
                      className="btn-icon--inline"
                      onClick={() => void openDeleteCampaignDialog(c)}
                    >
                      <IconTrash />
                    </IconButton>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="muted" colSpan={5}>
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
