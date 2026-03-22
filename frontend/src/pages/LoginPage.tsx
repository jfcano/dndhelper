import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { setAccessToken } from '../lib/authToken'
import { formatError } from '../lib/errors'

export function LoginPage() {
  const navigate = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/campaigns'

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
        /* ignorar: el usuario puede iniciar sesión si el backend ya tiene admin */
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
      const res = await api.login(username, password)
      setAccessToken(res.access_token)
      navigate(from, { replace: true })
    } catch (err) {
      setError(formatError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page" style={{ maxWidth: '22rem', margin: '2rem auto' }}>
      <h2 style={{ marginTop: 0 }}>Iniciar sesión</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Entra con tu usuario. Si no tienes cuenta,{' '}
        <Link to="/register">regístrate</Link>.
      </p>
      <form className="card-panel rag-query-form" onSubmit={(e) => void onSubmit(e)} style={{ marginTop: '1rem' }}>
        <label htmlFor="login-user" className="muted" style={{ fontSize: '0.9rem' }}>
          Usuario
        </label>
        <input
          id="login-user"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          disabled={loading}
        />
        <label htmlFor="login-pass" className="muted" style={{ fontSize: '0.9rem' }}>
          Contraseña
        </label>
        <input
          id="login-pass"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          disabled={loading}
        />
        {error ? <div className="error-banner">{error}</div> : null}
        <button type="submit" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
