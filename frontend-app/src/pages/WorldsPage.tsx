import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { World, WorldGenerate } from '../lib/api'
import { formatError } from '../lib/errors'
import { toSpanishStatus } from '../lib/statusLabels'

const WORLD_WIZARD_STORAGE_KEY = 'dndhelper.worldWizard.v1'
const WORLD_WIZARD_STEP_STORAGE_KEY = 'dndhelper.worldWizard.step.v1'

function createEmptyWizard(): WorldGenerate {
  return {
    theme_and_mood: '',
    factions: [{ name: '', objective: '' }],
    characters: [{ name: '', faction_name: '', role: '', motivation: '' }],
    cities: [{ name: '', theme: '', relations: [] }],
  }
}

export function WorldsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<World[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [autogeneratingStep, setAutogeneratingStep] = useState<number | null>(null)
  const [deletingWorldId, setDeletingWorldId] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [wizard, setWizard] = useState<WorldGenerate>(createEmptyWizard())

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

  useEffect(() => {
    try {
      const rawWizard = localStorage.getItem(WORLD_WIZARD_STORAGE_KEY)
      if (rawWizard) {
        const parsed = JSON.parse(rawWizard) as WorldGenerate
        setWizard({
          theme_and_mood: typeof parsed.theme_and_mood === 'string' ? parsed.theme_and_mood : '',
          factions: Array.isArray(parsed.factions) && parsed.factions.length > 0 ? parsed.factions : createEmptyWizard().factions,
          characters:
            Array.isArray(parsed.characters) && parsed.characters.length > 0 ? parsed.characters : createEmptyWizard().characters,
          cities: Array.isArray(parsed.cities) && parsed.cities.length > 0 ? parsed.cities : createEmptyWizard().cities,
        })
      }
      const rawStep = localStorage.getItem(WORLD_WIZARD_STEP_STORAGE_KEY)
      if (rawStep) {
        const parsedStep = Number(rawStep)
        if (Number.isInteger(parsedStep) && parsedStep >= 0 && parsedStep <= 3) {
          setStep(parsedStep)
        }
      }
    } catch {
      // Si el contenido guardado está corrupto, se ignora y se usa estado por defecto.
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(WORLD_WIZARD_STORAGE_KEY, JSON.stringify(wizard))
  }, [wizard])

  useEffect(() => {
    localStorage.setItem(WORLD_WIZARD_STEP_STORAGE_KEY, String(step))
  }, [step])

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
      const w = await api.generateWorld(wizard)
      const empty = createEmptyWizard()
      setWizard(empty)
      setStep(0)
      localStorage.removeItem(WORLD_WIZARD_STORAGE_KEY)
      localStorage.removeItem(WORLD_WIZARD_STEP_STORAGE_KEY)
      await reload()
      navigate(`/worlds/${w.id}`)
    } catch (e) {
      setError(formatError(e))
    } finally {
      setGenerating(false)
    }
  }

  async function onAutogenerateStep(targetStep: 0 | 1 | 2 | 3) {
    setError(null)
    setAutogeneratingStep(targetStep)
    try {
      const resp = await api.autogenerateWorldWizardStep({
        step: targetStep,
        wizard,
      })
      setWizard((prev) => ({
        ...prev,
        ...resp.patch,
      }))
    } catch (e) {
      setError(formatError(e))
    } finally {
      setAutogeneratingStep(null)
    }
  }

  function canContinueFromCurrentStep(): boolean {
    if (step === 0) return wizard.theme_and_mood.trim().length >= 10
    if (step === 1) return wizard.factions.every((f) => f.name.trim() && f.objective.trim())
    if (step === 2)
      return wizard.characters.every((c) => c.name.trim() && c.faction_name.trim() && c.role.trim() && c.motivation.trim())
    if (step === 3) return wizard.cities.every((c) => c.name.trim() && c.theme.trim())
    return false
  }

  const factionNames = useMemo(
    () => wizard.factions.map((f) => f.name.trim()).filter(Boolean),
    [wizard.factions],
  )

  function onResetWizard() {
    setWizard(createEmptyWizard())
    setStep(0)
    localStorage.removeItem(WORLD_WIZARD_STORAGE_KEY)
    localStorage.removeItem(WORLD_WIZARD_STEP_STORAGE_KEY)
  }

  async function onDeleteWorld(world: World) {
    let campaignCount = 0
    try {
      const usage = await api.getWorldUsage(world.id)
      campaignCount = usage.campaign_count
    } catch (e) {
      setError(formatError(e))
      return
    }

    if (campaignCount > 0) {
      window.alert(`No puedes borrar "${world.name}" porque está siendo usado por ${campaignCount} campaña(s).`)
      return
    }

    const ok = window.confirm(
      `¿Seguro que quieres borrar "${world.name}"? Actualmente lo usan ${campaignCount} campaña(s). Esta acción no se puede deshacer.`,
    )
    if (!ok) return
    setDeletingWorldId(world.id)
    setError(null)
    try {
      await api.deleteWorld(world.id)
      await reload()
    } catch (e) {
      setError(formatError(e))
    } finally {
      setDeletingWorldId(null)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Mundos</h2>
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
        <h3 style={{ marginTop: 0 }}>Asistente de creación de mundo</h3>
        <div style={{ opacity: 0.8, fontSize: 13 }}>Paso {step + 1} de 4</div>

        {step === 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <div style={{ opacity: 0.8, fontSize: 13 }}>Temática general (tono y ambiente)</div>
              <button onClick={() => void onAutogenerateStep(0)} disabled={autogeneratingStep !== null || generating}>
                {autogeneratingStep === 0 ? 'Autogenerando…' : 'Autogenerar'}
              </button>
            </div>
            <textarea
              value={wizard.theme_and_mood}
              onChange={(e) => setWizard((w) => ({ ...w, theme_and_mood: e.target.value }))}
              rows={6}
              placeholder="Ej: fantasía oscura con toques de esperanza, decadencia imperial, magia peligrosa..."
              style={{
                width: '100%',
                marginTop: 8,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: 13,
                padding: 10,
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(0,0,0,0.25)',
                color: 'inherit',
              }}
            />
          </div>
        )}

        {step === 1 && (
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <div style={{ opacity: 0.8, fontSize: 13 }}>Facciones principales con objetivos</div>
              <button onClick={() => void onAutogenerateStep(1)} disabled={autogeneratingStep !== null || generating}>
                {autogeneratingStep === 1 ? 'Autogenerando…' : 'Autogenerar'}
              </button>
            </div>
            {wizard.factions.map((f, i) => (
              <div key={`f-${i}`} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 8 }}>
                <input
                  placeholder="Nombre de facción"
                  value={f.name}
                  onChange={(e) =>
                    setWizard((w) => {
                      const factions = [...w.factions]
                      factions[i] = { ...factions[i], name: e.target.value }
                      return { ...w, factions }
                    })
                  }
                />
                <input
                  placeholder="Objetivo principal"
                  value={f.objective}
                  onChange={(e) =>
                    setWizard((w) => {
                      const factions = [...w.factions]
                      factions[i] = { ...factions[i], objective: e.target.value }
                      return { ...w, factions }
                    })
                  }
                />
                <button
                  onClick={() =>
                    setWizard((w) => ({
                      ...w,
                      factions: w.factions.length > 1 ? w.factions.filter((_, idx) => idx !== i) : w.factions,
                    }))
                  }
                  disabled={wizard.factions.length <= 1}
                >
                  Quitar
                </button>
              </div>
            ))}
            <div>
              <button onClick={() => setWizard((w) => ({ ...w, factions: [...w.factions, { name: '', objective: '' }] }))}>
                + Añadir facción
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <div style={{ opacity: 0.8, fontSize: 13 }}>Personajes importantes dentro de cada facción</div>
              <button onClick={() => void onAutogenerateStep(2)} disabled={autogeneratingStep !== null || generating}>
                {autogeneratingStep === 2 ? 'Autogenerando…' : 'Autogenerar'}
              </button>
            </div>
            {wizard.characters.map((c, i) => (
              <div key={`c-${i}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr auto', gap: 8 }}>
                <input
                  placeholder="Nombre"
                  value={c.name}
                  onChange={(e) =>
                    setWizard((w) => {
                      const characters = [...w.characters]
                      characters[i] = { ...characters[i], name: e.target.value }
                      return { ...w, characters }
                    })
                  }
                />
                <select
                  value={c.faction_name}
                  onChange={(e) =>
                    setWizard((w) => {
                      const characters = [...w.characters]
                      characters[i] = { ...characters[i], faction_name: e.target.value }
                      return { ...w, characters }
                    })
                  }
                >
                  <option value="">Facción…</option>
                  {factionNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Rol"
                  value={c.role}
                  onChange={(e) =>
                    setWizard((w) => {
                      const characters = [...w.characters]
                      characters[i] = { ...characters[i], role: e.target.value }
                      return { ...w, characters }
                    })
                  }
                />
                <input
                  placeholder="Motivación"
                  value={c.motivation}
                  onChange={(e) =>
                    setWizard((w) => {
                      const characters = [...w.characters]
                      characters[i] = { ...characters[i], motivation: e.target.value }
                      return { ...w, characters }
                    })
                  }
                />
                <button
                  onClick={() =>
                    setWizard((w) => ({
                      ...w,
                      characters: w.characters.length > 1 ? w.characters.filter((_, idx) => idx !== i) : w.characters,
                    }))
                  }
                  disabled={wizard.characters.length <= 1}
                >
                  Quitar
                </button>
              </div>
            ))}
            <div>
              <button
                onClick={() =>
                  setWizard((w) => ({
                    ...w,
                    characters: [...w.characters, { name: '', faction_name: '', role: '', motivation: '' }],
                  }))
                }
              >
                + Añadir personaje
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <div style={{ opacity: 0.8, fontSize: 13 }}>Ciudades importantes con temática y relaciones</div>
              <button onClick={() => void onAutogenerateStep(3)} disabled={autogeneratingStep !== null || generating}>
                {autogeneratingStep === 3 ? 'Autogenerando…' : 'Autogenerar'}
              </button>
            </div>
            {wizard.cities.map((c, i) => (
              <div key={`city-${i}`} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr auto', gap: 8 }}>
                <input
                  placeholder="Nombre de ciudad"
                  value={c.name}
                  onChange={(e) =>
                    setWizard((w) => {
                      const cities = [...w.cities]
                      cities[i] = { ...cities[i], name: e.target.value }
                      return { ...w, cities }
                    })
                  }
                />
                <input
                  placeholder="Temática de la ciudad"
                  value={c.theme}
                  onChange={(e) =>
                    setWizard((w) => {
                      const cities = [...w.cities]
                      cities[i] = { ...cities[i], theme: e.target.value }
                      return { ...w, cities }
                    })
                  }
                />
                <input
                  placeholder="Relaciones (coma separadas)"
                  value={c.relations.join(', ')}
                  onChange={(e) =>
                    setWizard((w) => {
                      const cities = [...w.cities]
                      cities[i] = {
                        ...cities[i],
                        relations: e.target.value
                          .split(',')
                          .map((x) => x.trim())
                          .filter(Boolean),
                      }
                      return { ...w, cities }
                    })
                  }
                />
                <button
                  onClick={() =>
                    setWizard((w) => ({
                      ...w,
                      cities: w.cities.length > 1 ? w.cities.filter((_, idx) => idx !== i) : w.cities,
                    }))
                  }
                  disabled={wizard.cities.length <= 1}
                >
                  Quitar
                </button>
              </div>
            ))}
            <div>
              <button onClick={() => setWizard((w) => ({ ...w, cities: [...w.cities, { name: '', theme: '', relations: [] }] }))}>
                + Añadir ciudad
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || generating}>
              Anterior
            </button>
            <button onClick={onResetWizard} disabled={generating}>
              Reiniciar asistente
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {step < 3 ? (
              <button onClick={() => setStep((s) => Math.min(3, s + 1))} disabled={!canContinueFromCurrentStep() || generating}>
                Siguiente
              </button>
            ) : (
              <button onClick={() => void onGenerate()} disabled={generating || !canContinueFromCurrentStep()}>
                {generating ? 'Generando…' : 'Generar mundo'}
              </button>
            )}
          </div>
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
                <th style={{ textAlign: 'left', padding: 10 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <td style={{ padding: 10 }}>
                    <Link to={`/worlds/${w.id}`}>{w.name}</Link>
                  </td>
                  <td style={{ padding: 10 }}>{toSpanishStatus(w.status)}</td>
                  <td style={{ padding: 10 }}>
                    <small style={{ opacity: 0.8 }}>{w.updated_at}</small>
                  </td>
                  <td style={{ padding: 10 }}>
                    <button onClick={() => void onDeleteWorld(w)} disabled={deletingWorldId === w.id}>
                      {deletingWorldId === w.id ? 'Borrando…' : 'Borrar'}
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td style={{ padding: 10, opacity: 0.8 }} colSpan={4}>
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

