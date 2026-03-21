import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { api, uploadRulesPdf, type IngestJobRow, type PdfEnqueueResponse } from '../lib/api'
import { formatError } from '../lib/errors'

function statusLabel(status: string): string {
  switch (status) {
    case 'queued':
      return 'En cola'
    case 'processing':
      return 'Procesando'
    case 'cancelled':
      return 'Cancelando…'
    case 'done':
      return 'Listo'
    case 'failed':
      return 'Error'
    default:
      return status
  }
}

function outcomeLabel(outcome: string | null): string {
  if (!outcome) return '—'
  switch (outcome) {
    case 'indexed':
      return 'Indexado'
    case 'unchanged':
      return 'Sin cambios'
    case 'empty':
      return 'Vacío'
    default:
      return outcome
  }
}

export function ManualsUploadPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enqueueInfo, setEnqueueInfo] = useState<PdfEnqueueResponse | null>(null)
  const [jobs, setJobs] = useState<IngestJobRow[]>([])
  const [jobsError, setJobsError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const refreshJobs = useCallback(async () => {
    try {
      const rows = await api.listRagIngestJobs(80)
      setJobs(rows)
      setJobsError(null)
    } catch (e) {
      setJobsError(formatError(e))
    }
  }, [])

  useEffect(() => {
    void refreshJobs()
  }, [refreshJobs])

  const hasActive = jobs.some(
    (j) => j.status === 'queued' || j.status === 'processing' || j.status === 'cancelled',
  )

  async function removeOrCancelJob(j: IngestJobRow) {
    const processing = j.status === 'processing'
    const cancelling = j.status === 'cancelled'
    const msg = processing || cancelling
      ? '¿Cancelar la indexación y quitar el PDF del servidor?'
      : '¿Eliminar este trabajo y el PDF subido?'
    if (!window.confirm(msg)) return
    setRemovingId(j.id)
    setJobsError(null)
    try {
      await api.deleteRagIngestJob(j.id)
      void refreshJobs()
    } catch (e) {
      setJobsError(formatError(e))
    } finally {
      setRemovingId(null)
    }
  }

  useEffect(() => {
    if (!hasActive) return
    const t = window.setInterval(() => {
      void refreshJobs()
    }, 3000)
    return () => window.clearInterval(t)
  }, [hasActive, refreshJobs])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const input = inputRef.current
    const file = input?.files?.[0]
    if (!file) {
      setError('Selecciona un archivo PDF.')
      setEnqueueInfo(null)
      return
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Solo se admiten archivos .pdf.')
      setEnqueueInfo(null)
      return
    }
    setBusy(true)
    setError(null)
    setEnqueueInfo(null)
    try {
      setEnqueueInfo(await uploadRulesPdf(file))
      if (input) input.value = ''
      void refreshJobs()
    } catch (err) {
      setError(formatError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>Manuales (RAG)</h2>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        Sube PDFs de reglas, compendios o lore para ampliar el índice vectorial. Los ficheros se guardan bajo{' '}
        <code>backend/data/uploads/&lt;tu propietario&gt;/</code> y la indexación se hace en segundo plano (worker).
        Requiere clave de OpenAI (Ajustes o entorno). El progreso aparece en la tabla inferior.
      </p>

      <form className="card-panel rag-query-form" onSubmit={onSubmit}>
        <label htmlFor="manual-pdf" className="muted" style={{ fontSize: '0.9rem' }}>
          Archivo PDF
        </label>
        <input
          ref={inputRef}
          id="manual-pdf"
          name="file"
          type="file"
          accept=".pdf,application/pdf"
          disabled={busy}
        />
        <div className="btn-row">
          <button type="submit" disabled={busy}>
            {busy ? 'Subiendo…' : 'Subir y encolar'}
          </button>
        </div>
      </form>

      {error ? <div className="error-banner">{error}</div> : null}

      {enqueueInfo ? (
        <div className="success-banner" style={{ marginTop: '1rem' }}>
          <strong>Encolado</strong>
          <div style={{ marginTop: '0.35rem' }}>{enqueueInfo.message}</div>
          <div className="muted" style={{ marginTop: '0.5rem', fontSize: '0.88rem' }}>
            Trabajo: <code>{enqueueInfo.job_id}</code> · Archivo: <code>{enqueueInfo.original_filename}</code>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: '1.75rem' }}>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '1.05rem' }}>Historial de subidas e indexación</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: '0.9rem' }}>
          Porcentaje aproximado según fase (lectura, fragmentación, embeddings). Con Docker, el servicio{' '}
          <code>ingest-worker</code> debe estar en marcha.
        </p>
        {jobsError ? <div className="error-banner">{jobsError}</div> : null}
        <div className="table-shell" style={{ marginTop: '0.75rem', overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.65rem' }}>Archivo</th>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.65rem' }}>Estado</th>
                <th style={{ textAlign: 'right', padding: '0.5rem 0.65rem' }}>%</th>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.65rem' }}>Detalle</th>
                <th style={{ textAlign: 'right', padding: '0.5rem 0.65rem' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted" style={{ padding: '0.75rem 0.65rem' }}>
                    Aún no hay trabajos. Sube un PDF para verlo aquí.
                  </td>
                </tr>
              ) : (
                jobs.map((j) => (
                  <tr key={j.id}>
                    <td style={{ padding: '0.5rem 0.65rem', verticalAlign: 'top' }}>
                      <code style={{ fontSize: '0.85rem' }}>{j.original_filename}</code>
                    </td>
                    <td style={{ padding: '0.5rem 0.65rem', verticalAlign: 'top' }}>
                      {statusLabel(j.status)}
                      {j.status === 'done' && j.outcome ? (
                        <span className="muted" style={{ display: 'block', fontSize: '0.82rem', marginTop: '0.2rem' }}>
                          {outcomeLabel(j.outcome)}
                        </span>
                      ) : null}
                    </td>
                    <td style={{ padding: '0.5rem 0.65rem', verticalAlign: 'top', textAlign: 'right' }}>
                      {j.progress_percent}%
                    </td>
                    <td style={{ padding: '0.5rem 0.65rem', verticalAlign: 'top', fontSize: '0.88rem' }}>
                      {j.status === 'failed' && j.error_detail ? (
                        <span style={{ color: 'var(--danger, #c44)' }}>{j.error_detail}</span>
                      ) : (
                        <>
                          {j.phase_label ? <div>{j.phase_label}</div> : null}
                          {j.message ? (
                            <div className="muted" style={{ marginTop: j.phase_label ? '0.25rem' : 0 }}>
                              {j.message}
                            </div>
                          ) : null}
                          {j.pdf_sha256 && j.status === 'done' ? (
                            <div className="muted" style={{ marginTop: '0.25rem', fontSize: '0.8rem' }}>
                              SHA-256: {j.pdf_sha256.slice(0, 16)}…
                              {typeof j.chunks_indexed === 'number' && j.chunks_indexed > 0
                                ? ` · ${j.chunks_indexed} fragmentos`
                                : null}
                            </div>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td style={{ padding: '0.5rem 0.65rem', verticalAlign: 'top', textAlign: 'right' }}>
                      <button
                        type="button"
                        disabled={removingId === j.id}
                        onClick={() => void removeOrCancelJob(j)}
                        style={{
                          fontSize: '0.82rem',
                          padding: '0.25rem 0.5rem',
                          opacity: removingId === j.id ? 0.6 : 1,
                        }}
                        title={
                          j.status === 'processing' || j.status === 'cancelled'
                            ? 'Cancelar indexación y borrar PDF'
                            : 'Borrar trabajo y PDF'
                        }
                      >
                        {j.status === 'processing' || j.status === 'cancelled'
                          ? removingId === j.id
                            ? 'Cancelando…'
                            : 'Cancelar'
                          : removingId === j.id
                            ? 'Borrando…'
                            : 'Eliminar'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
