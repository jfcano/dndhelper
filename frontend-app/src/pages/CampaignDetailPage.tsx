import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Campaign, CampaignBrief, CampaignWizardDraft, World } from '../lib/api'
import { formatError } from '../lib/errors'
import { toSpanishStatus } from '../lib/statusLabels'

const CAMPAIGN_WIZARD_STORAGE_PREFIX = 'dndhelper.campaignWizard.v1'
const CAMPAIGN_WIZARD_STEP_STORAGE_PREFIX = 'dndhelper.campaignWizard.step.v1'
const CAMPAIGN_WIZARD_WORLD_USE_STORAGE_PREFIX = 'dndhelper.campaignWizard.worldUse.v1'
const CAMPAIGN_WIZARD_WORLD_ID_STORAGE_PREFIX = 'dndhelper.campaignWizard.worldId.v1'

function renderInlineBold(text: string): ReactNode {
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

function createEmptyCampaignWizard(): CampaignWizardDraft {
  return {
    kind: '',
    tone: null,
    themes: [''],
    starting_level: 1,
    inspirations: [''],
    constraints: null,
  }
}

function wizardStorageKey(campaignId: string): string {
  return `${CAMPAIGN_WIZARD_STORAGE_PREFIX}.${campaignId}`
}

function wizardStepStorageKey(campaignId: string): string {
  return `${CAMPAIGN_WIZARD_STEP_STORAGE_PREFIX}.${campaignId}`
}

function worldUseStorageKey(campaignId: string): string {
  return `${CAMPAIGN_WIZARD_WORLD_USE_STORAGE_PREFIX}.${campaignId}`
}

function worldIdStorageKey(campaignId: string): string {
  return `${CAMPAIGN_WIZARD_WORLD_ID_STORAGE_PREFIX}.${campaignId}`
}

export function CampaignDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [worlds, setWorlds] = useState<World[] | null>(null)
  const [worldId, setWorldId] = useState<string>('')
  // En esta versión simplificada, el mundo siempre debe estar vinculado antes de seguir.
  const [useExistingWorld, setUseExistingWorld] = useState<boolean | null>(true)
  const [wizard, setWizard] = useState<CampaignWizardDraft>(createEmptyCampaignWizard())
  const [step, setStep] = useState(0)
  const [autogeneratingStep, setAutogeneratingStep] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [storyEditorText, setStoryEditorText] = useState('')
  const [storySaving, setStorySaving] = useState(false)
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

        // En esta versión, el mundo siempre se usa como referencia (no se genera desde el wizard).
        setUseExistingWorld(true)

        const storageKey = wizardStorageKey(c.id)
        if (!localStorage.getItem(storageKey)) {
          const b = (c.brief_draft ?? c.brief_final) as CampaignBrief | null
          if (b && typeof b === 'object' && typeof b.kind === 'string') {
            setWizard({
              kind: b.kind,
              tone: b.tone ?? null,
              themes: Array.isArray(b.themes) && b.themes.length ? b.themes : [''],
              starting_level: (b.starting_level ?? 1) as number,
              inspirations: Array.isArray(b.inspirations) && b.inspirations.length ? b.inspirations : [''],
              constraints: b.constraints ?? null,
            })
          }
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

  useEffect(() => {
    if (!id) return
    try {
      const rawWizard = localStorage.getItem(wizardStorageKey(id))
      if (rawWizard) {
        const parsed = JSON.parse(rawWizard) as CampaignWizardDraft
        setWizard({
          kind: typeof parsed.kind === 'string' ? parsed.kind : '',
          tone: typeof parsed.tone === 'string' ? parsed.tone : null,
          themes: Array.isArray(parsed.themes) && parsed.themes.length ? parsed.themes : [''],
          starting_level: typeof parsed.starting_level === 'number' ? parsed.starting_level : 1,
          inspirations: Array.isArray(parsed.inspirations) && parsed.inspirations.length ? parsed.inspirations : [''],
          constraints: parsed.constraints && typeof parsed.constraints === 'object' ? parsed.constraints : null,
        })
      }
      // En esta versión simplificada, el mundo siempre se considera "existente" (solo vinculamos).
      const rawWorldUseKey = localStorage.getItem(worldUseStorageKey(id))
      const hasNewWorldUseKey = rawWorldUseKey !== null

      const rawStep = localStorage.getItem(wizardStepStorageKey(id))
      if (rawStep) {
        const parsedStep = Number(rawStep)
        if (Number.isInteger(parsedStep) && parsedStep >= 0 && parsedStep <= 4) {
          // Migración: antes el wizard tenía 4 pasos (0..3). Ahora añadimos un paso inicial (0..4).
          // Si no existe la clave nueva de worldUse, interpretamos el step guardado como del esquema antiguo.
          if (!hasNewWorldUseKey && parsedStep <= 3) setStep(Math.min(parsedStep + 1, 4))
          else setStep(parsedStep)
        }
      }

      void hasNewWorldUseKey
      setUseExistingWorld(true)

      const rawWorldId = localStorage.getItem(worldIdStorageKey(id))
      if (typeof rawWorldId === 'string') setWorldId(rawWorldId)
    } catch {
      // Ignora estado corrupto
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    localStorage.setItem(wizardStorageKey(id), JSON.stringify(wizard))
  }, [id, wizard])

  useEffect(() => {
    if (!id) return
    localStorage.setItem(wizardStepStorageKey(id), String(step))
  }, [id, step])

  useEffect(() => {
    if (!id) return
    try {
      if (useExistingWorld === null) localStorage.removeItem(worldUseStorageKey(id))
      else localStorage.setItem(worldUseStorageKey(id), String(useExistingWorld))
    } catch {
      // ignorar
    }
  }, [id, useExistingWorld])

  useEffect(() => {
    if (!id) return
    try {
      localStorage.setItem(worldIdStorageKey(id), worldId)
    } catch {
      // ignorar
    }
  }, [id, worldId])

  useEffect(() => {
    if (!campaign) return
    if (campaign.brief_status === 'approved') {
      setStoryEditorText('')
      return
    }
    setStoryEditorText(campaign.story_draft ?? '')
  }, [campaign?.brief_status, campaign?.story_draft])

  // Si el usuario decide usar un mundo ya generado, saltamos los pasos que sobran
  // (tipo y tono, e inspiraciones).
  useEffect(() => {
    if (useExistingWorld !== true) return
    if (step === 1) setStep(2)
    if (step === 4) setStep(3)
  }, [useExistingWorld, step])

  // Si el wizard se restaura en un paso posterior pero el mundo no está vinculado,
  // volvemos al paso 0 para que la selección sea obligatoria.
  useEffect(() => {
    if (!id || !campaign) return
    if (step === 0) return
    const linked = campaign.world_id ?? ''
    if (!linked || linked !== worldId) setStep(0)
  }, [id, campaign, step, worldId])

  const worldOptions = useMemo(() => worlds ?? [], [worlds])
  const themes = useMemo(() => wizard.themes.map((t) => t.trim()).filter(Boolean), [wizard.themes])
  const inspirations = useMemo(() => wizard.inspirations.map((t) => t.trim()).filter(Boolean), [wizard.inspirations])
  const visibleSteps = useExistingWorld === true ? [0, 2, 3] : [0, 1, 2, 3, 4]
  const stepPos = visibleSteps.includes(step) ? visibleSteps.indexOf(step) + 1 : 1
  const firstVisibleStep = visibleSteps[0]
  const currentVisibleIndex = visibleSteps.indexOf(step)
  const canGoPrev = currentVisibleIndex > 0
  const canGoNext = currentVisibleIndex >= 0 && currentVisibleIndex < visibleSteps.length - 1

  const storyPreviewRendered = useMemo(() => renderMarkdownLite(storyEditorText), [storyEditorText])
  const storyFinalRendered = useMemo(() => renderMarkdownLite(campaign?.story_final ?? ''), [campaign?.story_final])

  function setConstraintNotes(notes: string) {
    const trimmed = notes.trim()
    setWizard((w) => ({ ...w, constraints: trimmed ? { ...(w.constraints ?? {}), notes: trimmed } : null }))
  }

  function getConstraintNotes(): string {
    if (!wizard.constraints || typeof wizard.constraints !== 'object') return ''
    const val = wizard.constraints.notes
    return typeof val === 'string' ? val : ''
  }

  function canContinueFromCurrentStep(): boolean {
    // Paso 0: seleccionar fuente del mundo
    if (step === 0) {
      return worldId.trim().length > 0 && (campaign?.world_id ?? '') === worldId
    }
    // Paso 1: tipo y tono
    if (step === 1) return useExistingWorld !== true && wizard.kind.trim().length > 0 && (wizard.tone ?? '').trim().length > 0
    // Paso 2: temas
    if (step === 2) return themes.length > 0
    // Paso 3: nivel inicial y restricciones
    if (step === 3)
      return (
        typeof wizard.starting_level === 'number' &&
        wizard.starting_level >= 1 &&
        wizard.starting_level <= 20 &&
        (useExistingWorld !== true || wizard.kind.trim().length > 0)
      )
    // Paso 4: inspiraciones (opcionales)
    if (step === 4) return useExistingWorld !== true
    return false
  }

  async function onAutogenerateStep(targetStep: 0 | 1 | 2 | 3) {
    setError(null)
    setAutogeneratingStep(targetStep)
    try {
      const resp = await api.autogenerateCampaignWizardStep({ step: targetStep, wizard })
      setWizard((prev) => {
        const patch = resp.patch ?? {}
        const next = { ...prev, ...patch }
        return {
          ...next,
          themes: Array.isArray(next.themes) && next.themes.length ? next.themes : [''],
          inspirations: Array.isArray(next.inspirations) && next.inspirations.length ? next.inspirations : [''],
        }
      })
    } catch (e) {
      setError(formatError(e))
    } finally {
      setAutogeneratingStep(null)
    }
  }

  // Si se elige un mundo ya generado, omitimos el paso de "tipo y tono".
  // Aun así necesitamos `brief.kind`, así que lo autogeneramos automáticamente.
  // (Se ejecuta solo cuando `wizard.kind` está vacío y no hay otra autogeneración en curso.)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  // Nota: Cursor/TS puede no tener reglas de ESLint habilitadas, pero la idea es evitar bucles.
  useEffect(() => {
    if (useExistingWorld !== true) return
    if (!id) return
    if (autogeneratingStep !== null) return
    if (wizard.kind.trim().length > 0) return
    void onAutogenerateStep(0)
  }, [useExistingWorld, id, autogeneratingStep, wizard.kind])

  async function onResetWizard() {
    if (!id || !campaign) return
    try {
      // Reiniciar asistente: vaciamos también el resumen de historia y deshacemos la vinculación.
      if (campaign.story_draft || campaign.story_final) {
        const updated = await api.resetCampaignStoryDraft(id)
        setCampaign(updated)
      }
      if (campaign.world_id) {
        const updated = await api.patchCampaign(id, { world_id: null })
        setCampaign(updated)
      }
    } catch (e) {
      setError(formatError(e))
    }

    setWizard(createEmptyCampaignWizard())
    setStep(0)
    setUseExistingWorld(true)
    setWorldId('')
    setStoryEditorText('')

    localStorage.removeItem(wizardStorageKey(id))
    localStorage.removeItem(wizardStepStorageKey(id))
    localStorage.removeItem(worldUseStorageKey(id))
    localStorage.removeItem(worldIdStorageKey(id))
  }

  async function onSaveBriefDraft() {
    if (!id || !campaign) return
    let normalizedConstraints: CampaignWizardDraft['constraints'] = wizard.constraints ?? null
    if (normalizedConstraints && typeof normalizedConstraints === 'object' && 'notes' in normalizedConstraints) {
      const notes = (normalizedConstraints as { notes?: unknown }).notes
      if (typeof notes === 'string' && !notes.trim()) normalizedConstraints = null
    }
    const payload: CampaignBrief = {
      kind: wizard.kind.trim(),
      tone: (wizard.tone ?? '').trim() || null,
      themes,
      starting_level: wizard.starting_level ?? 1,
      inspirations,
      constraints: normalizedConstraints,
    }
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      const updated = await api.setBrief(id, payload)
      setCampaign(updated)
      setOk('Resumen inicial guardado')
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
      // Si el usuario editó el borrador de historia, lo sincronizamos antes de aprobar.
      const currentServer = campaign.story_draft ?? ''
      if (storyEditorText !== currentServer && storyEditorText.trim().length > 0) {
        await api.patchCampaignStoryDraft(id, storyEditorText)
      }
      const updated = await api.approveBrief(id)
      setCampaign(updated)
      setOk('Resumen inicial aprobado')
    } catch (e) {
      setError(formatError(e))
    } finally {
      setSaving(false)
    }
  }

  async function onSaveStoryDraft() {
    if (!id) return
    setStorySaving(true)
    setError(null)
    setOk(null)
    try {
      const trimmed = storyEditorText.trim()
      if (!trimmed) throw new Error('El borrador de historia no puede estar vacío.')
      const updated = await api.patchCampaignStoryDraft(id, storyEditorText)
      setCampaign(updated)
      setOk('Borrador de historia guardado')
    } catch (e) {
      setError(formatError(e))
    } finally {
      setStorySaving(false)
    }
  }

  async function onReopenCampaign() {
    if (!id || !campaign) return
    setReopening(true)
    setError(null)
    setOk(null)
    try {
      const updated = await api.reopenCampaign(id)
      setCampaign(updated)
      const b = (updated.brief_draft ?? updated.brief_final) as CampaignBrief | null
      if (b && typeof b === 'object' && typeof b.kind === 'string') {
        setWizard({
          kind: b.kind,
          tone: b.tone ?? null,
          themes: Array.isArray(b.themes) && b.themes.length ? b.themes : [''],
          starting_level: (b.starting_level ?? 1) as number,
          inspirations: Array.isArray(b.inspirations) && b.inspirations.length ? b.inspirations : [''],
          constraints: b.constraints ?? null,
        })
      }
      setOk('Campaña devuelta a borrador')
    } catch (e) {
      setError(formatError(e))
    } finally {
      setReopening(false)
    }
  }

  async function onLinkWorld() {
    if (!id || !campaign) return
    if (!worldId.trim()) return
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      const updated = await api.patchCampaign(id, { world_id: worldId === '' ? null : worldId })
      setCampaign(updated)
      setWorldId(updated.world_id ?? '')
      setOk('Mundo vinculado')
    } catch (e) {
      setError(formatError(e))
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
          <h2 style={{ margin: 0 }}>Campaña</h2>
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
                <div style={{ opacity: 0.75, fontSize: 12 }}>Resumen inicial</div>
                <div>{toSpanishStatus(campaign.brief_status)}</div>
              </div>
              <div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>Esquema</div>
                <div>{toSpanishStatus(campaign.outline_status)}</div>
              </div>
            </div>
          </div>

          {campaign.brief_status !== 'approved' && !campaign.story_draft && (
            <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h3 style={{ margin: 0 }}>Asistente de resumen inicial</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <small style={{ opacity: 0.8 }}>Paso {stepPos} de {visibleSteps.length}</small>
              </div>
            </div>

            {step === 0 && (
              <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>Mundo para la campaña</div>
                  {!worlds && <div>Cargando mundos…</div>}
                  {worlds && (
                    <>
                      <select value={worldId} onChange={(e) => setWorldId(e.target.value)} style={{ minWidth: 320 }}>
                        <option value="">(selecciona un mundo)</option>
                        {worldOptions.map((w) => (
                          <option value={w.id} key={w.id}>
                            {w.name} ({toSpanishStatus(w.status)})
                          </option>
                        ))}
                      </select>
                      <button onClick={() => void onLinkWorld()} disabled={saving || !worldId || campaign?.world_id === worldId}>
                        {saving ? 'Vinculando…' : 'Vincular mundo'}
                      </button>
                      {campaign.world_id && <Link to={`/worlds/${campaign.world_id}`}>Abrir mundo vinculado</Link>}
                    </>
                  )}
                </div>
              </div>
            )}

            {useExistingWorld !== true && step === 1 && (
              <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>Tipo y tono de campaña</div>
                  <button onClick={() => void onAutogenerateStep(0)} disabled={autogeneratingStep !== null || saving}>
                    {autogeneratingStep === 0 ? 'Autogenerando…' : 'Autogenerar'}
                  </button>
                </div>
                <input
                  value={wizard.kind}
                  onChange={(e) => setWizard((w) => ({ ...w, kind: e.target.value }))}
                  placeholder="sandbox / investigación / épica…"
                />
                <input
                  value={wizard.tone ?? ''}
                  onChange={(e) => setWizard((w) => ({ ...w, tone: e.target.value || null }))}
                  placeholder="heroico, oscuro, pulp…"
                />
              </div>
            )}

            {step === 2 && (
              <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>Temas principales</div>
                  <button onClick={() => void onAutogenerateStep(1)} disabled={autogeneratingStep !== null || saving}>
                    {autogeneratingStep === 1 ? 'Autogenerando…' : 'Autogenerar'}
                  </button>
                </div>
                {wizard.themes.map((t, i) => (
                  <div key={`theme-${i}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                    <input
                      value={t}
                      onChange={(e) =>
                        setWizard((w) => {
                          const next = [...w.themes]
                          next[i] = e.target.value
                          return { ...w, themes: next }
                        })
                      }
                      placeholder="intriga política, exploración, horror…"
                    />
                    <button
                      onClick={() =>
                        setWizard((w) => ({
                          ...w,
                          themes: w.themes.length > 1 ? w.themes.filter((_, idx) => idx !== i) : w.themes,
                        }))
                      }
                      disabled={wizard.themes.length <= 1}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
                <div>
                  <button onClick={() => setWizard((w) => ({ ...w, themes: [...w.themes, ''] }))}>+ Añadir tema</button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>Nivel inicial y restricciones</div>
                  <button onClick={() => void onAutogenerateStep(2)} disabled={autogeneratingStep !== null || saving}>
                    {autogeneratingStep === 2 ? 'Autogenerando…' : 'Autogenerar'}
                  </button>
                </div>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ opacity: 0.75, fontSize: 12 }}>Nivel inicial</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={wizard.starting_level ?? 1}
                    onChange={(e) => setWizard((w) => ({ ...w, starting_level: Number(e.target.value || 1) }))}
                  />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ opacity: 0.75, fontSize: 12 }}>Restricciones / notas</span>
                  <textarea
                    rows={4}
                    value={getConstraintNotes()}
                    onChange={(e) => setConstraintNotes(e.target.value)}
                    placeholder="Límites de tono, estilo de juego, contenido a evitar, etc."
                  />
                </label>
              </div>
            )}

            {useExistingWorld !== true && step === 4 && (
              <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>Inspiraciones</div>
                  <button onClick={() => void onAutogenerateStep(3)} disabled={autogeneratingStep !== null || saving}>
                    {autogeneratingStep === 3 ? 'Autogenerando…' : 'Autogenerar'}
                  </button>
                </div>
                {wizard.inspirations.map((t, i) => (
                  <div key={`insp-${i}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                    <input
                      value={t}
                      onChange={(e) =>
                        setWizard((w) => {
                          const next = [...w.inspirations]
                          next[i] = e.target.value
                          return { ...w, inspirations: next }
                        })
                      }
                      placeholder="The Witcher, Eberron, Zelda…"
                    />
                    <button
                      onClick={() =>
                        setWizard((w) => ({
                          ...w,
                          inspirations: w.inspirations.length > 1 ? w.inspirations.filter((_, idx) => idx !== i) : w.inspirations,
                        }))
                      }
                      disabled={wizard.inspirations.length <= 1}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
                <div>
                  <button onClick={() => setWizard((w) => ({ ...w, inspirations: [...w.inspirations, ''] }))}>
                    + Añadir inspiración
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setStep(visibleSteps[Math.max(0, currentVisibleIndex - 1)] ?? firstVisibleStep)}
                  disabled={!canGoPrev || saving}
                >
                  Anterior
                </button>
                <button onClick={() => void onResetWizard()} disabled={saving}>
                  Reiniciar asistente
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {canGoNext ? (
                  <button onClick={() => setStep(visibleSteps[currentVisibleIndex + 1])} disabled={!canContinueFromCurrentStep() || saving}>
                    Siguiente
                  </button>
                ) : (
                  <button onClick={() => void onSaveBriefDraft()} disabled={saving || !canContinueFromCurrentStep()}>
                    {saving ? 'Guardando…' : 'Guardar borrador'}
                  </button>
                )}
              </div>
            </div>

            <div style={{ marginTop: 10, opacity: 0.8 }}>
              Estado: {toSpanishStatus(campaign.brief_status)}
            </div>
            </div>
          )}

          {campaign.brief_status !== 'approved' ? (
            <>
              {campaign.story_draft && (
                <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 12, marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Borrador del resumen de historia</h3>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => void onSaveStoryDraft()}
                        disabled={storySaving || saving || !campaign.world_id || campaign.world_id !== worldId}
                      >
                        {storySaving ? 'Guardando…' : 'Guardar borrador'}
                      </button>
                      <button
                        onClick={() => void onApproveBrief()}
                        disabled={
                          saving ||
                          storySaving ||
                          !campaign.world_id ||
                          campaign.world_id !== worldId ||
                          !storyEditorText.trim().length
                        }
                      >
                        {saving ? 'Aprobando…' : 'Aprobar'}
                      </button>
                      <button onClick={() => void onResetWizard()} disabled={saving || storySaving}>
                        Reiniciar asistente
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                    <div style={{ opacity: 0.8, fontSize: 13 }}>Vista previa (solo lectura)</div>
                    <div>{storyPreviewRendered}</div>
                    <textarea
                      rows={12}
                      value={storyEditorText}
                      onChange={(e) => setStoryEditorText(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              )}

              <details>
                <summary>Resumen inicial (JSON)</summary>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(campaign.brief_final ?? campaign.brief_draft, null, 2)}</pre>
              </details>
              <details>
                <summary>Esquema (texto)</summary>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{campaign.outline_final ?? campaign.outline_draft}</pre>
              </details>
            </>
          ) : (
            <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 12, marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Resumen final de historia</h3>
                <button onClick={() => void onReopenCampaign()} disabled={reopening}>
                  {reopening ? 'Reabriendo…' : 'Volver a borrador'}
                </button>
              </div>
              <div style={{ marginTop: 10 }}>{storyFinalRendered}</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

