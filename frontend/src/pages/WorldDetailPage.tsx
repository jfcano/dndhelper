import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, worldImageUrl } from '../lib/api'
import type { Campaign, World, WorldVisualAssets, WorldVisualGeneratePayload } from '../lib/api'
import { formatError } from '../lib/errors'
import { toSpanishStatus } from '../lib/statusLabels'
import { IconButton } from '../components/IconButton'
import { IconArrowLeft, IconCheck, IconRotateCcw, IconSave } from '../components/icons'
import { WorldCreationWizard } from '../components/WorldCreationWizard'
import { TabBar, TabButton } from '../components/TabBar'

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
        if (b.kind === 'hr') return <hr key={`hr-${idx}`} style={{ borderColor: 'var(--border-subtle)' }} />
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

function canUseOnDemandVisuals(va: WorldVisualAssets | null | undefined): boolean {
  return va?.source === 'wizard' || va?.source === 'brief'
}

function slotGeneratable(s: { planned_file?: string; file?: string | null } | null | undefined): boolean {
  return !!(s && (s.planned_file || s.file))
}

/** Misma clave que usamos en `visualBusyKey` / tarjetas (invalidación de caché de imagen por slot). */
function visualSlotCacheKey(payload: WorldVisualGeneratePayload): string {
  if (payload.target === 'world_map') return 'wm'
  const idx = payload.index ?? 0
  if (payload.target === 'city_map') return `city-${idx}`
  if (payload.target === 'faction_emblem') return `fac-${idx}`
  return `char-${idx}`
}

/** Query `?v=` para PNG: `updated_at` + contador por slot (regenerar misma ruta de archivo). */
function worldVisualImageCacheQuery(
  updatedAt: string | undefined,
  slotKey: string,
  bust: Record<string, number>,
): string {
  return `${updatedAt ?? ''}-${bust[slotKey] ?? 0}`
}

/** Orden: mapa mundial → mapas locales → emblemas → retratos. */
function buildVisualGenerationSteps(va: WorldVisualAssets | undefined): WorldVisualGeneratePayload[] {
  if (!va) return []
  const steps: WorldVisualGeneratePayload[] = []
  if (slotGeneratable(va.world_map)) {
    steps.push({ target: 'world_map' })
  }
  va.city_maps?.forEach((m, i) => {
    if (slotGeneratable(m)) steps.push({ target: 'city_map', index: i })
  })
  va.faction_emblems?.forEach((f, i) => {
    if (slotGeneratable(f)) steps.push({ target: 'faction_emblem', index: i })
  })
  va.character_portraits?.forEach((c, i) => {
    if (slotGeneratable(c)) steps.push({ target: 'character_portrait', index: i })
  })
  return steps
}

function VisualSlotCard(props: {
  title: string
  subtitle?: string
  worldId: string
  /** `world.updated_at` + contador por slot para bust de URL y disparar refetch. */
  imageCacheBuster?: string | null
  displayFile: string | null
  canGenerate: boolean
  error?: string | null
  busy: boolean
  /** Desactiva el botón mientras corre «generar todas». */
  batchBusy?: boolean
  onGenerate: () => void
}) {
  const { title, subtitle, worldId, imageCacheBuster, displayFile, canGenerate, error, busy, batchBusy, onGenerate } =
    props
  const btnDisabled = busy || batchBusy
  /** Evita caché agresiva de `<img>`: cada bust hace fetch con no-store y muestra un blob nuevo. */
  const blobRef = useRef<string | null>(null)
  const [imgSrc, setImgSrc] = useState<string | null>(null)

  useEffect(() => {
    let dead = false
    if (!displayFile) {
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current)
        blobRef.current = null
      }
      setImgSrc(null)
      return
    }
    const direct = worldImageUrl(worldId, displayFile, imageCacheBuster)
    const ac = new AbortController()
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current)
      blobRef.current = null
    }
    setImgSrc(null)

    ;(async () => {
      try {
        const res = await fetch(direct, { cache: 'no-store', signal: ac.signal })
        if (dead || ac.signal.aborted) return
        if (!res.ok) {
          if (!dead) setImgSrc(direct)
          return
        }
        const blob = await res.blob()
        if (dead || ac.signal.aborted) return
        const u = URL.createObjectURL(blob)
        if (dead) {
          URL.revokeObjectURL(u)
          return
        }
        blobRef.current = u
        setImgSrc(u)
      } catch {
        if (!dead && !ac.signal.aborted) setImgSrc(direct)
      }
    })()

    return () => {
      dead = true
      ac.abort()
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current)
        blobRef.current = null
      }
    }
  }, [worldId, displayFile, imageCacheBuster])

  return (
    <div
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        padding: 12,
        display: 'grid',
        gap: 8,
        background: 'var(--table-shell-bg)',
      }}
    >
      <div style={{ fontFamily: 'var(--heading)', fontSize: '0.85rem', color: 'var(--text-heading)' }}>{title}</div>
      {subtitle ? <div style={{ fontSize: '0.78rem', opacity: 0.8 }}>{subtitle}</div> : null}
      <div
        style={{
          minHeight: 200,
          borderRadius: 8,
          background: 'var(--card-panel-bg)',
          border: '1px dashed var(--border-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {displayFile ? (
          imgSrc ? (
            <img src={imgSrc} alt={title} style={{ width: '100%', height: 'auto', display: 'block' }} />
          ) : (
            <span style={{ opacity: 0.55, fontSize: 14, padding: 16, textAlign: 'center' }}>Cargando imagen…</span>
          )
        ) : (
          <span style={{ opacity: 0.5, fontSize: 14, padding: 16, textAlign: 'center' }}>
            Sin imagen — usa el botón para generar con IA
          </span>
        )}
      </div>
      {error ? <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div> : null}
      {canGenerate ? (
        <button type="button" disabled={btnDisabled} onClick={onGenerate}>
          {busy ? 'Generando…' : displayFile ? 'Regenerar con IA' : 'Generar con IA'}
        </button>
      ) : displayFile ? null : (
        <span style={{ opacity: 0.65, fontSize: 12 }}>
          Sin plantilla de generación. Regenera el mundo con el asistente para obtener huecos editables.
        </span>
      )}
    </div>
  )
}

export function WorldDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [world, setWorld] = useState<World | null>(null)
  const [tab, setTab] = useState<'contenido' | 'campañas' | 'imagenes'>('contenido')
  const [imagesSubTab, setImagesSubTab] = useState<'mapas' | 'emblemas' | 'retratos'>('mapas')
  const [visualBusyKey, setVisualBusyKey] = useState<string | null>(null)
  /** Por slot: evita que el navegador siga mostrando la PNG en caché si `updated_at` no cambia en la respuesta. */
  const [visualSlotBuster, setVisualSlotBuster] = useState<Record<string, number>>({})
  const [generatingAll, setGeneratingAll] = useState(false)
  const [generateAllProgress, setGenerateAllProgress] = useState<{ done: number; total: number } | null>(null)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null)
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [campaignsError, setCampaignsError] = useState<string | null>(null)

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

  useEffect(() => {
    if (!world || tab !== 'campañas') return
    let alive = true
    setCampaignsLoading(true)
    setCampaignsError(null)
    api
      .listCampaignsForWorld(world.id)
      .then((list) => {
        if (!alive) return
        setCampaigns(list)
      })
      .catch((e) => {
        if (!alive) return
        setCampaignsError(formatError(e))
      })
      .finally(() => {
        if (!alive) return
        setCampaignsLoading(false)
      })
    return () => {
      alive = false
    }
  }, [world, tab])

  const previewText = useMemo(() => {
    if (!world) return ''
    if (world.status === 'approved') return world.content_final ?? ''
    return content
  }, [world, content])
  const rendered = useMemo(() => renderMarkdownLite(previewText), [previewText])

  const visualPanel = useMemo(() => {
    if (!world) return null
    const va = world.visual_assets as WorldVisualAssets | null | undefined
    if (!va || Object.keys(va).length === 0) {
      return (
        <p style={{ opacity: 0.85, margin: 0 }}>
          No hay plantilla de ilustraciones. Aparece al <strong>generar el mundo</strong> con el asistente (o al
          regenerarlo).
        </p>
      )
    }
    const st = va.status
    if (st === 'skipped') {
      return <p style={{ margin: 0, opacity: 0.9 }}>{va.message ?? 'Generación de imágenes desactivada en el servidor.'}</p>
    }
    if (st === 'failed') {
      return (
        <div style={{ color: 'var(--danger)' }}>
          <p style={{ margin: '0 0 8px' }}>{va.error ?? 'Error en ilustraciones.'}</p>
          {va.warnings && va.warnings.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {va.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )
    }
    if (st === 'complete_with_warnings' && va.warnings?.length) {
      return (
        <p style={{ margin: '0 0 12px', opacity: 0.85 }}>
          Avisos: {va.warnings.join(', ')}
        </p>
      )
    }
    if (canUseOnDemandVisuals(va)) {
      return (
        <p style={{ margin: 0, opacity: 0.88, fontSize: 14 }}>
          Cada ilustración es <strong>opcional</strong>: pulsa «Generar con IA» solo en las que quieras. Cada generación
          puede tardar unos segundos.
        </p>
      )
    }
    return null
  }, [world])

  async function onGenerateVisual(payload: WorldVisualGeneratePayload, busyKey: string) {
    if (!id) return
    setVisualBusyKey(busyKey)
    setError(null)
    setOk(null)
    try {
      const updated = await api.generateWorldVisual(id, payload)
      setWorld(updated)
      setVisualSlotBuster((prev) => ({
        ...prev,
        [busyKey]: (prev[busyKey] ?? 0) + 1,
      }))
      setOk('Imagen generada')
    } catch (e) {
      setError(formatError(e))
      void api.getWorld(id).then((w) => setWorld(w)).catch(() => {})
    } finally {
      setVisualBusyKey(null)
    }
  }

  async function onGenerateAllVisuals(va: WorldVisualAssets) {
    if (!id) return
    const steps = buildVisualGenerationSteps(va)
    if (steps.length === 0) return
    setGeneratingAll(true)
    setGenerateAllProgress({ done: 0, total: steps.length })
    setError(null)
    setOk(null)
    let failures = 0
    for (let i = 0; i < steps.length; i++) {
      setOk(`Generando imagen ${i + 1} de ${steps.length}…`)
      try {
        const updated = await api.generateWorldVisual(id, steps[i])
        setWorld(updated)
        const slotKey = visualSlotCacheKey(steps[i])
        setVisualSlotBuster((prev) => ({
          ...prev,
          [slotKey]: (prev[slotKey] ?? 0) + 1,
        }))
        setGenerateAllProgress({ done: i + 1, total: steps.length })
      } catch (e) {
        failures += 1
        setError(formatError(e))
        await api.getWorld(id).then((w) => setWorld(w)).catch(() => {})
      }
    }
    setGeneratingAll(false)
    setGenerateAllProgress(null)
    if (failures === 0) {
      setOk(`Listo: ${steps.length} imagen(es) generada(s).`)
    } else {
      setOk(`Finalizado: ${steps.length - failures} correctas, ${failures} error(es). Revisa los avisos en cada tarjeta.`)
    }
  }

  const showWorldWizard = useMemo(() => {
    if (!world) return false
    if (world.status === 'approved') return false
    const draft = world.content_draft ?? ''
    return draft.trim().length === 0
  }, [world])

  function onWorldGenerated(updated: World) {
    setWorld(updated)
    setContent(updated.content_draft ?? '')
    setError(null)
    setOk('Mundo generado')
  }

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
          <IconButton label="Volver atrás" textShort="Volver" className="btn-icon--inline" onClick={() => navigate(-1)}>
            <IconArrowLeft />
          </IconButton>
          <h2 style={{ margin: 0 }}>Mundo</h2>
        </div>
        {world && <code>{world.id}</code>}
      </div>

      {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
      {ok && <div style={{ color: 'lightgreen' }}>{ok}</div>}
      {!world && !error && <div>Cargando…</div>}

      {world && (
        <>
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12 }}>
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
                {tab === 'contenido' && !showWorldWizard && (
                  <>
                    {world.status !== 'approved' ? (
                      <>
                        <IconButton
                          label="Guardar borrador del mundo"
                          textShort="Guardar"
                          busy={saving}
                          busyLabel="Guardando borrador…"
                          busyShort="…"
                          onClick={onSave}
                        >
                          <IconSave />
                        </IconButton>
                        <IconButton
                          label="Aprobar mundo"
                          textShort="Aprobar"
                          busy={approving}
                          busyLabel="Aprobando…"
                          busyShort="…"
                          onClick={onApprove}
                        >
                          <IconCheck />
                        </IconButton>
                      </>
                    ) : (
                      <IconButton
                        label="Volver el mundo a borrador"
                        textShort="Borrador"
                        busy={reopening}
                        busyLabel="Reabriendo…"
                        busyShort="…"
                        onClick={onReopen}
                      >
                        <IconRotateCcw />
                      </IconButton>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <TabBar style={{ marginTop: 10 }}>
            <TabButton active={tab === 'contenido'} onSelect={() => setTab('contenido')}>
              Contenido
            </TabButton>
            <TabButton active={tab === 'imagenes'} onSelect={() => setTab('imagenes')}>
              Imágenes
            </TabButton>
            <TabButton active={tab === 'campañas'} onSelect={() => setTab('campañas')}>
              Campañas
            </TabButton>
          </TabBar>

          {tab === 'contenido' && (
            <>
              {showWorldWizard ? (
                <WorldCreationWizard worldId={world.id} onWorldGenerated={onWorldGenerated} />
              ) : (
                <>
                  <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12 }}>
                    {world.status !== 'approved' && <h3 style={{ marginTop: 0 }}>Vista previa (solo lectura)</h3>}
                    {rendered}
                  </div>

                  {world.status !== 'approved' && (
                    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12 }}>
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
                          border: '1px solid var(--border-subtle)',
                          background: 'rgba(0,0,0,0.25)',
                          color: 'inherit',
                        }}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {tab === 'imagenes' && world && (() => {
            const va = world.visual_assets as WorldVisualAssets | undefined
            const tmpl = canUseOnDemandVisuals(va)
            const wm = va?.world_map
            return (
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12 }}>
              <h3 style={{ marginTop: 0, textAlign: 'left' }}>Ilustraciones del mundo</h3>
              {visualPanel}
              {tmpl ? (
                <div
                  style={{
                    marginTop: 14,
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <button
                    type="button"
                    disabled={generatingAll || visualBusyKey !== null}
                    onClick={() => void onGenerateAllVisuals(va!)}
                  >
                    {generatingAll
                      ? `Generando todas… ${generateAllProgress?.done ?? 0} / ${generateAllProgress?.total ?? ''}`
                      : 'Generar todas las imágenes con IA'}
                  </button>
                  <span style={{ opacity: 0.82, fontSize: 13, maxWidth: 520 }}>
                    {generatingAll
                      ? 'La vista se actualiza tras cada imagen. Puede tardar varios minutos.'
                      : 'Orden: mapa mundial → mapas locales → emblemas → retratos.'}
                  </span>
                </div>
              ) : null}
              <TabBar style={{ marginTop: 14 }}>
                <TabButton active={imagesSubTab === 'mapas'} onSelect={() => setImagesSubTab('mapas')}>
                  Mapas
                </TabButton>
                <TabButton active={imagesSubTab === 'emblemas'} onSelect={() => setImagesSubTab('emblemas')}>
                  Emblemas
                </TabButton>
                <TabButton active={imagesSubTab === 'retratos'} onSelect={() => setImagesSubTab('retratos')}>
                  Retratos
                </TabButton>
              </TabBar>

              {imagesSubTab === 'mapas' && (
                <div style={{ marginTop: 14, display: 'grid', gap: 20 }}>
                  {wm ? (
                    <VisualSlotCard
                      title={wm.label ?? 'Mapa del mundo'}
                      worldId={world.id}
                      imageCacheBuster={worldVisualImageCacheQuery(world.updated_at, 'wm', visualSlotBuster)}
                      displayFile={(wm.file as string | null | undefined) ?? null}
                      canGenerate={tmpl && !!(wm.planned_file || wm.file)}
                      error={wm.error ?? null}
                      busy={visualBusyKey === 'wm'}
                      batchBusy={generatingAll}
                      onGenerate={() => void onGenerateVisual({ target: 'world_map' }, 'wm')}
                    />
                  ) : null}
                  {(va?.city_maps?.length ?? 0) > 0 ? (
                    <div>
                      <h4 style={{ margin: '0 0 10px', fontSize: '1rem', textAlign: 'left' }}>
                        Mapas de ciudades y regiones
                      </h4>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                          gap: 16,
                        }}
                      >
                        {va!.city_maps!.map((m, i) => (
                          <VisualSlotCard
                            key={m.planned_file || m.file || `city-${i}`}
                            title={m.name ?? `Mapa ${i + 1}`}
                            subtitle={m.kind === 'region' ? 'Región' : 'Ciudad'}
                            worldId={world.id}
                            imageCacheBuster={worldVisualImageCacheQuery(world.updated_at, `city-${i}`, visualSlotBuster)}
                            displayFile={m.file ?? null}
                            canGenerate={tmpl && !!(m.planned_file || m.file)}
                            error={m.error ?? null}
                            busy={visualBusyKey === `city-${i}`}
                            batchBusy={generatingAll}
                            onGenerate={() => void onGenerateVisual({ target: 'city_map', index: i }, `city-${i}`)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {!wm && !(va?.city_maps && va.city_maps.length > 0) ? (
                    <p style={{ opacity: 0.8 }}>No hay entradas de mapa en la plantilla de este mundo.</p>
                  ) : null}
                </div>
              )}

              {imagesSubTab === 'emblemas' && (
                <div
                  style={{
                    marginTop: 14,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 16,
                  }}
                >
                  {!(va?.faction_emblems && va.faction_emblems.length > 0) ? (
                    <p style={{ opacity: 0.8 }}>No hay facciones en la plantilla de ilustraciones.</p>
                  ) : null}
                  {va?.faction_emblems?.map((f, i) => (
                    <VisualSlotCard
                      key={f.planned_file || f.file || `fac-${i}`}
                      title={f.faction_name ?? `Facción ${i + 1}`}
                      worldId={world.id}
                      imageCacheBuster={worldVisualImageCacheQuery(world.updated_at, `fac-${i}`, visualSlotBuster)}
                      displayFile={f.file ?? null}
                      canGenerate={tmpl && !!(f.planned_file || f.file)}
                      error={f.error ?? null}
                      busy={visualBusyKey === `fac-${i}`}
                      batchBusy={generatingAll}
                      onGenerate={() => void onGenerateVisual({ target: 'faction_emblem', index: i }, `fac-${i}`)}
                    />
                  ))}
                </div>
              )}

              {imagesSubTab === 'retratos' && (
                <div
                  style={{
                    marginTop: 14,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: 16,
                  }}
                >
                  {!(va?.character_portraits && va.character_portraits.length > 0) ? (
                    <p style={{ opacity: 0.8 }}>No hay personajes en la plantilla de ilustraciones.</p>
                  ) : null}
                  {va?.character_portraits?.map((c, i) => (
                    <VisualSlotCard
                      key={c.planned_file || c.file || `char-${i}`}
                      title={c.name ?? `Personaje ${i + 1}`}
                      subtitle={c.faction_name || undefined}
                      worldId={world.id}
                      imageCacheBuster={worldVisualImageCacheQuery(world.updated_at, `char-${i}`, visualSlotBuster)}
                      displayFile={c.file ?? null}
                      canGenerate={tmpl && !!(c.planned_file || c.file)}
                      error={c.error ?? null}
                      busy={visualBusyKey === `char-${i}`}
                      batchBusy={generatingAll}
                      onGenerate={() => void onGenerateVisual({ target: 'character_portrait', index: i }, `char-${i}`)}
                    />
                  ))}
                </div>
              )}
            </div>
            )
          })()}

          {tab === 'campañas' && (
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12 }}>
              <h3 style={{ marginTop: 0 }}>Campañas vinculadas</h3>
              {campaignsError && <div style={{ color: 'var(--danger)' }}>{campaignsError}</div>}
              {!campaigns && !campaignsError && campaignsLoading && <div>Cargando…</div>}
              {campaigns && (
                <div style={{ overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--table-header-bg)' }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: 10 }}>Nombre</th>
                        <th style={{ textAlign: 'left', padding: 10 }}>Resumen inicial</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.length === 0 && (
                        <tr>
                          <td style={{ padding: 10, opacity: 0.8 }} colSpan={2}>
                            No hay campañas vinculadas a este mundo.
                          </td>
                        </tr>
                      )}
                      {campaigns.map((c) => (
                        <tr key={c.id} style={{ borderTop: '1px solid var(--table-row-border)' }}>
                          <td style={{ padding: 10 }}>
                            <Link to={`/campaigns/${c.id}`}>{c.name}</Link>
                          </td>
                          <td style={{ padding: 10 }}>{toSpanishStatus(c.brief_status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </>
      )}
    </div>
  )
}

