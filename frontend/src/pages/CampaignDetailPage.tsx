import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Campaign, CampaignBrief, CampaignWizardDraft, PlayerProfile, Session, World } from '../lib/api'
import { formatError } from '../lib/errors'
import { ConfirmCascadeDeleteDialog } from '../components/ConfirmCascadeDeleteDialog'
import { IconButton } from '../components/IconButton'
import {
  IconArrowLeft,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconLink,
  IconMinus,
  IconPlus,
  IconRotateCcw,
  IconSave,
  IconSparkles,
  IconTrash,
  IconUsers,
  IconX,
} from '../components/icons'
import { toSpanishStatus } from '../lib/statusLabels'
import { TabBar, TabButton } from '../components/TabBar'

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

type PlayerDerived = {
  id: string
  name: string
  summary: string
  basicSheet: unknown
}

function formatSheetLabel(rawKey: string): string {
  return rawKey
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase())
}

function formatSheetScalar(value: unknown): string {
  if (value == null) return '(vacío)'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  return String(value)
}

function renderStructuredSheet(value: unknown, level = 0): ReactNode {
  if (value == null) return <span style={{ opacity: 0.75 }}>(vacío)</span>

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <span>{String(value)}</span>
  }

  if (Array.isArray(value)) {
    if (!value.length) return <span style={{ opacity: 0.75 }}>(sin elementos)</span>
    return (
      <ul style={{ margin: 0, paddingLeft: level === 0 ? 18 : 16, display: 'grid', gap: 4 }}>
        {value.map((item, idx) => (
          <li key={`sheet-list-${level}-${idx}`}>{renderStructuredSheet(item, level + 1)}</li>
        ))}
      </ul>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (!entries.length) return <span style={{ opacity: 0.75 }}>(sin contenido)</span>
    const scalarEntries = entries.filter(([, v]) => v == null || ['string', 'number', 'boolean'].includes(typeof v))
    const complexEntries = entries.filter(([, v]) => !(v == null || ['string', 'number', 'boolean'].includes(typeof v)))

    return (
      <div style={{ display: 'grid', gap: 8, textAlign: 'left' }}>
        {scalarEntries.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(140px, 220px) 1fr',
              gap: 8,
              alignItems: 'start',
            }}
          >
            {scalarEntries.map(([k, v]) => (
              <div key={`sheet-scalar-row-${level}-${k}`} style={{ display: 'contents' }}>
                <div style={{ opacity: 0.85, fontWeight: 650 }}>
                  {formatSheetLabel(k)}
                </div>
                <div>{formatSheetScalar(v)}</div>
              </div>
            ))}
          </div>
        )}

        {complexEntries.map(([k, v]) => (
          <div key={`sheet-key-${level}-${k}`} style={{ marginLeft: level > 0 ? 8 : 0 }}>
            <div style={{ fontWeight: 700, marginTop: scalarEntries.length > 0 ? 2 : 0 }}>{formatSheetLabel(k)}</div>
            <div style={{ marginLeft: 10, marginTop: 4 }}>{renderStructuredSheet(v, level + 1)}</div>
          </div>
        ))}
      </div>
    )
  }

  return <span>{String(value)}</span>
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
  const [nameSaving, setNameSaving] = useState(false)
  const [storyEditorText, setStoryEditorText] = useState('')
  const [storySaving, setStorySaving] = useState(false)
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
  const [campaignWizardRemovePending, setCampaignWizardRemovePending] = useState<{
    kind: 'theme' | 'inspiration'
    index: number
    label: string
  } | null>(null)
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
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 24, textAlign: 'left' }}>Asistente de resumen inicial</h3>
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
                      <IconButton
                        label="Vincular mundo a la campaña"
                        textShort="Vincular"
                        busy={saving}
                        busyLabel="Vinculando mundo…"
                        busyShort="…"
                        disabled={!worldId || campaign?.world_id === worldId}
                        className="btn-icon--inline"
                        onClick={() => void onLinkWorld()}
                      >
                        <IconLink />
                      </IconButton>
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
                  <IconButton
                    label="Autogenerar tipo y tono con IA"
                    textShort="IA"
                    busy={autogeneratingStep === 0}
                    busyLabel="Autogenerando…"
                    busyShort="…"
                    disabled={autogeneratingStep !== null || saving}
                    className="btn-icon--inline"
                    onClick={() => void onAutogenerateStep(0)}
                  >
                    <IconSparkles />
                  </IconButton>
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
                  <IconButton
                    label="Autogenerar temas con IA"
                    textShort="IA"
                    busy={autogeneratingStep === 1}
                    busyLabel="Autogenerando…"
                    busyShort="…"
                    disabled={autogeneratingStep !== null || saving}
                    className="btn-icon--inline"
                    onClick={() => void onAutogenerateStep(1)}
                  >
                    <IconSparkles />
                  </IconButton>
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
                    <IconButton
                      label="Quitar tema"
                      textShort="Quitar"
                      className="btn-icon--inline"
                      disabled={wizard.themes.length <= 1}
                      onClick={() =>
                        setCampaignWizardRemovePending({
                          kind: 'theme',
                          index: i,
                          label: t.trim() || `Tema ${i + 1}`,
                        })
                      }
                    >
                      <IconMinus />
                    </IconButton>
                  </div>
                ))}
                <div>
                  <IconButton
                    label="Añadir tema"
                    textShort="Añadir"
                    className="btn-icon--inline"
                    onClick={() => setWizard((w) => ({ ...w, themes: [...w.themes, ''] }))}
                  >
                    <IconPlus />
                  </IconButton>
                </div>
              </div>
            )}

            {step === 3 && (
              <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>Nivel inicial y restricciones</div>
                  <IconButton
                    label="Autogenerar nivel y restricciones con IA"
                    textShort="IA"
                    busy={autogeneratingStep === 2}
                    busyLabel="Autogenerando…"
                    busyShort="…"
                    disabled={autogeneratingStep !== null || saving}
                    className="btn-icon--inline"
                    onClick={() => void onAutogenerateStep(2)}
                  >
                    <IconSparkles />
                  </IconButton>
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
                  <IconButton
                    label="Autogenerar inspiraciones con IA"
                    textShort="IA"
                    busy={autogeneratingStep === 3}
                    busyLabel="Autogenerando…"
                    busyShort="…"
                    disabled={autogeneratingStep !== null || saving}
                    className="btn-icon--inline"
                    onClick={() => void onAutogenerateStep(3)}
                  >
                    <IconSparkles />
                  </IconButton>
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
                    <IconButton
                      label="Quitar inspiración"
                      textShort="Quitar"
                      className="btn-icon--inline"
                      disabled={wizard.inspirations.length <= 1}
                      onClick={() =>
                        setCampaignWizardRemovePending({
                          kind: 'inspiration',
                          index: i,
                          label: t.trim() || `Inspiración ${i + 1}`,
                        })
                      }
                    >
                      <IconMinus />
                    </IconButton>
                  </div>
                ))}
                <div>
                  <IconButton
                    label="Añadir inspiración"
                    textShort="Añadir"
                    className="btn-icon--inline"
                    onClick={() => setWizard((w) => ({ ...w, inspirations: [...w.inspirations, ''] }))}
                  >
                    <IconPlus />
                  </IconButton>
                </div>
              </div>
            )}

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <IconButton
                  label="Paso anterior del asistente"
                  textShort="Atrás"
                  disabled={!canGoPrev || saving}
                  className="btn-icon--inline"
                  onClick={() => setStep(visibleSteps[Math.max(0, currentVisibleIndex - 1)] ?? firstVisibleStep)}
                >
                  <IconChevronLeft />
                </IconButton>
                <IconButton
                  label="Reiniciar asistente de campaña"
                  textShort="Reiniciar"
                  disabled={saving}
                  className="btn-icon--inline"
                  onClick={() => void onResetWizard()}
                >
                  <IconRotateCcw />
                </IconButton>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {canGoNext ? (
                  <IconButton
                    label="Siguiente paso del asistente"
                    textShort="Siguiente"
                    disabled={!canContinueFromCurrentStep() || saving}
                    className="btn-icon--inline"
                    onClick={() => setStep(visibleSteps[currentVisibleIndex + 1])}
                  >
                    <IconChevronRight />
                  </IconButton>
                ) : (
                  <IconButton
                    label="Guardar borrador del brief"
                    textShort="Guardar"
                    busy={saving}
                    busyLabel="Guardando brief…"
                    busyShort="…"
                    disabled={!canContinueFromCurrentStep()}
                    className="btn-icon--inline"
                    onClick={() => void onSaveBriefDraft()}
                  >
                    <IconSave />
                  </IconButton>
                )}
              </div>
            </div>

            <div style={{ marginTop: 10, opacity: 0.8 }}>
              Estado: {toSpanishStatus(campaign.brief_status)}
            </div>
            </div>
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
                <>
              {campaign.brief_status !== 'approved' ? (
                <>
                  {campaign.story_draft && (
                    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12, marginTop: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: 22, textAlign: 'left' }}>Borrador del resumen de historia</h3>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <IconButton
                            label="Guardar borrador del resumen de historia"
                            textShort="Guardar"
                            busy={storySaving}
                            busyLabel="Guardando borrador…"
                            busyShort="…"
                            disabled={saving || !campaign.world_id || campaign.world_id !== worldId}
                            className="btn-icon--inline"
                            onClick={() => void onSaveStoryDraft()}
                          >
                            <IconSave />
                          </IconButton>
                          <IconButton
                            label="Aprobar resumen de historia"
                            textShort="Aprobar"
                            busy={saving}
                            busyLabel="Aprobando…"
                            busyShort="…"
                            disabled={
                              storySaving ||
                              !campaign.world_id ||
                              campaign.world_id !== worldId ||
                              !storyEditorText.trim().length
                            }
                            className="btn-icon--inline"
                            onClick={() => void onApproveBrief()}
                          >
                            <IconCheck />
                          </IconButton>
                          <IconButton
                            label="Reiniciar asistente de campaña"
                            textShort="Reiniciar"
                            disabled={saving || storySaving}
                            className="btn-icon--inline"
                            onClick={() => void onResetWizard()}
                          >
                            <IconRotateCcw />
                          </IconButton>
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
                </>
              ) : (
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12, marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: 22, textAlign: 'left' }}>Resumen final de historia</h3>
                    <IconButton
                      label="Volver la historia a borrador"
                      textShort="Borrador"
                      busy={reopening}
                      busyLabel="Reabriendo…"
                      busyShort="…"
                      className="btn-icon--inline"
                      onClick={() => void onReopenCampaign()}
                    >
                      <IconRotateCcw />
                    </IconButton>
                  </div>
                  <div style={{ marginTop: 10 }}>{storyFinalRendered}</div>
                </div>
              )}
                </>
              )}

              {detailTab === 'sesiones' && (
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12, marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <h3 style={{ marginTop: 0, fontSize: 24, textAlign: 'left' }}>Sesiones vinculadas</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <IconButton
                    label="Crear sesiones y generar con IA"
                    textShort="Sesiones"
                    busy={createSessionsLoading}
                    busyLabel="Generando sesiones…"
                    busyShort="…"
                    disabled={
                      sessionsLoading ||
                      campaign.brief_status !== 'approved' ||
                      (campaign.outline_status || '').toLowerCase() !== 'approved'
                    }
                    className="btn-icon--inline"
                    onClick={() => {
                      setCreateSessionsError(null)
                      setCreateSessionsOpen(true)
                    }}
                  >
                    <IconSparkles />
                  </IconButton>
                </div>
              </div>
              {sessionsError && (
                <div style={{ color: 'var(--danger)', whiteSpace: 'pre-wrap' }}>{sessionsError}</div>
              )}
              {createSessionsError && <div style={{ color: 'var(--danger)', marginTop: 8 }}>{createSessionsError}</div>}
              {campaign.brief_status === 'approved' &&
                (campaign.outline_status || '').toLowerCase() !== 'approved' && (
                  <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
                    Genera y aprueba el <strong>outline</strong> en la pestaña Historia antes de crear sesiones.
                  </div>
                )}
              {!sessions && !sessionsError && sessionsLoading && <div>Cargando…</div>}
              {sessions && sessions.length === 0 && <div>No hay sesiones para esta campaña.</div>}

              {createSessionsOpen && (
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12, marginTop: 12 }}>
                  <h4 style={{ margin: '0 0 8px 0' }}>Crear sesiones</h4>
                  <p style={{ margin: 0, opacity: 0.85, fontSize: 13 }}>
                    Se generan título y resumen por sesión. Luego puedes editar el resumen y redactar el guion (borrador) a mano en el detalle de cada sesión.
                  </p>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <label style={{ display: 'grid', gap: 6 }}>
                      <span style={{ opacity: 0.75, fontSize: 12 }}>¿Cuántas sesiones crear? (1-20)</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={createSessionsCount}
                        onChange={(e) => setCreateSessionsCount(Number(e.target.value))}
                        style={{
                          padding: 8,
                          borderRadius: 10,
                          border: '1px solid var(--border-subtle)',
                          background: 'rgba(0,0,0,0.25)',
                          color: 'inherit',
                          width: 140,
                        }}
                        disabled={createSessionsLoading}
                      />
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <IconButton
                        label="Cerrar sin crear sesiones"
                        textShort="Cerrar"
                        disabled={createSessionsLoading}
                        className="btn-icon--inline"
                        onClick={() => setCreateSessionsOpen(false)}
                      >
                        <IconX />
                      </IconButton>
                      <IconButton
                        label="Crear sesiones y generar con IA"
                        textShort="Crear"
                        busy={createSessionsLoading}
                        busyLabel="Creando sesiones…"
                        busyShort="…"
                        className="btn-icon--inline"
                        onClick={() => void onCreateAndGenerateSessions()}
                      >
                        <IconSparkles />
                      </IconButton>
                    </div>
                  </div>
                </div>
              )}

              {sessions && sessions.length > 0 && (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: 'var(--table-header-bg)' }}>
                        <tr>
                          <th style={{ textAlign: 'left', padding: 10 }}>Orden</th>
                          <th style={{ textAlign: 'left', padding: 10 }}>Nombre</th>
                          <th style={{ textAlign: 'left', padding: 10 }}>Aprobación</th>
                          <th style={{ textAlign: 'left', padding: 10 }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((s) => (
                          <tr
                            key={s.id}
                            onClick={() => setSelectedSessionId(s.id)}
                            style={{
                              borderTop: '1px solid var(--table-row-border)',
                              background: selectedSessionId === s.id ? 'var(--table-row-selected)' : undefined,
                              cursor: 'pointer',
                            }}
                          >
                            <td style={{ padding: 10 }}>{s.session_number}</td>
                            <td style={{ padding: 10 }}>{s.title}</td>
                            <td style={{ padding: 10 }}>{toSpanishStatus(s.approval_status)}</td>
                            <td style={{ padding: 10 }}>
                              <IconButton
                                label={`Borrar sesión ${s.session_number}`}
                                textShort="Borrar"
                                busy={sessionDeleteLoadingId === s.id}
                                busyLabel="Borrando…"
                                busyShort="…"
                                disabled={createSessionsLoading}
                                className="btn-icon--inline"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSessionDeletePending(s)
                                }}
                              >
                                <IconTrash />
                              </IconButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {selectedSession ? (
                    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: 22, textAlign: 'left' }}>
                          Sesión {selectedSession.session_number}: {selectedSession.title}
                        </h3>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          {selectedSession.approval_status !== 'approved' ? (
                            <IconButton
                              label="Aprobar sesión"
                              textShort="Aprobar"
                              busy={sessionApproving}
                              busyLabel="Aprobando…"
                              busyShort="…"
                              disabled={sessionReopening || sessionSummarySaving || sessionDraftSaving}
                              className="btn-icon--inline"
                              onClick={() => void onApproveSession()}
                            >
                              <IconCheck />
                            </IconButton>
                          ) : (
                            <IconButton
                              label="Volver sesión a borrador"
                              textShort="Borrador"
                              busy={sessionReopening}
                              busyLabel="Reabriendo…"
                              busyShort="…"
                              disabled={sessionApproving || sessionSummarySaving || sessionDraftSaving}
                              className="btn-icon--inline"
                              onClick={() => void onReopenSession()}
                            >
                              <IconRotateCcw />
                            </IconButton>
                          )}
                          <IconButton
                            label="Cerrar detalle de sesión"
                            textShort="Cerrar"
                            disabled={!selectedSessionId}
                            className="btn-icon--inline"
                            onClick={() => setSelectedSessionId(null)}
                          >
                            <IconX />
                          </IconButton>
                        </div>
                      </div>
                      <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                        <div>
                          <div style={{ opacity: 0.75, fontSize: 12 }}>Aprobación</div>
                          <div>{toSpanishStatus(selectedSession.approval_status)}</div>
                        </div>
                        <div>
                          <div style={{ opacity: 0.75, fontSize: 12 }}>Resumen</div>
                          {selectedSession.approval_status === 'approved' ? (
                            <div>
                              {selectedSession.summary ? (
                                renderMarkdownLite(selectedSession.summary)
                              ) : (
                                <span style={{ opacity: 0.75 }}>(vacío)</span>
                              )}
                            </div>
                          ) : (
                            <>
                              <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>
                                Planificación de la sesión (Markdown). Pulsa «Guardar resumen» para persistirlo.
                              </div>
                              <textarea
                                rows={8}
                                value={sessionSummaryEditor}
                                onChange={(e) => setSessionSummaryEditor(e.target.value)}
                                style={{
                                  width: '100%',
                                  marginTop: 4,
                                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                  fontSize: 13,
                                }}
                                disabled={sessionSummarySaving}
                                placeholder="Resumen de la sesión en Markdown…"
                              />
                              <div style={{ marginTop: 8 }}>
                                <IconButton
                                  label="Guardar resumen de sesión"
                                  textShort="Guardar"
                                  busy={sessionSummarySaving}
                                  busyLabel="Guardando resumen…"
                                  busyShort="…"
                                  className="btn-icon--inline"
                                  onClick={() => void onSaveSessionSummary()}
                                >
                                  <IconSave />
                                </IconButton>
                              </div>
                            </>
                          )}
                        </div>
                        <div>
                          <div style={{ opacity: 0.75, fontSize: 12 }}>
                            {selectedSession.approval_status === 'approved' ? 'Contenido aprobado' : 'Contenido (borrador)'}
                          </div>
                          <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>
                            {selectedSession.approval_status === 'approved'
                              ? 'Solo lectura.'
                              : !(selectedSession.content_draft ?? '').trim()
                                ? 'Escribe el guion de la sesión aquí (Markdown) y guarda. Puedes apoyarte en el resumen de arriba.'
                                : 'Texto editable (como el resumen de campaña).'}
                          </div>
                          <div>{renderMarkdownLite(sessionDraftEditor)}</div>
                          {selectedSession.approval_status !== 'approved' ? (
                            <>
                              <textarea
                                rows={12}
                                value={sessionDraftEditor}
                                onChange={(e) => setSessionDraftEditor(e.target.value)}
                                style={{ width: '100%', marginTop: 8 }}
                                disabled={sessionDraftSaving}
                              />
                              <div style={{ marginTop: 8 }}>
                                <IconButton
                                  label="Guardar borrador del guion de sesión"
                                  textShort="Guardar"
                                  busy={sessionDraftSaving}
                                  busyLabel="Guardando guion…"
                                  busyShort="…"
                                  className="btn-icon--inline"
                                  onClick={() => void onSaveSessionDraft()}
                                >
                                  <IconSave />
                                </IconButton>
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ opacity: 0.8 }}>(Selecciona una sesión para ver el detalle)</div>
                  )}
                </div>
              )}
                </div>
              )}

              {detailTab === 'jugadores' && (
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12, marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <h3 style={{ marginTop: 0, fontSize: 24, textAlign: 'left' }}>Personajes jugadores</h3>
                <IconButton
                  label="Crear personajes jugadores con IA"
                  textShort="Jugadores"
                  busy={playersLoading}
                  busyLabel="Generando jugadores…"
                  busyShort="…"
                  disabled={campaign.brief_status !== 'approved'}
                  className="btn-icon--inline"
                  onClick={() => {
                    setPlayersError(null)
                    setCreatePlayersOpen(true)
                  }}
                >
                  <IconUsers />
                </IconButton>
              </div>
              {playersError && <div style={{ color: 'var(--danger)' }}>{playersError}</div>}
              {createPlayersOpen && (
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12, marginTop: 12 }}>
                  <h4 style={{ margin: '0 0 8px 0' }}>Crear personajes jugadores</h4>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <label style={{ display: 'grid', gap: 6 }}>
                      <span style={{ opacity: 0.75, fontSize: 12 }}>¿Cuántos jugadores crear? (1-8)</span>
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={createPlayersCount}
                        onChange={(e) => setCreatePlayersCount(Number(e.target.value))}
                        style={{
                          padding: 8,
                          borderRadius: 10,
                          border: '1px solid var(--border-subtle)',
                          background: 'rgba(0,0,0,0.25)',
                          color: 'inherit',
                          width: 140,
                        }}
                        disabled={playersLoading}
                      />
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <IconButton
                        label="Cancelar creación de jugadores"
                        textShort="Cancelar"
                        disabled={playersLoading}
                        className="btn-icon--inline"
                        onClick={() => setCreatePlayersOpen(false)}
                      >
                        <IconX />
                      </IconButton>
                      <IconButton
                        label="Crear y generar personajes jugadores"
                        textShort="Crear"
                        busy={playersLoading}
                        busyLabel="Creando jugadores…"
                        busyShort="…"
                        className="btn-icon--inline"
                        onClick={() => void onCreateAndGeneratePlayers()}
                      >
                        <IconSparkles />
                      </IconButton>
                    </div>
                  </div>
                </div>
              )}
              {derivedPlayers.length === 0 && !playersLoading && (
                <div>
                  Aún no hay personajes jugadores. Deben generarse aparte y no se derivan del mundo ni de los personajes implicados.
                </div>
              )}
              {derivedPlayers.length > 0 && (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: 'var(--table-header-bg)' }}>
                        <tr>
                          <th style={{ textAlign: 'left', padding: 10 }}>Jugador</th>
                          <th style={{ textAlign: 'left', padding: 10 }}>Resumen</th>
                          <th style={{ textAlign: 'left', padding: 10 }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {derivedPlayers.map((p, idx) => (
                          <tr
                            key={p.id}
                            style={{
                              borderTop: '1px solid var(--table-row-border)',
                              background: selectedPlayerIndex === idx ? 'var(--table-row-selected)' : undefined,
                              cursor: 'pointer',
                            }}
                            onClick={() => setSelectedPlayerIndex(idx)}
                          >
                            <td style={{ padding: 10 }}>
                              {p.name}
                            </td>
                            <td style={{ padding: 10 }}>{p.summary || <span style={{ opacity: 0.75 }}>(vacío)</span>}</td>
                            <td style={{ padding: 10 }}>
                              <IconButton
                                label={`Borrar personaje jugador ${p.name}`}
                                textShort="Borrar"
                                className="btn-icon--inline"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setPlayerDeletePending({ id: p.id, name: p.name })
                                }}
                              >
                                <IconTrash />
                              </IconButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {selectedPlayer ? (
                    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: 22, textAlign: 'left' }}>{selectedPlayer.name}</h3>
                        <div style={{ opacity: 0.75, fontSize: 12 }}>Vista de detalle</div>
                      </div>
                      <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                        <div>
                          <div style={{ opacity: 0.75, fontSize: 12 }}>Resumen del jugador</div>
                          <div>{selectedPlayer.summary || <span style={{ opacity: 0.75 }}>(vacío)</span>}</div>
                        </div>
                        <div>
                          <div style={{ opacity: 0.75, fontSize: 12 }}>Ficha básica</div>
                          <div
                            style={{
                              marginTop: 6,
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 10,
                              padding: 10,
                              background: 'var(--panel-highlight)',
                              fontSize: 14,
                              lineHeight: 1.45,
                              textAlign: 'left',
                            }}
                          >
                            {renderStructuredSheet(selectedPlayer.basicSheet)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ opacity: 0.8 }}>(Selecciona un jugador para ver el detalle)</div>
                  )}
                </div>
              )}
                </div>
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

