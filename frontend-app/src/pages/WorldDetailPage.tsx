import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { World } from '../lib/api'
import { formatError } from '../lib/errors'
import { toSpanishStatus } from '../lib/statusLabels'

function renderInlineBold(text: string): ReactNode {
  // Soporta **negritas** de forma simple y segura (sin HTML).
  const parts = text.split('**')
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>))}
    </>
  )
}

function renderMarkdownLite(md: string): ReactNode {
  const text = (md ?? '').replace(/\r\n/g, '\n').trimEnd()
  if (!text.trim()) return <div style={{ opacity: 0.75 }}>(vacío)</div>

  const lines = text.split('\n')
  const blocks: Array<
    | { kind: 'h2' | 'h3'; text: string }
    | { kind: 'ul'; items: string[] }
    | { kind: 'p'; text: string }
    | { kind: 'hr' }
  > = []

  let paragraph: string[] = []
  let listItems: string[] = []

  function flushParagraph() {
    const t = paragraph.join(' ').trim()
    if (t) blocks.push({ kind: 'p', text: t })
    paragraph = []
  }
  function flushList() {
    if (listItems.length) blocks.push({ kind: 'ul', items: listItems })
    listItems = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()

    if (!trimmed) {
      flushList()
      flushParagraph()
      continue
    }

    if (trimmed === '---') {
      flushList()
      flushParagraph()
      blocks.push({ kind: 'hr' })
      continue
    }

    if (trimmed.startsWith('### ')) {
      flushList()
      flushParagraph()
      blocks.push({ kind: 'h3', text: trimmed.slice(4).trim() })
      continue
    }

    if (trimmed.startsWith('## ')) {
      flushList()
      flushParagraph()
      blocks.push({ kind: 'h2', text: trimmed.slice(3).trim() })
      continue
    }

    if (trimmed.startsWith('- ')) {
      flushParagraph()
      listItems.push(trimmed.slice(2).trim())
      continue
    }

    flushList()
    paragraph.push(trimmed)
  }

  flushList()
  flushParagraph()

  return (
    <div style={{ display: 'grid', gap: 14, lineHeight: 1.65, textAlign: 'justify' }}>
      {blocks.map((b, idx) => {
        if (b.kind === 'hr') return <hr key={`hr-${idx}`} style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
        if (b.kind === 'h2')
          return (
            <h2 key={`h2-${idx}`} style={{ margin: '4px 0 0', fontSize: 18, textAlign: 'left' }}>
              {renderInlineBold(b.text)}
            </h2>
          )
        if (b.kind === 'h3')
          return (
            <h3 key={`h3-${idx}`} style={{ margin: '4px 0 0', fontSize: 15, opacity: 0.95, textAlign: 'left' }}>
              {renderInlineBold(b.text)}
            </h3>
          )
        if (b.kind === 'ul')
          return (
            <div key={`ul-${idx}`} style={{ display: 'grid', gap: 8 }}>
              {b.items.map((it, j) => (
                <div
                  key={`li-${idx}-${j}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '14px 1fr',
                    gap: 10,
                    alignItems: 'start',
                    paddingLeft: 2,
                    textAlign: 'left',
                  }}
                >
                  <div style={{ opacity: 0.7, lineHeight: 1.65 }}>•</div>
                  <div style={{ opacity: 0.95 }}>{renderInlineBold(it)}</div>
                </div>
              ))}
            </div>
          )
        return (
          <p key={`p-${idx}`} style={{ margin: '2px 0', opacity: 0.95 }}>
            {renderInlineBold(b.text)}
          </p>
        )
      })}
    </div>
  )
}

export function WorldDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [world, setWorld] = useState<World | null>(null)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [reopening, setReopening] = useState(false)
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

  const previewText = useMemo(() => {
    if (!world) return ''
    if (world.status === 'approved') return world.content_final ?? ''
    return content
  }, [world, content])
  const rendered = useMemo(() => renderMarkdownLite(previewText), [previewText])

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

  async function onReopen() {
    if (!id) return
    setReopening(true)
    setError(null)
    setOk(null)
    try {
      const updated = await api.reopenWorld(id)
      setWorld(updated)
      setContent(updated.content_draft ?? '')
      setOk('Pasado a borrador')
    } catch (e) {
      setError(formatError(e))
    } finally {
      setReopening(false)
    }
  }

  if (!id) return <div>Falta id</div>

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
          <button onClick={() => navigate(-1)}>←</button>
          <h2 style={{ margin: 0 }}>Mundo</h2>
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
                <div>{toSpanishStatus(world.status)}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {world.status !== 'approved' ? (
                  <>
                    <button onClick={onSave} disabled={saving}>
                      {saving ? 'Guardando…' : 'Guardar borrador'}
                    </button>
                    <button onClick={onApprove} disabled={approving}>
                      {approving ? 'Aprobando…' : 'Aprobar'}
                    </button>
                  </>
                ) : (
                  <button onClick={onReopen} disabled={reopening}>
                    {reopening ? 'Reabriendo…' : 'Volver a borrador'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 12 }}>
            {world.status !== 'approved' && <h3 style={{ marginTop: 0 }}>Vista previa (solo lectura)</h3>}
            {rendered}
          </div>

          {world.status !== 'approved' && (
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
          )}

        </>
      )}
    </div>
  )
}

