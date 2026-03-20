import { NavLink, Outlet } from 'react-router-dom'
import './layout.css'

export function Layout() {
  return (
    <div className="appShell">
      <header className="topbar">
        <div className="brand">dndhelper</div>
        <nav className="nav">
          <NavLink to="/worlds" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            Mundos
          </NavLink>
          <NavLink to="/campaigns" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            Campañas
          </NavLink>
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}

