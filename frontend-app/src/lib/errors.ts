import type { ApiError } from './api'

export function formatError(e: unknown): string {
  if (e && typeof e === 'object' && 'status' in e && 'message' in e) {
    const ae = e as ApiError
    if (ae.status === 0) {
      return (
        'No se puede conectar con el backend.\n' +
        'Asegúrate de que FastAPI está levantado en http://127.0.0.1:8000 (por ejemplo: `.venv\\Scripts\\uvicorn backend.app.main:app --reload`).'
      )
    }
    return ae.message
  }

  if (e instanceof Error) return e.message
  return String(e)
}

