import type { ApiError } from './api'

function backendDownMessage() {
  return 'No hay conexión con el backend. Inícialo e inténtalo de nuevo.'
}

export function formatError(e: unknown): string {
  if (e && typeof e === 'object' && 'status' in e && 'message' in e) {
    const ae = e as ApiError
    if (ae.status === 0) {
      return backendDownMessage()
    }
    // En dev, cuando Vite proxy no puede llegar al backend suele devolver 502/503/504
    if (ae.status === 502 || ae.status === 503 || ae.status === 504) {
      return backendDownMessage()
    }
    return ae.message
  }

  if (e instanceof Error) return e.message
  return String(e)
}

