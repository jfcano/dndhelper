import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import './index.css'
import './ui.css'
import './components/icon-buttons.css'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { CampaignsPage } from './pages/CampaignsPage'
import { CampaignDetailPage } from './pages/CampaignDetailPage'
import { WorldsPage } from './pages/WorldsPage'
import { WorldDetailPage } from './pages/WorldDetailPage'
import { DocumentsUploadPage } from './pages/DocumentsUploadPage'
import { ConsultasPage } from './pages/ConsultasPage'
import { SettingsPage } from './pages/SettingsPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { SetupPage } from './pages/SetupPage'

const router = createBrowserRouter([
  { path: '/setup', element: <SetupPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { path: '/', element: <Navigate to="/campaigns" replace /> },
      { path: '/consultas', element: <ConsultasPage /> },
      { path: '/rules', element: <Navigate to="/consultas" replace /> },
      { path: '/documentos', element: <DocumentsUploadPage /> },
      { path: '/manuals', element: <Navigate to="/documentos" replace /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/campaigns', element: <CampaignsPage /> },
      { path: '/campaigns/:id', element: <CampaignDetailPage /> },
      { path: '/worlds', element: <WorldsPage /> },
      { path: '/worlds/:id', element: <WorldDetailPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
