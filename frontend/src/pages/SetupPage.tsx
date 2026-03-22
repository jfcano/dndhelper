import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { formatError } from '../lib/errors'

export function SetupPage() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)
  const [setupAvailable, setSetupAvailable] = useState(false)

  const [masterPassword, setMasterPassword] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const s = await api.getSetupStatus()
        if (!cancelled) {
          setNeedsSetup(s.needs_setup)
          setSetupAvailable(s.setup_available)
        }
      } catch {
        if (!cancelled) {
          setNeedsSetup(null)
        }
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.setupBootstrap(masterPassword, username, password)
      navigate('/login', { replace: true })
    } catch (err) {
      setError(formatError(err))
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="page" style={{ maxWidth: '22rem', margin: '2rem auto' }}>
        <p className="muted">Comprobando instalación…</p>
      </div>
    )
  }

  if (needsSetup === false) {
    return <Navigate to="/login" replace />
  }

  if (needsSetup === null) {
    return (
      <div className="page" style={{ maxWidth: '22rem', margin: '2rem auto' }}>
        <h2 style={{ marginTop: 0 }}>Instalación</h2>
        <p className="muted">No se pudo contactar con el servidor para el estado de instalación.</p>
        <p>
          <Link to="/login">Ir al inicio de sesión</Link>
        </p>
      </div>
    )
  }

  if (!setupAvailable) {
    return (
      <div className="page" style={{ maxWidth: '22rem', margin: '2rem auto' }}>
        <h2 style={{ marginTop: 0 }}>Instalación no disponible</h2>
        <p className="muted">
          El servidor no tiene configurada la contraseña maestra de instalación (SETUP_MASTER_PASSWORD). Configura el
          entorno o define ADMIN_USERNAME y ADMIN_PASSWORD.
        </p>
        <p>
          <Link to="/login">Ir al inicio de sesión</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: '22rem', margin: '2rem auto' }}>
      <h2 style={{ marginTop: 0 }}>Instalación inicial</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Crea la cuenta de administrador. Necesitas la contraseña maestra definida en el servidor (Secret de
        Kubernetes).
      </p>
      <form className="card-panel rag-query-form" onSubmit={(e) => void onSubmit(e)} style={{ marginTop: '1rem' }}>
        <label htmlFor="setup-master" className="muted" style={{ fontSize: '0.9rem' }}>
          Contraseña maestra
        </label>
        <input
          id="setup-master"
          type="password"
          autoComplete="off"
          value={masterPassword}
          onChange={(e) => setMasterPassword(e.target.value)}
          required
          minLength={1}
          disabled={loading}
        />
        <label htmlFor="setup-user" className="muted" style={{ fontSize: '0.9rem' }}>
          Usuario administrador
        </label>
        <input
          id="setup-user"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          maxLength={32}
          pattern="[a-zA-Z0-9_]+"
          title="Solo letras, números y guión bajo"
          disabled={loading}
        />
        <label htmlFor="setup-pass" className="muted" style={{ fontSize: '0.9rem' }}>
          Contraseña
        </label>
        <input
          id="setup-pass"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          maxLength={128}
          disabled={loading}
        />
        {error ? <div className="error-banner">{error}</div> : null}
        <button type="submit" disabled={loading}>
          {loading ? 'Creando administrador…' : 'Finalizar instalación'}
        </button>
      </form>
    </div>
  )
}
