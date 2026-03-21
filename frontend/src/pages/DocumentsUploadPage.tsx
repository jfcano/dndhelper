import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { api, uploadDocuments, type IngestJobRow, type RagUploadTarget, type UploadRagBatchResponse } from '../lib/api'
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

function collectionKindLabel(collectionName: string | null): string {
  if (!collectionName) return '—'
  if (collectionName.endsWith('_campaign')) return 'Referencias de campaña'
  if (collectionName.endsWith('_manuals')) return 'Manuales / reglas'
  return collectionName
}

export function DocumentsUploadPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [ragTarget, setRagTarget] = useState<RagUploadTarget>('manuals')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [batchResult, setBatchResult] = useState<UploadRagBatchResponse | null>(null)
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
    const msg =
      processing || cancelling
        ? '¿Cancelar la indexación y quitar el fichero del servidor?'
        : '¿Eliminar este trabajo y el fichero subido?'
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
    const list = input?.files
    if (!list || list.length === 0) {
      setError('Selecciona uno o más archivos (.pdf, .txt o .docx).')
      setBatchResult(null)
      return
    }
    const arr = Array.from(list)
    const bad = arr.filter((f) => {
      const n = f.name.toLowerCase()
      return !n.endsWith('.pdf') && !n.endsWith('.txt') && !n.endsWith('.docx')
    })
    if (bad.length > 0) {
      setError('Solo se admiten archivos .pdf, .txt o .docx.')
      setBatchResult(null)
      return
    }
    setBusy(true)
    setError(null)
    setBatchResult(null)
    try {
      setBatchResult(await uploadDocuments(arr, { ragTarget }))
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
        <h2>Documentos (RAG)</h2>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        Sube PDF, TXT o DOCX para ampliar el índice vectorial. Elige si van a la colección de{' '}
        <strong>manuales y reglas</strong> (consultas en modo Reglas, fichas, etc.) o a{' '}
        <strong>referencias de campaña</strong> (material para consultas sobre campañas y generación asociada).
        Puedes elegir <strong>varios archivos a la vez</strong>. Los ficheros se guardan bajo{' '}
        <code>backend/data/uploads/&lt;tu usuario&gt;/</code> y la indexación se hace en segundo plano (worker).
        Requiere clave de OpenAI en Ajustes. El progreso aparece en la tabla inferior.
      </p>

      <form className="card-panel rag-query-form" onSubmit={onSubmit}>
        <label htmlFor="rag-target-docs" className="muted" style={{ fontSize: '0.9rem' }}>
          Colección de destino
        </label>
        <select
          id="rag-target-docs"
          value={ragTarget}
          onChange={(e) => setRagTarget(e.target.value as RagUploadTarget)}
          disabled={busy}
          style={{ marginBottom: '0.75rem', width: '100%', maxWidth: '28rem' }}
        >
          <option value="manuals">Manuales y reglas</option>
          <option value="campaign">Referencias de campaña</option>
        </select>

        <label htmlFor="doc-files" className="muted" style={{ fontSize: '0.9rem' }}>
          Archivos (.pdf, .txt, .docx)
        </label>
        <input
          ref={inputRef}
          id="doc-files"
          name="files"
          type="file"
          accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          disabled={busy}
        />
        <div className="btn-row">
          <button type="submit" disabled={busy}>
            {busy ? 'Subiendo…' : 'Subir y encolar'}
          </button>
        </div>
      </form>

      {error ? <div className="error-banner">{error}</div> : null}

      {batchResult ? (
        <div style={{ marginTop: '1rem' }}>
          {batchResult.queued.length > 0 ? (
            <div className="success-banner">
              <strong>
                {batchResult.queued.length === 1
                  ? '1 documento encolado'
                  : `${batchResult.queued.length} documentos encolados`}
              </strong>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', fontSize: '0.88rem' }}>
                {batchResult.queued.map((q) => (
                  <li key={q.job_id}>
                    <code>{q.original_filename}</code> — trabajo <code>{q.job_id}</code>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {batchResult.errors.length > 0 ? (
            <div className="error-banner" style={{ marginTop: batchResult.queued.length > 0 ? '0.75rem' : 0 }}>
              <strong>No se han subido algunos archivos</strong>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', fontSize: '0.88rem' }}>
                {batchResult.errors.map((e, i) => (
                  <li key={`${e.filename}-${i}`}>
                    <code>{e.filename}</code>: {e.detail}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
                <th style={{ textAlign: 'left', padding: '0.5rem 0.65rem' }}>Colección</th>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.65rem' }}>Estado</th>
                <th style={{ textAlign: 'right', padding: '0.5rem 0.65rem' }}>%</th>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.65rem' }}>Detalle</th>
                <th style={{ textAlign: 'right', padding: '0.5rem 0.65rem' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted" style={{ padding: '0.75rem 0.65rem' }}>
                    Aún no hay trabajos. Sube documentos para verlos aquí.
                  </td>
                </tr>
              ) : (
                jobs.map((j) => (
                  <tr key={j.id}>
                    <td style={{ padding: '0.5rem 0.65rem', verticalAlign: 'top' }}>
                      <code style={{ fontSize: '0.85rem' }}>{j.original_filename}</code>
                    </td>
                    <td style={{ padding: '0.5rem 0.65rem', verticalAlign: 'top', fontSize: '0.88rem' }}>
                      {collectionKindLabel(j.collection_name)}
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
                            ? 'Cancelar indexación y borrar fichero'
                            : 'Borrar trabajo y fichero'
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
