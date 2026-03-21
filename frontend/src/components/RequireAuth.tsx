import { Navigate, useLocation } from 'react-router-dom'
import { getAccessToken } from '../lib/authToken'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const loc = useLocation()
  if (!getAccessToken()) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  }
  return <>{children}</>
}
