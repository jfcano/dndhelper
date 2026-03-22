import type { Campaign, Session } from '../../lib/api'
import { IconButton } from '../../components/IconButton'
import { IconCheck, IconRotateCcw, IconSave, IconSparkles, IconTrash, IconX } from '../../components/icons'
import { toSpanishStatus } from '../../lib/statusLabels'
import { renderMarkdownLite } from './markdownLite'

export type CampaignSesionesTabProps = {
  campaign: Campaign
  sessions: Session[] | null
  sessionsLoading: boolean
  sessionsError: string | null
  createSessionsOpen: boolean
  setCreateSessionsOpen: (v: boolean) => void
  createSessionsCount: number
  setCreateSessionsCount: (v: number) => void
  createSessionsLoading: boolean
  createSessionsError: string | null
  setCreateSessionsError: (v: string | null) => void
  selectedSessionId: string | null
  setSelectedSessionId: (v: string | null) => void
  selectedSession: Session | null
  sessionSummaryEditor: string
  setSessionSummaryEditor: (v: string) => void
  sessionDraftEditor: string
  setSessionDraftEditor: (v: string) => void
  sessionSummarySaving: boolean
  sessionDraftSaving: boolean
  sessionDeleteLoadingId: string | null
  sessionApproving: boolean
  sessionReopening: boolean
  onCreateAndGenerateSessions: () => void | Promise<void>
  onApproveSession: () => void | Promise<void>
  onReopenSession: () => void | Promise<void>
  onSaveSessionSummary: () => void | Promise<void>
  onSaveSessionDraft: () => void | Promise<void>
  setSessionDeletePending: (s: Session | null) => void
}

export function CampaignSesionesTab(props: CampaignSesionesTabProps) {
  const {
    campaign,
    sessions,
    sessionsLoading,
    sessionsError,
    createSessionsOpen,
    setCreateSessionsOpen,
    createSessionsCount,
    setCreateSessionsCount,
    createSessionsLoading,
    createSessionsError,
    setCreateSessionsError,
    selectedSessionId,
    setSelectedSessionId,
    selectedSession,
    sessionSummaryEditor,
    setSessionSummaryEditor,
    sessionDraftEditor,
    setSessionDraftEditor,
    sessionSummarySaving,
    sessionDraftSaving,
    sessionDeleteLoadingId,
    sessionApproving,
    sessionReopening,
    onCreateAndGenerateSessions,
    onApproveSession,
    onReopenSession,
    onSaveSessionSummary,
    onSaveSessionDraft,
    setSessionDeletePending,
  } = props

  return (
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
              sessionsLoading || campaign.brief_status !== 'approved' || (campaign.outline_status || '').toLowerCase() !== 'approved'
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
      {sessionsError && <div style={{ color: 'var(--danger)', whiteSpace: 'pre-wrap' }}>{sessionsError}</div>}
      {createSessionsError && <div style={{ color: 'var(--danger)', marginTop: 8 }}>{createSessionsError}</div>}
      {campaign.brief_status === 'approved' && (campaign.outline_status || '').toLowerCase() !== 'approved' && (
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
  )
}
