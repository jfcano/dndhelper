import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { World } from '../lib/api'
import { formatError } from '../lib/errors'

export function WorldsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<World[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [description, setDescription] = useState('')

  async function reload() {
    setError(null)
    try {
      setItems(await api.listWorlds())
    } catch (e) {
      setError(formatError(e))
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const rows = useMemo(() => items ?? [], [items])

  async function onCreate() {
    setCreating(true)
    setError(null)
    try {
      await api.createWorld({ name: 'Nuevo mundo' })
      await reload()
    } catch (e) {
      setError(formatError(e))
    } finally {
      setCreating(false)
    }
  }

  async function onGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const w = await api.generateWorld({ description })
      setDescription('')
      await reload()
      navigate(`/worlds/${w.id}`)
    } catch (e) {
      setError(formatError(e))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Worlds</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => void reload()}>Recargar</button>
          <button onClick={() => void onCreate()} disabled={creating}>
            {creating ? 'Creando…' : 'Crear'}
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'salmon' }}>{error}</div>}
      {!items && !error && <div>Cargando…</div>}

      <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Generar world (independiente)</h3>
        <div style={{ opacity: 0.8, fontSize: 13 }}>
          Describe el mundo con libertad (género, tono, regiones, facciones, magia/tecnología, inspiración, límites…).
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={7}
          placeholder="Ej: Un archipiélago de islas flotantes gobernadas por casas mercantes..."
          style={{
            width: '100%',
            marginTop: 10,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: 13,
            padding: 10,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.25)',
            color: 'inherit',
          }}
        />
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => void onGenerate()} disabled={generating || description.trim().length < 10}>
            {generating ? 'Generando…' : 'Generar'}
          </button>
        </div>
      </div>

      {items && (
        <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'rgba(255,255,255,0.04)' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: 10 }}>Nombre</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Estado</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <td style={{ padding: 10 }}>
                    <Link to={`/worlds/${w.id}`}>{w.name}</Link>
                  </td>
                  <td style={{ padding: 10 }}>{w.status}</td>
                  <td style={{ padding: 10 }}>
                    <small style={{ opacity: 0.8 }}>{w.updated_at}</small>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td style={{ padding: 10, opacity: 0.8 }} colSpan={3}>
                    No hay mundos todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

