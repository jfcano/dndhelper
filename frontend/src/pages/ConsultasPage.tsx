import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import type { Campaign, QueryScope, RagRulesResponse } from '../lib/api'
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

export function ConsultasPage() {
  const [question, setQuestion] = useState('')
  const [scope, setScope] = useState<QueryScope>('rules')
  const [campaignId, setCampaignId] = useState<string>('')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RagRulesResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadingList(true)
    void api
      .listCampaigns(200, 0)
      .then((rows) => {
        if (!cancelled) setCampaigns(rows)
      })
      .catch(() => {
        if (!cancelled) setCampaigns([])
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const q = question.trim()
    if (!q) {
      setError('Escribe una pregunta.')
      return
    }
    if (scope === 'campaign' && !campaignId.trim()) {
      setError('Elige una campaña.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      setResult(
        await api.queryConsulta(q, {
          scope,
          campaign_id: scope === 'campaign' ? campaignId.trim() : undefined,
        }),
      )
    } catch (err) {
      setError(formatError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page rules-rag-page">
      <div className="page-head">
        <h2>Consultas</h2>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Haz preguntas en lenguaje natural. El modo «Reglas» usa el índice de manuales (PDF, TXT, DOCX). «Campañas en
        general» y «Una campaña concreta» usan el índice de referencias de campaña; en el modo campaña se incluye además
        todo el contenido guardado de esa campaña como contexto.
      </p>

      <form className="rag-query-form card-panel" onSubmit={onSubmit}>
        <label htmlFor="consulta-scope" className="muted" style={{ fontSize: '0.9rem' }}>
          Sobre qué quieres preguntar
        </label>
        <select
          id="consulta-scope"
          value={scope}
          onChange={(e) => setScope(e.target.value as QueryScope)}
          disabled={loading}
          style={{ marginBottom: '0.75rem', width: '100%', maxWidth: '28rem' }}
        >
          <option value="rules">Reglas (manuales indexados)</option>
          <option value="campaigns_general">Campañas en general</option>
          <option value="campaign">Una campaña concreta</option>
        </select>

        {scope === 'campaign' ? (
          <>
            <label htmlFor="consulta-campaign" className="muted" style={{ fontSize: '0.9rem' }}>
              Campaña
            </label>
            <select
              id="consulta-campaign"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              disabled={loading || loadingList}
              required={scope === 'campaign'}
              style={{ marginBottom: '0.75rem', width: '100%', maxWidth: '28rem' }}
            >
              <option value="">{loadingList ? 'Cargando…' : '— Elige una campaña —'}</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        ) : null}

        <label htmlFor="rag-question" className="muted" style={{ fontSize: '0.9rem' }}>
          Tu pregunta
        </label>
        <textarea
          id="rag-question"
          name="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ej.: ¿Qué sabe mi grupo del artefacto según el outline?"
          rows={4}
          disabled={loading}
          autoComplete="off"
        />
        <div className="btn-row">
          <button type="submit" disabled={loading || (scope === 'campaign' && (!campaignId || loadingList))}>
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
