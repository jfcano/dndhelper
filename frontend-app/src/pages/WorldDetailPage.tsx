import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { World } from '../lib/api'
import { formatError } from '../lib/errors'

export function WorldDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [world, setWorld] = useState<World | null>(null)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let alive = true
    api
      .getWorld(id)
      .then((w) => {
        if (!alive) return
        setWorld(w)
        setContent(w.content_draft ?? '')
      })
      .catch((e) => {
        if (!alive) return
        setError(formatError(e))
      })
    return () => {
      alive = false
    }
  }, [id])

  async function onSave() {
    if (!id) return
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      const updated = await api.patchWorld(id, { content_draft: content })
      setWorld(updated)
      setOk('Guardado')
    } catch (e) {
      setError(formatError(e))
    } finally {
      setSaving(false)
    }
  }

  async function onApprove() {
    if (!id) return
    setApproving(true)
    setError(null)
    setOk(null)
    try {
      const updated = await api.approveWorld(id)
      setWorld(updated)
      setOk('Aprobado')
    } catch (e) {
      setError(formatError(e))
    } finally {
      setApproving(false)
    }
  }

  if (!id) return <div>Falta id</div>

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
          <button onClick={() => navigate(-1)}>←</button>
          <h2 style={{ margin: 0 }}>World</h2>
        </div>
        {world && <code>{world.id}</code>}
      </div>

      {error && <div style={{ color: 'salmon' }}>{error}</div>}
      {ok && <div style={{ color: 'lightgreen' }}>{ok}</div>}
      {!world && !error && <div>Cargando…</div>}

      {world && (
        <>
          <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>Nombre</div>
                <div style={{ fontWeight: 650 }}>{world.name}</div>
              </div>
              <div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>Estado</div>
                <div>{world.status}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onSave} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar borrador'}
                </button>
                <button onClick={onApprove} disabled={approving || world.status === 'approved'}>
                  {approving ? 'Aprobando…' : 'Aprobar'}
                </button>
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Borrador (content_draft)</h3>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={18}
              style={{
                width: '100%',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: 13,
                padding: 10,
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(0,0,0,0.25)',
                color: 'inherit',
              }}
            />
          </div>

          <details>
            <summary>Final (content_final)</summary>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{world.content_final}</pre>
          </details>
        </>
      )}
    </div>
  )
}

