import { useMemo } from 'react'
import type { Campaign, World } from '../../lib/api'
import { IconButton } from '../../components/IconButton'
import { IconCheck, IconRotateCcw, IconSave, IconSparkles } from '../../components/icons'
import { toSpanishStatus } from '../../lib/statusLabels'
import { renderMarkdownLite } from './markdownLite'

export type CampaignHistoriaTabProps = {
  campaign: Campaign
  linkedWorld: World | null
  worldReadyForOutline: boolean
  worldId: string
  storyEditorText: string
  setStoryEditorText: (v: string) => void
  storySaving: boolean
  saving: boolean
  reopening: boolean
  outlineEditorText: string
  setOutlineEditorText: (v: string) => void
  setOutlineDirty: (v: boolean) => void
  outlineGenerating: boolean
  outlineSaving: boolean
  outlineApproving: boolean
  onSaveStoryDraft: () => void | Promise<void>
  onApproveBrief: () => void | Promise<void>
  onResetWizard: () => void | Promise<void>
  onReopenCampaign: () => void | Promise<void>
  onGenerateOutline: () => void | Promise<void>
  onSaveOutlineDraft: () => void | Promise<void>
  onApproveOutline: () => void | Promise<void>
}

export function CampaignHistoriaTab(props: CampaignHistoriaTabProps) {
  const {
    campaign,
    linkedWorld,
    worldReadyForOutline,
    worldId,
    storyEditorText,
    setStoryEditorText,
    storySaving,
    saving,
    reopening,
    outlineEditorText,
    setOutlineEditorText,
    setOutlineDirty,
    outlineGenerating,
    outlineSaving,
    outlineApproving,
    onSaveStoryDraft,
    onApproveBrief,
    onResetWizard,
    onReopenCampaign,
    onGenerateOutline,
    onSaveOutlineDraft,
    onApproveOutline,
  } = props

  const storyPreviewRendered = useMemo(() => renderMarkdownLite(storyEditorText), [storyEditorText])
  const storyFinalRendered = useMemo(() => renderMarkdownLite(campaign.story_final ?? ''), [campaign.story_final])

  return (
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
                <textarea rows={12} value={storyEditorText} onChange={(e) => setStoryEditorText(e.target.value)} style={{ width: '100%' }} />
              </div>
            </div>
          )}
        </>
      ) : (
        <>
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

          <div
            style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: 12,
              marginTop: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 22, textAlign: 'left' }}>Outline de campaña</h3>
              <div style={{ fontSize: 13, opacity: 0.85 }}>{toSpanishStatus(campaign.outline_status)}</div>
            </div>
            <p style={{ margin: '10px 0 0', opacity: 0.85, fontSize: 13, lineHeight: 1.5 }}>
              El outline estructura el arco narrativo. Es obligatorio <strong>generarlo</strong> (o pegar JSON válido),{' '}
              <strong>guardarlo</strong> y <strong>aprobarlo</strong> antes de poder crear sesiones. La API exige un{' '}
              <strong>mundo vinculado aprobado</strong> con <strong>contenido final</strong> para generarlo con IA.
            </p>
            {!campaign.world_id ? (
              <div style={{ marginTop: 10, opacity: 0.85, fontSize: 13 }}>
                Vincula un mundo a esta campaña para poder generar el outline.
              </div>
            ) : !worldReadyForOutline ? (
              <div style={{ marginTop: 10, opacity: 0.85, fontSize: 13 }}>
                El mundo «{linkedWorld?.name ?? campaign.world_id}» debe estar <strong>aprobado</strong> y tener{' '}
                <strong>contenido final</strong>. Ábrelo en Mundos y aprueba el texto antes de generar el outline.
              </div>
            ) : null}

            {campaign.outline_status !== 'approved' ? (
              <>
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <IconButton
                    label="Generar outline con IA"
                    textShort="Generar"
                    busy={outlineGenerating}
                    busyLabel="Generando outline…"
                    busyShort="…"
                    disabled={
                      saving || outlineSaving || outlineApproving || !worldReadyForOutline || campaign.outline_status === 'approved'
                    }
                    className="btn-icon--inline"
                    onClick={() => void onGenerateOutline()}
                  >
                    <IconSparkles />
                  </IconButton>
                  <IconButton
                    label="Guardar borrador del outline (JSON)"
                    textShort="Guardar"
                    busy={outlineSaving}
                    busyLabel="Guardando…"
                    busyShort="…"
                    disabled={saving || outlineGenerating || outlineApproving || !outlineEditorText.trim()}
                    className="btn-icon--inline"
                    onClick={() => void onSaveOutlineDraft()}
                  >
                    <IconSave />
                  </IconButton>
                  <IconButton
                    label="Aprobar outline"
                    textShort="Aprobar"
                    busy={outlineApproving}
                    busyLabel="Aprobando…"
                    busyShort="…"
                    disabled={saving || outlineGenerating || outlineSaving || !campaign.outline_draft?.trim()}
                    className="btn-icon--inline"
                    onClick={() => void onApproveOutline()}
                  >
                    <IconCheck />
                  </IconButton>
                </div>
                <label style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                  <span style={{ opacity: 0.75, fontSize: 12 }}>Borrador (JSON editable)</span>
                  <textarea
                    rows={14}
                    value={outlineEditorText}
                    onChange={(e) => {
                      setOutlineEditorText(e.target.value)
                      setOutlineDirty(true)
                    }}
                    spellCheck={false}
                    style={{
                      width: '100%',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: 12,
                      padding: 10,
                      borderRadius: 10,
                      border: '1px solid var(--border-subtle)',
                      background: 'rgba(0,0,0,0.25)',
                      color: 'inherit',
                    }}
                    disabled={outlineGenerating || outlineSaving || outlineApproving}
                  />
                </label>
              </>
            ) : (
              <pre
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid var(--border-subtle)',
                  background: 'rgba(0,0,0,0.2)',
                  fontSize: 12,
                  overflow: 'auto',
                  maxHeight: 360,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {outlineEditorText || '(vacío)'}
              </pre>
            )}
          </div>
        </>
      )}
    </>
  )
}
