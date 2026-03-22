import type { Dispatch, SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import type { Campaign, CampaignWizardDraft, World } from '../../lib/api'
import { IconButton } from '../../components/IconButton'
import {
  IconChevronLeft,
  IconChevronRight,
  IconLink,
  IconMinus,
  IconPlus,
  IconRotateCcw,
  IconSave,
  IconSparkles,
} from '../../components/icons'
import { toSpanishStatus } from '../../lib/statusLabels'

export type CampaignWizardRemovePayload = {
  kind: 'theme' | 'inspiration'
  index: number
  label: string
}

export type CampaignBriefAssistantPanelProps = {
  campaign: Campaign
  worlds: World[] | null
  worldOptions: World[]
  worldId: string
  setWorldId: (v: string) => void
  useExistingWorld: boolean | null
  wizard: CampaignWizardDraft
  setWizard: Dispatch<SetStateAction<CampaignWizardDraft>>
  step: number
  setStep: (step: number) => void
  visibleSteps: number[]
  stepPos: number
  canGoPrev: boolean
  canGoNext: boolean
  firstVisibleStep: number
  currentVisibleIndex: number
  autogeneratingStep: number | null
  saving: boolean
  canContinueFromCurrentStep: () => boolean
  getConstraintNotes: () => string
  setConstraintNotes: (notes: string) => void
  onLinkWorld: () => void | Promise<void>
  onAutogenerateStep: (targetStep: 0 | 1 | 2 | 3) => void | Promise<void>
  onSaveBriefDraft: () => void | Promise<void>
  onResetWizard: () => void | Promise<void>
  setCampaignWizardRemovePending: (v: CampaignWizardRemovePayload | null) => void
}

export function CampaignBriefAssistantPanel(props: CampaignBriefAssistantPanelProps) {
  const {
    campaign,
    worlds,
    worldOptions,
    worldId,
    setWorldId,
    useExistingWorld,
    wizard,
    setWizard,
    step,
    setStep,
    visibleSteps,
    stepPos,
    canGoPrev,
    canGoNext,
    firstVisibleStep,
    currentVisibleIndex,
    autogeneratingStep,
    saving,
    canContinueFromCurrentStep,
    getConstraintNotes,
    setConstraintNotes,
    onLinkWorld,
    onAutogenerateStep,
    onSaveBriefDraft,
    onResetWizard,
    setCampaignWizardRemovePending,
  } = props

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 24, textAlign: 'left' }}>Asistente de resumen inicial</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <small style={{ opacity: 0.8 }}>
            Paso {stepPos} de {visibleSteps.length}
          </small>
        </div>
      </div>

      {step === 0 && (
        <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ opacity: 0.8, fontSize: 13 }}>Mundo para la campaña</div>
            <div style={{ opacity: 0.65, fontSize: 12 }}>
              Solo aparecen mundos <strong>aprobados</strong> (el resto sigue en Mundos hasta aprobar el contenido).
            </div>
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
                {worldOptions.length === 0 ? (
                  <div style={{ opacity: 0.85, fontSize: 13 }}>
                    No hay mundos aprobados. Crea uno en <Link to="/worlds">Mundos</Link>, rellena el contenido y pulsa
                    aprobar.
                  </div>
                ) : null}
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

      <div style={{ marginTop: 10, opacity: 0.8 }}>Estado: {toSpanishStatus(campaign.brief_status)}</div>
    </div>
  )
}
