import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import type { OwnerSettingsStatus } from '../lib/api'
import { formatError } from '../lib/errors'

export function SettingsPage() {
  const [status, setStatus] = useState<OwnerSettingsStatus | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  async function onSave(e: FormEvent) {
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

  async function onClearStored() {
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

  return (
    <div className="page">
      <div className="page-head">
        <h2>Ajustes</h2>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        La clave de API de OpenAI se guarda en la base de datos asociada a tu identificador de propietario (
        <code>LOCAL_OWNER_UUID</code>
        ). Las funciones de IA (generación de campañas, mundos, imágenes, consultas RAG) la usan en cada petición.
        Si no hay clave guardada ni variable <code>OPENAI_API_KEY</code> en el servidor, verás un error pidiendo que la
        configures aquí.
      </p>

      {loading ? <p className="loading">Cargando…</p> : null}

      {status ? (
        <div className="card-panel" style={{ marginTop: '0.5rem' }}>
          <p style={{ marginTop: 0 }}>
            <strong>Clave en la aplicación:</strong>{' '}
            {status.has_stored_openai_key ? (
              <span style={{ color: 'var(--success)' }}>guardada</span>
            ) : (
              <span className="muted">no hay clave guardada</span>
            )}
          </p>
          <p>
            <strong>Respaldo en el servidor:</strong>{' '}
            {status.env_openai_key_configured ? (
              <span className="muted">el entorno define OPENAI_API_KEY (se usa si no guardas clave aquí)</span>
            ) : (
              <span className="muted">no configurado en el servidor</span>
            )}
          </p>
        </div>
      ) : null}

      {error ? <div className="error-banner">{error}</div> : null}

      <form className="card-panel rag-query-form" style={{ marginTop: '1rem' }} onSubmit={onSave}>
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
            <button type="button" disabled={saving} onClick={() => void onClearStored()}>
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
    </div>
  )
}
