import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import './layout.css'
import { HeaderOrnaments } from './HeaderOrnaments'
import { IconBook, IconCog, IconGlobe, IconMoon, IconScroll, IconSun, IconUploadDoc } from './icons'
import { applyThemeToDocument, readStoredTheme, type ThemeId } from '../lib/theme'
import { api, type UserPublic } from '../lib/api'
import { setAccessToken } from '../lib/authToken'

export function Layout() {
  const navigate = useNavigate()
  const [me, setMe] = useState<UserPublic | null>(null)
  const [theme, setTheme] = useState<ThemeId>(() => readStoredTheme())

  useEffect(() => {
    applyThemeToDocument(theme)
  }, [theme])

  useEffect(() => {
    void api.getMe().then(setMe).catch(() => setMe(null))
  }, [])

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  return (
    <div className="appShell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-row topbar-row--brand">
            <div className="brand-wrap">
              <HeaderOrnaments />
              <div className="brand">
                DnD <span className="accent">Helper</span>
              </div>
            </div>
            <button
              type="button"
              className="theme-toggle btn-icon btn-icon--theme btn-icon--labeled"
              onClick={toggleTheme}
              aria-pressed={theme === 'light'}
              title={theme === 'dark' ? 'Activar aspecto pergamino claro' : 'Activar aspecto taberna oscuro'}
              aria-label={theme === 'dark' ? 'Activar aspecto pergamino claro' : 'Activar aspecto taberna oscuro'}
            >
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
              <span className="btn-icon__short" aria-hidden>
                {theme === 'dark' ? 'Pergamino' : 'Taberna'}
              </span>
            </button>
          </div>
          <div className="topbar-row topbar-row--nav">
            <nav className="nav" aria-label="Principal">
              <NavLink to="/worlds" className={({ isActive }) => (isActive ? 'active' : undefined)}>
                <IconGlobe className="nav-icon" />
                Mundos
              </NavLink>
              <NavLink to="/campaigns" className={({ isActive }) => (isActive ? 'active' : undefined)}>
                <IconScroll className="nav-icon" />
                Campañas
              </NavLink>
              <span className="nav-sep" role="separator" aria-hidden="true" />
              <NavLink
                to="/consultas"
                className={({ isActive }) => (isActive ? 'active' : undefined)}
                title="Consultas RAG: reglas, campañas o una campaña concreta"
              >
                <IconBook className="nav-icon" />
                Consultas
              </NavLink>
              <NavLink
                to="/documentos"
                className={({ isActive }) => (isActive ? 'active' : undefined)}
                title="Subir documentos al índice RAG (manuales o referencias de campaña)"
              >
                <IconUploadDoc className="nav-icon" />
                Documentos
              </NavLink>
            </nav>
            <nav className="nav nav--settings" aria-label="Configuración">
              {me ? (
                <span className="nav-user muted" title={me.id}>
                  {me.username}
                  {me.is_admin ? <span className="nav-admin-badge"> admin</span> : null}
                </span>
              ) : null}
              <button
                type="button"
                className="nav-logout linkish"
                onClick={() => {
                  setAccessToken(null)
                  navigate('/login', { replace: true })
                }}
              >
                Salir
              </button>
              <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : undefined)} title="Claves API (OpenAI, Hugging Face)">
                <IconCog className="nav-icon" />
                Ajustes
              </NavLink>
            </nav>
          </div>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
