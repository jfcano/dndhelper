import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import './layout.css'
import { HeaderOrnaments } from './HeaderOrnaments'
import { IconGlobe, IconMoon, IconScroll, IconSun } from './icons'
import { applyThemeToDocument, readStoredTheme, type ThemeId } from '../lib/theme'

export function Layout() {
  const [theme, setTheme] = useState<ThemeId>(() => readStoredTheme())

  useEffect(() => {
    applyThemeToDocument(theme)
  }, [theme])

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
