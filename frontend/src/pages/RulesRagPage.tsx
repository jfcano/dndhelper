import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import type { RagRulesResponse } from '../lib/api'
import { formatError } from '../lib/errors'

function formatSourceLabel(s: { source: unknown; page: unknown }): string {
  const src = s.source
  const page = s.page
  const name =
    typeof src === 'string' && src.trim()
      ? src.split(/[/\\]/).pop() || src
      : src != null
        ? String(src)
        : '—'
  const p = page != null && page !== '' ? ` · pág. ${page}` : ''
  return `${name}${p}`
}

export function RulesRagPage() {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RagRulesResponse | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const q = question.trim()
    if (!q) {
      setError('Escribe una pregunta.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      setResult(await api.queryRules(q))
    } catch (err) {
      setError(formatError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page rules-rag-page">
      <div className="page-head">
        <h2>Consultas sobre reglas</h2>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Pregunta en lenguaje natural sobre el material indexado (PDFs de reglas o lore). La respuesta usa RAG en el
        backend; conviene tener documentos ingestados en la base de datos.
      </p>

      <form className="rag-query-form card-panel" onSubmit={onSubmit}>
        <label htmlFor="rag-question" className="muted" style={{ fontSize: '0.9rem' }}>
          Tu pregunta
        </label>
        <textarea
          id="rag-question"
          name="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ej.: ¿Qué es una tirada de salvación?"
          rows={4}
          disabled={loading}
          autoComplete="off"
        />
        <div className="btn-row">
          <button type="submit" disabled={loading}>
            {loading ? 'Consultando…' : 'Consultar'}
          </button>
        </div>
      </form>

      {error ? <div className="error-banner">{error}</div> : null}

      {result ? (
        <div className="card-panel" style={{ marginTop: '1rem' }}>
          <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--heading)', fontSize: '0.95rem', color: 'var(--gold)' }}>
            Respuesta
          </h3>
          <div className="rag-answer" style={{ whiteSpace: 'pre-wrap' }}>
            {result.answer}
          </div>
          {result.sources.length > 0 ? (
            <>
              <hr />
              <h4
                style={{
                  margin: '0 0 0.5rem',
                  fontFamily: 'var(--heading)',
                  fontSize: '0.75rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                }}
              >
                Fuentes citadas
              </h4>
              <ul className="rag-sources" style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {result.sources.map((s, i) => (
                  <li key={i} className="muted" style={{ marginBottom: '0.35rem' }}>
                    {formatSourceLabel(s)}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
