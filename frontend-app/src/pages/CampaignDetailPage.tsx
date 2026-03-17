import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Campaign, CampaignBrief, World } from '../lib/api'
import { formatError } from '../lib/errors'

export function CampaignDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [worlds, setWorlds] = useState<World[] | null>(null)
  const [worldId, setWorldId] = useState<string>('')
  const [brief, setBrief] = useState<CampaignBrief>({
    kind: 'sandbox',
    tone: null,
    themes: [],
    starting_level: 1,
    inspirations: [],
  })
  const [saving, setSaving] = useState(false)
  const [generatingWorld, setGeneratingWorld] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let alive = true
    Promise.all([api.getCampaign(id), api.listWorlds()])
      .then(([c, ws]) => {
        if (!alive) return
        setCampaign(c)
        setWorlds(ws)
        setWorldId(c.world_id ?? '')
        const b = (c.brief_draft ?? c.brief_final) as CampaignBrief | null
        if (b && typeof b === 'object' && typeof b.kind === 'string') {
          setBrief({
            kind: b.kind,
            tone: b.tone ?? null,
            themes: Array.isArray(b.themes) ? b.themes : [],
            starting_level: (b.starting_level ?? 1) as number,
            inspirations: Array.isArray(b.inspirations) ? b.inspirations : [],
            constraints: b.constraints ?? null,
          })
        }
      })
      .catch((e) => {
        if (!alive) return
        setError(formatError(e))
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
    setOk(null)
    try {
      const updated = await api.patchCampaign(id, { world_id: worldId === '' ? null : worldId })
      setCampaign(updated)
      setOk('Guardado')
    } catch (e) {
      setError(formatError(e))
    } finally {
      setSaving(false)
    }
  }

  async function onSaveBriefDraft() {
    if (!id || !campaign) return
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      const updated = await api.setBrief(id, {
        ...brief,
        themes: (brief.themes ?? []).filter(Boolean),
        inspirations: (brief.inspirations ?? []).filter(Boolean),
      })
      setCampaign(updated)
      setOk('Brief guardado')
    } catch (e) {
      setError(formatError(e))
    } finally {
      setSaving(false)
    }
  }

  async function onApproveBrief() {
    if (!id || !campaign) return
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      const updated = await api.approveBrief(id)
      setCampaign(updated)
      setOk('Brief aprobado')
    } catch (e) {
      setError(formatError(e))
    } finally {
      setSaving(false)
    }
  }

  async function onGenerateWorld() {
    if (!id || !campaign) return
    setGeneratingWorld(true)
    setError(null)
    setOk(null)
    try {
      const updated = await api.generateWorldForCampaign(id)
      setCampaign(updated)
      setWorldId(updated.world_id ?? '')
      setOk('World generado')
      if (updated.world_id) {
        // refrescar lista de worlds para que aparezca el nuevo
        setWorlds(await api.listWorlds())
      }
    } catch (e) {
      setError(formatError(e))
    } finally {
      setGeneratingWorld(false)
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
      {ok && <div style={{ color: 'lightgreen' }}>{ok}</div>}
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
              <h3 style={{ margin: 0 }}>Brief (preferencias)</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onSaveBriefDraft} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar borrador'}
                </button>
                <button onClick={onApproveBrief} disabled={saving || !campaign.brief_draft}>
                  Aprobar
                </button>
              </div>
            </div>

            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ opacity: 0.75, fontSize: 12 }}>Tipo de campaña</span>
                <input
                  value={brief.kind}
                  onChange={(e) => setBrief((b) => ({ ...b, kind: e.target.value }))}
                  placeholder="sandbox / investigación / épica…"
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ opacity: 0.75, fontSize: 12 }}>Tono</span>
                <input
                  value={brief.tone ?? ''}
                  onChange={(e) => setBrief((b) => ({ ...b, tone: e.target.value || null }))}
                  placeholder="heroico, oscuro, pulp…"
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ opacity: 0.75, fontSize: 12 }}>Temas (separados por coma)</span>
                <input
                  value={(brief.themes ?? []).join(', ')}
                  onChange={(e) =>
                    setBrief((b) => ({
                      ...b,
                      themes: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }))
                  }
                  placeholder="intriga, exploración, horror…"
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ opacity: 0.75, fontSize: 12 }}>Nivel inicial</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={brief.starting_level ?? 1}
                  onChange={(e) => setBrief((b) => ({ ...b, starting_level: Number(e.target.value || 1) }))}
                />
              </label>
              <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
                <span style={{ opacity: 0.75, fontSize: 12 }}>Inspiraciones (separadas por coma)</span>
                <input
                  value={(brief.inspirations ?? []).join(', ')}
                  onChange={(e) =>
                    setBrief((b) => ({
                      ...b,
                      inspirations: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }))
                  }
                  placeholder="The Witcher, Eberron, Zelda…"
                />
              </label>
            </div>

            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <small style={{ opacity: 0.8 }}>Estado: {campaign.brief_status}</small>
              <button onClick={onGenerateWorld} disabled={generatingWorld || campaign.brief_status !== 'approved'}>
                {generatingWorld ? 'Generando…' : 'Generar mundo'}
              </button>
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

