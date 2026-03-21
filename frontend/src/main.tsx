import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import './index.css'
import './ui.css'
import './components/icon-buttons.css'
import { Layout } from './components/Layout'
import { CampaignsPage } from './pages/CampaignsPage'
import { CampaignDetailPage } from './pages/CampaignDetailPage'
import { WorldsPage } from './pages/WorldsPage'
import { WorldDetailPage } from './pages/WorldDetailPage'

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Navigate to="/campaigns" replace /> },
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
