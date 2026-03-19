import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { Campaign } from '../lib/api'
import { formatError } from '../lib/errors'
import { toSpanishStatus } from '../lib/statusLabels'

export function CampaignsPage() {
  const [items, setItems] = useState<Campaign[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null)

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
      await api.createCampaign({ name: 'Nueva campaña', system: '5e' })
      await reload()
    } catch (e) {
      setError(formatError(e))
    } finally {
      setCreating(false)
    }
  }

  async function onDeleteCampaign(c: Campaign) {
    const ok = window.confirm(`¿Seguro que quieres borrar "${c.name}"? Esta acción no se puede deshacer.`)
    if (!ok) return
    setDeletingCampaignId(c.id)
    setError(null)
    try {
      await api.deleteCampaign(c.id)
      await reload()
    } catch (e) {
      setError(formatError(e))
    } finally {
      setDeletingCampaignId(null)
    }
  }

  const rows = useMemo(() => items ?? [], [items])

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Campañas</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => void reload()}>Recargar</button>
          <button onClick={() => void onCreateCampaign()} disabled={creating}>
            {creating ? 'Creando…' : 'Crear campaña'}
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
                <th style={{ textAlign: 'left', padding: 10 }}>Sistema</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Mundo</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Resumen inicial</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Esquema</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Acciones</th>
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
                  <td style={{ padding: 10 }}>{toSpanishStatus(c.brief_status)}</td>
                  <td style={{ padding: 10 }}>{toSpanishStatus(c.outline_status)}</td>
                  <td style={{ padding: 10 }}>
                    <button onClick={() => void onDeleteCampaign(c)} disabled={deletingCampaignId === c.id}>
                      {deletingCampaignId === c.id ? 'Borrando…' : 'Borrar'}
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td style={{ padding: 10, opacity: 0.8 }} colSpan={6}>
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

