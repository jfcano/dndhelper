import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Campaign, CampaignBrief, CampaignWizardDraft, PlayerProfile, Session, World } from '../lib/api'
import { formatError } from '../lib/errors'
import { ConfirmCascadeDeleteDialog } from '../components/ConfirmCascadeDeleteDialog'
import { IconButton } from '../components/IconButton'
import {
  CampaignBriefAssistantPanel,
  type CampaignWizardRemovePayload,
} from './campaign-detail/CampaignBriefAssistantPanel'
import { CampaignHistoriaTab } from './campaign-detail/CampaignHistoriaTab'
import { CampaignJugadoresTab } from './campaign-detail/CampaignJugadoresTab'
import { CampaignSesionesTab } from './campaign-detail/CampaignSesionesTab'
import type { PlayerDerived } from './campaign-detail/playerSheet'
import {
  createEmptyCampaignWizard,
  wizardStorageKey,
  wizardStepStorageKey,
  worldIdStorageKey,
  worldUseStorageKey,
} from './campaign-detail/wizardStorage'
import { IconArrowLeft, IconSave } from '../components/icons'
import { toSpanishStatus } from '../lib/statusLabels'
import { TabBar, TabButton } from '../components/TabBar'

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
  const [nameSaving, setNameSaving] = useState(false)
  const [storyEditorText, setStoryEditorText] = useState('')
  const [storySaving, setStorySaving] = useState(false)
  const [outlineEditorText, setOutlineEditorText] = useState('')
  const [outlineDirty, setOutlineDirty] = useState(false)
  const [outlineGenerating, setOutlineGenerating] = useState(false)
  const [outlineSaving, setOutlineSaving] = useState(false)
  const [outlineApproving, setOutlineApproving] = useState(false)
  const [campaignNameEditor, setCampaignNameEditor] = useState('')
  const [campaignNameDirty, setCampaignNameDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [detailTab, setDetailTab] = useState<'historia' | 'sesiones' | 'jugadores'>('historia')
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  const [createSessionsOpen, setCreateSessionsOpen] = useState(false)
  const [createSessionsCount, setCreateSessionsCount] = useState(3)
  const [createSessionsLoading, setCreateSessionsLoading] = useState(false)
  const [createSessionsError, setCreateSessionsError] = useState<string | null>(null)
  const [sessionDraftEditor, setSessionDraftEditor] = useState('')
  const [sessionDraftSaving, setSessionDraftSaving] = useState(false)
  const [sessionSummaryEditor, setSessionSummaryEditor] = useState('')
  const [sessionSummarySaving, setSessionSummarySaving] = useState(false)
  const [sessionDeleteLoadingId, setSessionDeleteLoadingId] = useState<string | null>(null)
  const [sessionDeletePending, setSessionDeletePending] = useState<Session | null>(null)
  const [playerDeletePending, setPlayerDeletePending] = useState<{ id: string; name: string } | null>(null)
  const [playerDeleteBusy, setPlayerDeleteBusy] = useState(false)
  const [campaignWizardRemovePending, setCampaignWizardRemovePending] = useState<CampaignWizardRemovePayload | null>(
    null,
  )
  const [sessionApproving, setSessionApproving] = useState(false)
  const [sessionReopening, setSessionReopening] = useState(false)

  const [players, setPlayers] = useState<PlayerDerived[]>([])
  const [playersLoading, setPlayersLoading] = useState(false)
  const [playersError, setPlayersError] = useState<string | null>(null)
  const [createPlayersOpen, setCreatePlayersOpen] = useState(false)
  const [createPlayersCount, setCreatePlayersCount] = useState(4)

  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState(0)

  useEffect(() => {
    if (!id) return
    let alive = true
    Promise.all([api.getCampaign(id), api.listWorlds()])
      .then(([c, ws]) => {
        if (!alive) return
        setCampaign(c)
        setCampaignNameEditor(c.name ?? '')
        setCampaignNameDirty(false)
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
    // Al cambiar de campaña, reseteamos selección y caché de sesiones.
    setSessions(null)
    setSessionsError(null)
    setSelectedSessionId(null)
    setSessionsLoading(false)
    setPlayers([])
    setPlayersError(null)
    setPlayersLoading(false)
    setCreatePlayersOpen(false)
    setCreatePlayersCount(4)
    setSelectedPlayerIndex(0)
    setDetailTab('historia')
  }, [campaign?.id])

  useEffect(() => {
    if (!campaign) return
    if (detailTab !== 'sesiones') return
    if (sessions !== null) return // ya cargadas

    let alive = true
    setSessionsLoading(true)
    setSessionsError(null)
    api
      .listSessionsForCampaign(campaign.id)
      .then((list) => {
        if (!alive) return
        const sorted = [...list].sort((a, b) => a.session_number - b.session_number)
        setSessions(sorted)
        setSelectedSessionId((prev) => {
          if (prev && sorted.some((s) => s.id === prev)) return prev
          return sorted[0]?.id ? String(sorted[0].id) : null
        })
      })
      .catch((e) => {
        if (!alive) return
        setSessionsError(formatError(e))
      })
      .finally(() => {
        if (!alive) return
        setSessionsLoading(false)
      })

    return () => {
      alive = false
    }
  }, [campaign, detailTab, sessions])

  const derivedPlayers = useMemo(() => players, [players])

  useEffect(() => {
    if (!derivedPlayers.length) {
      if (selectedPlayerIndex !== 0) setSelectedPlayerIndex(0)
      return
    }
    if (selectedPlayerIndex < 0 || selectedPlayerIndex >= derivedPlayers.length) setSelectedPlayerIndex(0)
  }, [derivedPlayers.length, selectedPlayerIndex])

  const selectedSession = useMemo(() => {
    if (!sessions || !selectedSessionId) return null
    return sessions.find((s) => s.id === selectedSessionId) ?? null
  }, [sessions, selectedSessionId])

  const selectedPlayer = selectedPlayerIndex >= 0 ? derivedPlayers[selectedPlayerIndex] : null

  useEffect(() => {
    if (!campaign) return
    if (detailTab !== 'jugadores') return
    let alive = true
    setPlayersLoading(true)
    setPlayersError(null)
    api
      .listPlayersForCampaign(campaign.id)
      .then((list) => {
        if (!alive) return
        const normalized = list.map((p: PlayerProfile, idx) => ({
          id: String(p.id ?? idx),
          name: String(p.name ?? `Jugador ${idx + 1}`),
          summary: String(p.summary ?? ''),
          basicSheet: p.basic_sheet ?? null,
        }))
        setPlayers(normalized)
        setSelectedPlayerIndex(0)
      })
      .catch((e) => {
        if (!alive) return
        setPlayersError(formatError(e))
      })
      .finally(() => {
        if (!alive) return
        setPlayersLoading(false)
      })
    return () => {
      alive = false
    }
  }, [campaign, detailTab])

  useEffect(() => {
    if (!selectedSession) {
      setSessionDraftEditor('')
      setSessionSummaryEditor('')
      return
    }
    // Sincronizar resumen con el valor en API (p. ej. tras «Crear y generar»).
    setSessionSummaryEditor(selectedSession.summary ?? '')
    const approved = selectedSession.approval_status === 'approved'
    setSessionDraftEditor(
      approved
        ? (selectedSession.content_final ?? selectedSession.content_draft ?? '')
        : (selectedSession.content_draft ?? ''),
    )
  }, [
    selectedSession?.id,
    selectedSession?.summary,
    selectedSession?.content_draft,
    selectedSession?.content_final,
    selectedSession?.approval_status,
  ])

  async function onCreateAndGenerateSessions() {
    if (!campaign) return
    const count = Math.max(1, Math.min(Number(createSessionsCount) || 1, 20))
    setCreateSessionsLoading(true)
    setCreateSessionsError(null)
    try {
      const created = await api.generateSessionsForCampaign(campaign.id, count)
      const sorted = [...created].sort((a, b) => a.session_number - b.session_number)
      setSessions(sorted)
      setSelectedSessionId(sorted[0]?.id ? String(sorted[0].id) : null)
      setCreateSessionsOpen(false)
    } catch (e) {
      setCreateSessionsError(formatError(e))
    } finally {
      setCreateSessionsLoading(false)
    }
  }

  async function onApproveSession() {
    if (!selectedSession) return
    if (selectedSession.approval_status === 'approved') return
    setSessionApproving(true)
    setSessionsError(null)
    try {
      const updated = await api.approveSession(selectedSession.id)
      setSessions((prev) => {
        if (!prev) return prev
        return prev.map((item) => (item.id === updated.id ? updated : item))
      })
    } catch (e) {
      setSessionsError(formatError(e))
    } finally {
      setSessionApproving(false)
    }
  }

  async function onReopenSession() {
    if (!selectedSession) return
    if (selectedSession.approval_status !== 'approved') return
    setSessionReopening(true)
    setSessionsError(null)

    const dbg = '[dndhelper UI] session «Volver a borrador»'
    console.info(`${dbg} click`, {
      campaignId: campaign?.id ?? null,
      sessionId: selectedSession.id,
      sessionNumber: selectedSession.session_number,
      approval_status: selectedSession.approval_status,
      content_draft_len: (selectedSession.content_draft ?? '').length,
      content_final_len: (selectedSession.content_final ?? '').length,
    })

    try {
      const updated = await api.reopenSession(selectedSession.id)
      console.info(`${dbg} ok`, {
        id: updated.id,
        approval_status: updated.approval_status,
        content_final: updated.content_final,
        content_draft_len: (updated.content_draft ?? '').length,
      })
      setSessions((prev) => {
        if (!prev) return prev
        return prev.map((item) => (item.id === updated.id ? updated : item))
      })
    } catch (e) {
      const extra =
        e && typeof e === 'object' && 'status' in e && 'body' in e
          ? { status: (e as { status: number }).status, body: (e as { body: unknown }).body }
          : { raw: String(e) }
      console.error(`${dbg} fallo`, extra)
      const msg = formatError(e)
      setSessionsError(
        `${msg}\n\n(Abre la consola del navegador F12 → «Console» y busca «dndhelper» para ver URL, código HTTP y cuerpo de respuesta.)`,
      )
    } finally {
      setSessionReopening(false)
    }
  }

  async function onSaveSessionSummary() {
    if (!selectedSession) return
    if (selectedSession.approval_status === 'approved') {
      setSessionsError('El resumen no se puede editar una vez aprobada la sesión.')
      return
    }
    setSessionSummarySaving(true)
    setSessionsError(null)
    const trimmed = sessionSummaryEditor.replace(/\r\n/g, '\n').trimEnd()
    try {
      const updated = await api.patchSession(selectedSession.id, {
        summary: trimmed.length > 0 ? trimmed : null,
      })
      setSessions((prev) => {
        if (!prev) return prev
        return prev.map((s) => (s.id === updated.id ? updated : s))
      })
      setSessionSummaryEditor(updated.summary ?? '')
    } catch (e) {
      setSessionsError(formatError(e))
    } finally {
      setSessionSummarySaving(false)
    }
  }

  async function onSaveSessionDraft() {
    if (!selectedSession) return
    if (selectedSession.approval_status === 'approved') {
      setSessionsError('La sesión ya está aprobada y no se puede editar.')
      return
    }
    setSessionDraftSaving(true)
    setSessionsError(null)
    try {
      const updated = await api.patchSession(selectedSession.id, { content_draft: sessionDraftEditor })
      setSessions((prev) => {
        if (!prev) return prev
        return prev.map((s) => (s.id === updated.id ? updated : s))
      })
    } catch (e) {
      setSessionsError(formatError(e))
    } finally {
      setSessionDraftSaving(false)
    }
  }

  async function confirmDeleteSession() {
    if (!campaign || !sessionDeletePending) return
    const sessionId = sessionDeletePending.id
    setSessionDeleteLoadingId(sessionId)
    setSessionsError(null)
    try {
      await api.deleteSession(sessionId)
      setSessionDeletePending(null)
      const refreshed = await api.listSessionsForCampaign(campaign.id)
      const sorted = [...refreshed].sort((a, b) => a.session_number - b.session_number)
      setSessions(sorted)
      setSelectedSessionId((prev) => {
        if (prev && prev !== sessionId && sorted.some((s) => s.id === prev)) return prev
        return sorted[0]?.id ? String(sorted[0].id) : null
      })
    } catch (e) {
      setSessionsError(formatError(e))
    } finally {
      setSessionDeleteLoadingId(null)
    }
  }

  async function onCreateAndGeneratePlayers() {
    if (!campaign) return
    const count = Math.max(1, Math.min(Number(createPlayersCount) || 1, 8))
    setPlayersLoading(true)
    setPlayersError(null)
    try {
      const generated = await api.generatePlayersForCampaign(campaign.id, count)
      const normalized = generated.map((p: PlayerProfile, idx) => ({
        id: String(p.id ?? idx),
        name: String(p.name ?? `Jugador ${idx + 1}`),
        summary: String(p.summary ?? ''),
        basicSheet: p.basic_sheet ?? null,
      }))
      setPlayers(normalized)
      setSelectedPlayerIndex(0)
      setCreatePlayersOpen(false)
    } catch (e) {
      setPlayersError(formatError(e))
    } finally {
      setPlayersLoading(false)
    }
  }

  function confirmCampaignWizardRemove() {
    if (!campaignWizardRemovePending) return
    const { kind, index } = campaignWizardRemovePending
    if (kind === 'theme') {
      setWizard((w) => ({
        ...w,
        themes: w.themes.length > 1 ? w.themes.filter((_, idx) => idx !== index) : w.themes,
      }))
    } else {
      setWizard((w) => ({
        ...w,
        inspirations: w.inspirations.length > 1 ? w.inspirations.filter((_, idx) => idx !== index) : w.inspirations,
      }))
    }
    setCampaignWizardRemovePending(null)
  }

  async function confirmDeleteGeneratedPlayer() {
    if (!campaign || !playerDeletePending) return
    setPlayerDeleteBusy(true)
    setPlayersError(null)
    try {
      const updated = await api.deletePlayerForCampaign(campaign.id, playerDeletePending.id)
      setPlayerDeletePending(null)
      const normalized = updated.map((p: PlayerProfile, idx) => ({
        id: String(p.id ?? idx),
        name: String(p.name ?? `Jugador ${idx + 1}`),
        summary: String(p.summary ?? ''),
        basicSheet: p.basic_sheet ?? null,
      }))
      setPlayers(normalized)
      setSelectedPlayerIndex((prev) => Math.min(prev, Math.max(normalized.length - 1, 0)))
    } catch (e) {
      setPlayersError(formatError(e))
    } finally {
      setPlayerDeleteBusy(false)
    }
  }

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

  useEffect(() => {
    setOutlineDirty(false)
  }, [campaign?.id])

  useEffect(() => {
    if (!campaign) return
    if (campaign.brief_status !== 'approved') return
    if (outlineDirty) return
    const raw =
      campaign.outline_status === 'approved'
        ? (campaign.outline_final ?? '')
        : (campaign.outline_draft ?? '')
    if (!raw.trim()) {
      setOutlineEditorText('')
      return
    }
    try {
      const parsed = JSON.parse(raw) as unknown
      setOutlineEditorText(JSON.stringify(parsed, null, 2))
    } catch {
      setOutlineEditorText(raw)
    }
  }, [
    campaign?.id,
    campaign?.brief_status,
    campaign?.outline_draft,
    campaign?.outline_final,
    campaign?.outline_status,
    outlineDirty,
  ])

  useEffect(() => {
    if (!campaign) return
    if (campaignNameDirty) return
    setCampaignNameEditor(campaign.name ?? '')
  }, [campaign?.name, campaignNameDirty])

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

  /** Mundos elegibles: solo aprobados; si la campaña ya tiene un mundo no aprobado vinculado, se muestra también para poder desvincular o cambiar. */
  const worldOptions = useMemo(() => {
    const all = worlds ?? []
    const approved = all.filter((w) => (w.status ?? '').toLowerCase() === 'approved')
    const wid = campaign?.world_id
    if (!wid) return approved
    const linked = all.find((w) => w.id === wid)
    if (!linked) return approved
    if (approved.some((w) => w.id === linked.id)) return approved
    return [linked, ...approved]
  }, [worlds, campaign?.world_id])
  const linkedWorld = useMemo(() => {
    if (!campaign?.world_id || !worlds) return null
    return worlds.find((w) => w.id === campaign.world_id) ?? null
  }, [campaign?.world_id, worlds])
  /** Misma condición que el backend para `outline:generate`. */
  const worldReadyForOutline = useMemo(() => {
    if (!linkedWorld) return false
    return linkedWorld.status === 'approved' && !!(linkedWorld.content_final ?? '').trim()
  }, [linkedWorld])
  const themes = useMemo(() => wizard.themes.map((t) => t.trim()).filter(Boolean), [wizard.themes])
  const inspirations = useMemo(() => wizard.inspirations.map((t) => t.trim()).filter(Boolean), [wizard.inspirations])
  const visibleSteps = useExistingWorld === true ? [0, 2, 3] : [0, 1, 2, 3, 4]
  const stepPos = visibleSteps.includes(step) ? visibleSteps.indexOf(step) + 1 : 1
  const firstVisibleStep = visibleSteps[0]
  const currentVisibleIndex = visibleSteps.indexOf(step)
  const canGoPrev = currentVisibleIndex > 0
  const canGoNext = currentVisibleIndex >= 0 && currentVisibleIndex < visibleSteps.length - 1

  /** No hacer trim() en cada tecla: si no, al escribir un espacio entre palabras desaparece (trim quita el trailing space). */
  function setConstraintNotes(notes: string) {
    setWizard((w) => {
      if (notes === '') {
        const rest = { ...(w.constraints ?? {}) } as Record<string, unknown>
        delete rest.notes
        return { ...w, constraints: Object.keys(rest).length > 0 ? (rest as CampaignWizardDraft['constraints']) : null }
      }
      return { ...w, constraints: { ...(w.constraints ?? {}), notes } }
    })
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

  async function onGenerateOutline() {
    if (!id || !campaign) return
    setOutlineGenerating(true)
    setError(null)
    setOk(null)
    try {
      const updated = await api.generateOutlineForCampaign(id)
      setCampaign(updated)
      setOutlineDirty(false)
      setOk('Outline generado. Revísalo y aprueba cuando esté listo.')
    } catch (e) {
      setError(formatError(e))
    } finally {
      setOutlineGenerating(false)
    }
  }

  async function onSaveOutlineDraft() {
    if (!id || !campaign) return
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(outlineEditorText) as Record<string, unknown>
    } catch {
      setError('El outline no es JSON válido.')
      return
    }
    setOutlineSaving(true)
    setError(null)
    setOk(null)
    try {
      const updated = await api.patchCampaignOutline(id, parsed)
      setCampaign(updated)
      setOutlineDirty(false)
      setOk('Outline guardado')
    } catch (e) {
      setError(formatError(e))
    } finally {
      setOutlineSaving(false)
    }
  }

  async function onApproveOutline() {
    if (!id || !campaign) return
    setOutlineApproving(true)
    setError(null)
    setOk(null)
    try {
      const updated = await api.approveCampaignOutline(id)
      setCampaign(updated)
      setOutlineDirty(false)
      setOk('Outline aprobado. Ya puedes crear sesiones.')
    } catch (e) {
      setError(formatError(e))
    } finally {
      setOutlineApproving(false)
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

  async function onSaveCampaignName() {
    if (!id || !campaign) return
    if (campaign.brief_status === 'approved') {
      setError('El nombre no se puede cambiar una vez aprobado el resumen inicial.')
      return
    }
    const trimmed = campaignNameEditor.trim()
    if (!trimmed) {
      setError('El nombre no puede estar vacío.')
      return
    }
    setNameSaving(true)
    setError(null)
    setOk(null)
    try {
      const updated = await api.patchCampaign(id, { name: trimmed })
      setCampaign(updated)
      setCampaignNameEditor(updated.name)
      setCampaignNameDirty(false)
      setOk('Nombre guardado')
    } catch (e) {
      setError(formatError(e))
    } finally {
      setNameSaving(false)
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
          <h2 style={{ margin: 0, fontSize: 30, textAlign: 'left' }}>Campaña</h2>
        </div>
        {campaign && <code>{campaign.id}</code>}
      </div>

      {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
      {ok && <div style={{ color: 'lightgreen' }}>{ok}</div>}
      {!campaign && !error && <div>Cargando…</div>}

      {campaign && (
        <>
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 2fr) minmax(140px, 1fr) minmax(140px, 1fr)', gap: 12, alignItems: 'start' }}>
              <div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>Nombre</div>
                {campaign.brief_status === 'approved' ? (
                  <div style={{ marginTop: 6, fontWeight: 650, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 13 }}>
                    {campaign.name}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                    <input
                      value={campaignNameEditor}
                      onChange={(e) => {
                        setCampaignNameEditor(e.target.value)
                        setCampaignNameDirty(true)
                      }}
                      style={{
                        width: '100%',
                        minWidth: 220,
                        padding: 8,
                        borderRadius: 10,
                        border: '1px solid var(--border-subtle)',
                        background: 'rgba(0,0,0,0.25)',
                        color: 'inherit',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        fontSize: 13,
                      }}
                      disabled={nameSaving || saving || storySaving}
                    />
                    <IconButton
                      label="Guardar nombre de campaña"
                      textShort="Guardar"
                      busy={nameSaving}
                      busyLabel="Guardando nombre…"
                      busyShort="…"
                      disabled={saving || !campaignNameDirty || !campaignNameEditor.trim()}
                      className="btn-icon--inline"
                      onClick={() => void onSaveCampaignName()}
                    >
                      <IconSave />
                    </IconButton>
                  </div>
                )}
              </div>
              <div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>Sistema</div>
                <div>{campaign.system}</div>
              </div>
              <div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>Resumen inicial</div>
                <div>{toSpanishStatus(campaign.brief_status)}</div>
              </div>
            </div>
          </div>

          {campaign.brief_status !== 'approved' && !campaign.story_draft && (
            <CampaignBriefAssistantPanel
              campaign={campaign}
              worlds={worlds}
              worldOptions={worldOptions}
              worldId={worldId}
              setWorldId={setWorldId}
              useExistingWorld={useExistingWorld}
              wizard={wizard}
              setWizard={setWizard}
              step={step}
              setStep={setStep}
              visibleSteps={visibleSteps}
              stepPos={stepPos}
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
              firstVisibleStep={firstVisibleStep}
              currentVisibleIndex={currentVisibleIndex}
              autogeneratingStep={autogeneratingStep}
              saving={saving}
              canContinueFromCurrentStep={canContinueFromCurrentStep}
              getConstraintNotes={getConstraintNotes}
              setConstraintNotes={setConstraintNotes}
              onLinkWorld={onLinkWorld}
              onAutogenerateStep={onAutogenerateStep}
              onSaveBriefDraft={onSaveBriefDraft}
              onResetWizard={onResetWizard}
              setCampaignWizardRemovePending={setCampaignWizardRemovePending}
            />
          )}

          {(campaign.brief_status === 'approved' || !!campaign.story_draft) && (
            <>
              <TabBar style={{ marginTop: 10 }}>
                <TabButton active={detailTab === 'historia'} onSelect={() => setDetailTab('historia')}>
                  Historia
                </TabButton>
                <TabButton active={detailTab === 'sesiones'} onSelect={() => setDetailTab('sesiones')}>
                  Sesiones
                </TabButton>
                <TabButton active={detailTab === 'jugadores'} onSelect={() => setDetailTab('jugadores')}>
                  Jugadores
                </TabButton>
              </TabBar>

              {detailTab === 'historia' && (
                <CampaignHistoriaTab
                  campaign={campaign}
                  linkedWorld={linkedWorld}
                  worldReadyForOutline={worldReadyForOutline}
                  worldId={worldId}
                  storyEditorText={storyEditorText}
                  setStoryEditorText={setStoryEditorText}
                  storySaving={storySaving}
                  saving={saving}
                  reopening={reopening}
                  outlineEditorText={outlineEditorText}
                  setOutlineEditorText={setOutlineEditorText}
                  setOutlineDirty={setOutlineDirty}
                  outlineGenerating={outlineGenerating}
                  outlineSaving={outlineSaving}
                  outlineApproving={outlineApproving}
                  onSaveStoryDraft={onSaveStoryDraft}
                  onApproveBrief={onApproveBrief}
                  onResetWizard={onResetWizard}
                  onReopenCampaign={onReopenCampaign}
                  onGenerateOutline={onGenerateOutline}
                  onSaveOutlineDraft={onSaveOutlineDraft}
                  onApproveOutline={onApproveOutline}
                />
              )}

              {detailTab === 'sesiones' && (
                <CampaignSesionesTab
                  campaign={campaign}
                  sessions={sessions}
                  sessionsLoading={sessionsLoading}
                  sessionsError={sessionsError}
                  createSessionsOpen={createSessionsOpen}
                  setCreateSessionsOpen={setCreateSessionsOpen}
                  createSessionsCount={createSessionsCount}
                  setCreateSessionsCount={setCreateSessionsCount}
                  createSessionsLoading={createSessionsLoading}
                  createSessionsError={createSessionsError}
                  setCreateSessionsError={setCreateSessionsError}
                  selectedSessionId={selectedSessionId}
                  setSelectedSessionId={setSelectedSessionId}
                  selectedSession={selectedSession}
                  sessionSummaryEditor={sessionSummaryEditor}
                  setSessionSummaryEditor={setSessionSummaryEditor}
                  sessionDraftEditor={sessionDraftEditor}
                  setSessionDraftEditor={setSessionDraftEditor}
                  sessionSummarySaving={sessionSummarySaving}
                  sessionDraftSaving={sessionDraftSaving}
                  sessionDeleteLoadingId={sessionDeleteLoadingId}
                  sessionApproving={sessionApproving}
                  sessionReopening={sessionReopening}
                  onCreateAndGenerateSessions={onCreateAndGenerateSessions}
                  onApproveSession={onApproveSession}
                  onReopenSession={onReopenSession}
                  onSaveSessionSummary={onSaveSessionSummary}
                  onSaveSessionDraft={onSaveSessionDraft}
                  setSessionDeletePending={setSessionDeletePending}
                />
              )}

              {detailTab === 'jugadores' && (
                <CampaignJugadoresTab
                  campaign={campaign}
                  derivedPlayers={derivedPlayers}
                  playersLoading={playersLoading}
                  playersError={playersError}
                  createPlayersOpen={createPlayersOpen}
                  setCreatePlayersOpen={setCreatePlayersOpen}
                  createPlayersCount={createPlayersCount}
                  setCreatePlayersCount={setCreatePlayersCount}
                  setPlayersError={setPlayersError}
                  selectedPlayerIndex={selectedPlayerIndex}
                  setSelectedPlayerIndex={setSelectedPlayerIndex}
                  selectedPlayer={selectedPlayer}
                  onCreateAndGeneratePlayers={onCreateAndGeneratePlayers}
                  setPlayerDeletePending={setPlayerDeletePending}
                />
              )}
            </>
          )}
        </>
      )}

      <ConfirmCascadeDeleteDialog
        open={campaignWizardRemovePending !== null}
        onClose={() => setCampaignWizardRemovePending(null)}
        title={
          campaignWizardRemovePending
            ? campaignWizardRemovePending.kind === 'theme'
              ? `Quitar tema «${campaignWizardRemovePending.label}»`
              : `Quitar inspiración «${campaignWizardRemovePending.label}»`
            : 'Quitar entrada'
        }
        description="Solo afecta al borrador del asistente de campaña en este navegador hasta que guardes el brief."
        details={
          campaignWizardRemovePending?.kind === 'theme'
            ? ['Este tema dejará de enviarse al generar el resumen inicial']
            : ['Esta inspiración dejará de enviarse al generar el mundo de campaña']
        }
        confirmLabel="Quitar"
        onConfirm={() => confirmCampaignWizardRemove()}
      />

      <ConfirmCascadeDeleteDialog
        open={sessionDeletePending !== null}
        onClose={() => {
          if (sessionDeleteLoadingId === null) setSessionDeletePending(null)
        }}
        title={
          sessionDeletePending
            ? `Borrar sesión ${sessionDeletePending.session_number}: «${sessionDeletePending.title}»`
            : 'Borrar sesión'
        }
        description="La sesión dejará de existir en esta campaña."
        details={
          sessionDeletePending
            ? [
                'Resumen o planificación guardados',
                'Notas y borrador de acta, o contenido final si estaba aprobado',
                'Estado de aprobación y metadatos de la sesión',
              ]
            : undefined
        }
        confirmLabel="Borrar sesión"
        busy={sessionDeleteLoadingId !== null}
        onConfirm={() => void confirmDeleteSession()}
      />

      <ConfirmCascadeDeleteDialog
        open={playerDeletePending !== null}
        onClose={() => {
          if (!playerDeleteBusy) setPlayerDeletePending(null)
        }}
        title={playerDeletePending ? `Borrar personaje «${playerDeletePending.name}»` : 'Borrar personaje'}
        description="Se elimina solo este jugador del listado generado de la campaña."
        details={
          playerDeletePending
            ? ['Resumen del personaje', 'Ficha básica asociada en el borrador de la campaña']
            : undefined
        }
        confirmLabel="Borrar personaje"
        busy={playerDeleteBusy}
        onConfirm={() => void confirmDeleteGeneratedPlayer()}
      />
    </div>
  )
}

