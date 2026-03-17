import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Campaign, World } from '../lib/api'

export function CampaignDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [worlds, setWorlds] = useState<World[] | null>(null)
  const [worldId, setWorldId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let alive = true
    Promise.all([api.getCampaign(id), api.listWorlds()])
      .then(([c, ws]) => {
        if (!alive) return
        setCampaign(c)
        setWorlds(ws)
        setWorldId(c.world_id ?? '')
      })
      .catch((e) => {
        if (!alive) return
        setError(String(e))
      })
    return () => {
      alive = false
    }
  }, [id])

  const worldOptions = useMemo(() => worlds ?? [], [worlds])

  async function onSaveWorldLink() {
    if (!id || !campaign) return
    setSaving(true)
    setError(null)
    try {
      const updated = await api.patchCampaign(id, { world_id: worldId === '' ? null : worldId })
      setCampaign(updated)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (!id) return <div>Falta id</div>

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
          <button onClick={() => navigate(-1)}>←</button>
          <h2 style={{ margin: 0 }}>Campaign</h2>
        </div>
        {campaign && <code>{campaign.id}</code>}
      </div>

      {error && <div style={{ color: 'salmon' }}>{error}</div>}
      {!campaign && !error && <div>Cargando…</div>}

      {campaign && (
        <>
          <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>Nombre</div>
                <div style={{ fontWeight: 650 }}>{campaign.name}</div>
              </div>
              <div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>Sistema</div>
                <div>{campaign.system}</div>
              </div>
              <div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>Brief</div>
                <div>{campaign.brief_status}</div>
              </div>
              <div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>Outline</div>
                <div>{campaign.outline_status}</div>
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h3 style={{ margin: 0 }}>World vinculado</h3>
              <button onClick={onSaveWorldLink} disabled={saving || !worlds}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>

            {!worlds && <div style={{ marginTop: 8 }}>Cargando worlds…</div>}
            {worlds && (
              <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={worldId} onChange={(e) => setWorldId(e.target.value)} style={{ minWidth: 320 }}>
                  <option value="">(sin world)</option>
                  {worldOptions.map((w) => (
                    <option value={w.id} key={w.id}>
                      {w.name} ({w.status})
                    </option>
                  ))}
                </select>
                {campaign.world_id && (
                  <Link to={`/worlds/${campaign.world_id}`}>Abrir world</Link>
                )}
              </div>
            )}
          </div>

          <details>
            <summary>Brief (JSON)</summary>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(campaign.brief_final ?? campaign.brief_draft, null, 2)}</pre>
          </details>
          <details>
            <summary>Outline (texto)</summary>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{campaign.outline_final ?? campaign.outline_draft}</pre>
          </details>
        </>
      )}
    </div>
  )
}

