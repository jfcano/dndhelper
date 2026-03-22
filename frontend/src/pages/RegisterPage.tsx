import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { setAccessToken } from '../lib/authToken'
import { formatError } from '../lib/errors'

export function RegisterPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const s = await api.getSetupStatus()
        if (!cancelled && s.needs_setup) {
          navigate('/setup', { replace: true })
        }
      } catch {
        /* ignorar */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [navigate])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await api.register(username, password)
      setAccessToken(res.access_token)
      navigate('/campaigns', { replace: true })
    } catch (err) {
      setError(formatError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page" style={{ maxWidth: '22rem', margin: '2rem auto' }}>
      <h2 style={{ marginTop: 0 }}>Crear cuenta</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Elige un nombre de usuario (letras, números y guión bajo, 3–32 caracteres) y una contraseña de al menos 8
        caracteres. ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>.
      </p>
      <form className="card-panel rag-query-form" onSubmit={(e) => void onSubmit(e)} style={{ marginTop: '1rem' }}>
        <label htmlFor="reg-user" className="muted" style={{ fontSize: '0.9rem' }}>
          Usuario
        </label>
        <input
          id="reg-user"
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
        <label htmlFor="reg-pass" className="muted" style={{ fontSize: '0.9rem' }}>
          Contraseña
        </label>
        <input
          id="reg-pass"
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
          {loading ? 'Creando…' : 'Registrarse'}
        </button>
      </form>
    </div>
  )
}
