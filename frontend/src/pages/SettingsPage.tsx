import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ConfirmCascadeDeleteDialog } from '../components/ConfirmCascadeDeleteDialog'
import { api } from '../lib/api'
import type { OwnerSettingsStatus, RagClearResponse, RagClearTarget } from '../lib/api'
import { formatError } from '../lib/errors'

function ragClearDialogCopy(targets: RagClearTarget[]) {
  const hasM = targets.includes('manuals')
  const hasC = targets.includes('campaign')
  if (hasM && hasC) {
    return {
      title: 'Vaciar ambas colecciones RAG',
      description:
        'Se borrarán por completo los dos índices vectoriales de tu cuenta: manuales/reglas y referencias de campaña. ' +
        'Hasta que vuelvas a subir documentos y a indexarlos, las consultas RAG no tendrán contexto de reglas ni de campaña.',
      confirmLabel: 'Sí, vaciar ambas colecciones',
    }
  }
  if (hasM) {
    return {
      title: 'Vaciar colección de manuales y reglas (RAG)',
      description:
        'Se eliminará el índice semántico usado para consultas sobre reglas y manuales. ' +
        'Las campañas y el resto de datos en tablas no se borran, pero no podrás basar respuestas en esos PDF/textos hasta reindexar.',
      confirmLabel: 'Sí, vaciar manuales / reglas',
    }
  }
  return {
    title: 'Vaciar colección de referencias de campaña (RAG)',
    description:
      'Se eliminará el índice de textos de referencia de campaña (brief, notas sincronizadas, etc.). ' +
      'Las campañas y sesiones en la base de datos siguen existiendo; solo se pierde el índice para consultas RAG sobre ese contenido hasta que se vuelva a indexar.',
    confirmLabel: 'Sí, vaciar referencias de campaña',
  }
}

const RAG_CLEAR_DETAILS = [
  'Vectores (embeddings) en la base de datos para la colección elegida.',
  'Trabajos de ingesta y entradas de cola en la página «Documentos» para ese destino.',
  'Ficheros subidos (PDF, TXT, DOCX) en la carpeta de uploads del servidor asociada a esos trabajos.',
  'Manifiestos locales de ingesta y, si aplica, metadatos de reindexado de campañas vinculados a esas colecciones.',
] as const

export function SettingsPage() {
  const [status, setStatus] = useState<OwnerSettingsStatus | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [hfInput, setHfInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ragClearBusy, setRagClearBusy] = useState(false)
  const [ragClearResult, setRagClearResult] = useState<RagClearResponse | null>(null)
  const [ragClearError, setRagClearError] = useState<string | null>(null)
  const [ragClearDialogTargets, setRagClearDialogTargets] = useState<RagClearTarget[] | null>(null)

  const ragClearDialogMeta = useMemo(
    () => (ragClearDialogTargets ? ragClearDialogCopy(ragClearDialogTargets) : null),
    [ragClearDialogTargets],
  )

  async function load() {
    setError(null)
    setLoading(true)
    try {
      setStatus(await api.getOwnerSettings())
    } catch (e) {
      setError(formatError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function onSaveOpenai(e: FormEvent) {
    e.preventDefault()
    const k = keyInput.trim()
    if (k.length < 8) {
      setError('La clave debe tener al menos 8 caracteres.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      setStatus(await api.putOwnerOpenaiKey(k))
      setKeyInput('')
    } catch (err) {
      setError(formatError(err))
    } finally {
      setSaving(false)
    }
  }

  async function onClearOpenai() {
    setSaving(true)
    setError(null)
    try {
      setStatus(await api.deleteOwnerOpenaiKey())
    } catch (err) {
      setError(formatError(err))
    } finally {
      setSaving(false)
    }
  }

  async function onSaveHf(e: FormEvent) {
    e.preventDefault()
    const t = hfInput.trim()
    if (t.length < 4) {
      setError('El token de Hugging Face debe tener al menos 4 caracteres.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      setStatus(await api.putOwnerHfToken(t))
      setHfInput('')
    } catch (err) {
      setError(formatError(err))
    } finally {
      setSaving(false)
    }
  }

  async function onClearHf() {
    setSaving(true)
    setError(null)
    try {
      setStatus(await api.deleteOwnerHfToken())
    } catch (err) {
      setError(formatError(err))
    } finally {
      setSaving(false)
    }
  }

  async function confirmClearRag() {
    if (!ragClearDialogTargets) return
    const targets = ragClearDialogTargets
    setRagClearBusy(true)
    setRagClearError(null)
    setRagClearResult(null)
    try {
      setRagClearResult(await api.clearRagCollections(targets))
      setRagClearDialogTargets(null)
    } catch (e) {
      setRagClearError(formatError(e))
    } finally {
      setRagClearBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>Ajustes</h2>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        Las claves de <strong>OpenAI</strong> y <strong>Hugging Face</strong> se guardan en la base de datos asociadas a
        tu cuenta. Las rutas de IA (chat, embeddings, imágenes, RAG) requieren una clave OpenAI guardada aquí; sin ella
        verás un error pidiendo que la configures.
      </p>

      {loading ? <p className="loading">Cargando…</p> : null}

      {status ? (
        <div className="card-panel" style={{ marginTop: '0.5rem' }}>
          <p style={{ marginTop: 0 }}>
            <strong>Clave OpenAI en la aplicación:</strong>{' '}
            {status.has_stored_openai_key ? (
              <span style={{ color: 'var(--success)' }}>guardada</span>
            ) : (
              <span className="muted">no hay clave guardada</span>
            )}
          </p>
          <p style={{ marginBottom: 0 }}>
            <strong>Token Hugging Face en la aplicación:</strong>{' '}
            {status.has_stored_hf_token ? (
              <span style={{ color: 'var(--success)' }}>guardado</span>
            ) : (
              <span className="muted">no hay token guardado</span>
            )}
          </p>
        </div>
      ) : null}

      {error ? <div className="error-banner">{error}</div> : null}

      <form className="card-panel rag-query-form" style={{ marginTop: '1rem' }} onSubmit={onSaveOpenai}>
        <h3 className="muted" style={{ marginTop: 0, fontSize: '1rem' }}>
          OpenAI
        </h3>
        <label htmlFor="openai-key" className="muted" style={{ fontSize: '0.9rem' }}>
          Nueva clave de API de OpenAI
        </label>
        <input
          id="openai-key"
          name="openai_api_key"
          type="password"
          autoComplete="off"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder="sk-…"
          disabled={saving}
        />
        <div className="btn-row">
          <button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar clave'}
          </button>
          {status?.has_stored_openai_key ? (
            <button type="button" disabled={saving} onClick={() => void onClearOpenai()}>
              Quitar clave guardada
            </button>
          ) : null}
        </div>
      </form>

      <p className="muted" style={{ fontSize: '0.9rem' }}>
        Obtén una clave en{' '}
        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
          platform.openai.com/api-keys
        </a>
        . No compartas la clave ni la subas a repositorios públicos.
      </p>

      <form className="card-panel rag-query-form" style={{ marginTop: '1rem' }} onSubmit={onSaveHf}>
        <h3 className="muted" style={{ marginTop: 0, fontSize: '1rem' }}>
          Hugging Face
        </h3>
        <p className="muted" style={{ marginTop: 0, fontSize: '0.9rem' }}>
          Opcional: token del Hub para descargas de modelos (p. ej. sentence-transformers) sin límites tan estrictos.
        </p>
        <label htmlFor="hf-token" className="muted" style={{ fontSize: '0.9rem' }}>
          Nuevo token
        </label>
        <input
          id="hf-token"
          name="hf_token"
          type="password"
          autoComplete="off"
          value={hfInput}
          onChange={(e) => setHfInput(e.target.value)}
          placeholder="hf_…"
          disabled={saving}
        />
        <div className="btn-row">
          <button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar token'}
          </button>
          {status?.has_stored_hf_token ? (
            <button type="button" disabled={saving} onClick={() => void onClearHf()}>
              Quitar token guardado
            </button>
          ) : null}
        </div>
      </form>

      <p className="muted" style={{ fontSize: '0.9rem' }}>
        Crea un token en{' '}
        <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer">
          huggingface.co/settings/tokens
        </a>
        .
      </p>

      {ragClearDialogMeta && ragClearDialogTargets ? (
        <ConfirmCascadeDeleteDialog
          open
          onClose={() => {
            if (!ragClearBusy) setRagClearDialogTargets(null)
          }}
          title={ragClearDialogMeta.title}
          description={ragClearDialogMeta.description}
          details={[...RAG_CLEAR_DETAILS]}
          detailsSectionTitle="Se eliminará permanentemente del servidor:"
          confirmLabel={ragClearDialogMeta.confirmLabel}
          cancelLabel="Cancelar"
          busy={ragClearBusy}
          busyLabel="Vaciando índices…"
          size="large"
          highRisk
          onConfirm={() => void confirmClearRag()}
        />
      ) : null}

      <div
        className="card-panel rag-query-form"
        style={{ marginTop: '1.75rem', borderColor: 'var(--danger-border)' }}
      >
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: 'var(--danger)' }}>
          Limpiar índices RAG
        </h3>
        <p className="muted" style={{ marginTop: 0, fontSize: '0.9rem' }}>
          Elimina por completo la colección vectorial elegida en la base de datos, borra los trabajos de ingesta
          vinculados y los documentos subidos en disco, y resetea los manifiestos de ingesta / reindexado de campañas.
          No afecta a campañas, mundos ni sesiones en tablas SQL (solo al índice semántico y ficheros de subida). La
          cola de trabajos en <strong>Documentos</strong> se vaciará para los destinos que borres.
        </p>
        <div className="btn-row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            type="button"
            disabled={ragClearBusy || saving}
            onClick={() => setRagClearDialogTargets(['manuals'])}
          >
            Vaciar manuales / reglas
          </button>
          <button
            type="button"
            disabled={ragClearBusy || saving}
            onClick={() => setRagClearDialogTargets(['campaign'])}
          >
            Vaciar referencias de campaña
          </button>
          <button
            type="button"
            disabled={ragClearBusy || saving}
            onClick={() => setRagClearDialogTargets(['manuals', 'campaign'])}
          >
            Vaciar ambas colecciones
          </button>
        </div>
        {ragClearError ? <div className="error-banner" style={{ marginTop: '0.75rem' }}>{ragClearError}</div> : null}
        {ragClearResult ? (
          <div className="success-banner" style={{ marginTop: '0.75rem', fontSize: '0.88rem' }}>
            <strong>Listo.</strong> Objetivos: {ragClearResult.targets_cleared.join(', ')}. Trabajos eliminados:{' '}
            {ragClearResult.ingest_jobs_removed}. Claves de manifiesto (ingesta):{' '}
            {ragClearResult.manifest_ingest_keys_removed}. Entradas manifiesto campañas:{' '}
            {ragClearResult.campaign_manifest_entries_removed}.
          </div>
        ) : null}
      </div>
    </div>
  )
}
