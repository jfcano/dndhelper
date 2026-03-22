import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { getAccessToken, setAccessToken } from '../lib/authToken'

/** Rutas accesibles sin sesión (instalación ya completada). */
function isPublicAuthPath(pathname: string): boolean {
  const publicPrefixes = ['/setup', '/login', '/register']
  return publicPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * Si el backend indica que no hay administrador (needs_setup), fuerza /setup
 * en cualquier ruta (incl. con token antiguo tras regenerar la BD).
 */
export function SetupGate() {
  const location = useLocation()
  const [ready, setReady] = useState(false)
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const s = await api.getSetupStatus()
        if (!cancelled) setNeedsSetup(s.needs_setup)
      } catch {
        if (!cancelled) setNeedsSetup(null)
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  useEffect(() => {
    if (!ready) return
    if (needsSetup === true && location.pathname !== '/setup') {
      setAccessToken(null)
    }
  }, [ready, needsSetup, location.pathname])

  useEffect(() => {
    const onFocus = () => {
      void (async () => {
        try {
          const s = await api.getSetupStatus()
          setNeedsSetup(s.needs_setup)
        } catch {
          setNeedsSetup(null)
        }
      })()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  if (!ready) {
    return (
      <div className="page" style={{ maxWidth: '22rem', margin: '2rem auto' }}>
        <p className="muted">Comprobando instalación…</p>
      </div>
    )
  }

  if (needsSetup === true && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />
  }

  // Instalación lista: sin token solo setup/login/register (evita navegar la app con sesión vacía).
  if (needsSetup === false && !getAccessToken() && !isPublicAuthPath(location.pathname)) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
