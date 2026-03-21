import { useEffect, useMemo, useState } from 'react'
import type { UUID, World, WorldGenerate } from '../lib/api'
import { api } from '../lib/api'
import { formatError } from '../lib/errors'

function createEmptyWizard(): WorldGenerate {
  return {
    theme_and_mood: '',
    factions: [{ name: '', objective: '' }],
    characters: [{ name: '', faction_name: '', role: '', motivation: '' }],
    cities: [{ name: '', theme: '', relations: [] }],
  }
}

function wizardStorageKey(worldId: UUID): string {
  return `dndhelper.worldWizard.${worldId}.v1`
}

function wizardStepStorageKey(worldId: UUID): string {
  return `dndhelper.worldWizard.step.${worldId}.v1`
}

export function WorldCreationWizard({
  worldId,
  onWorldGenerated,
}: {
  worldId: UUID
  onWorldGenerated: (world: World) => void
}) {
  const [wizard, setWizard] = useState<WorldGenerate>(createEmptyWizard())
  const [step, setStep] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [autogeneratingStep, setAutogeneratingStep] = useState<number | null>(null)

  const factionNames = useMemo(() => wizard.factions.map((f) => f.name.trim()).filter(Boolean), [wizard.factions])

  useEffect(() => {
    try {
      const rawWizard = localStorage.getItem(wizardStorageKey(worldId))
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

      const rawStep = localStorage.getItem(wizardStepStorageKey(worldId))
      if (rawStep) {
        const parsedStep = Number(rawStep)
        if (Number.isInteger(parsedStep) && parsedStep >= 0 && parsedStep <= 3) {
          setStep(parsedStep)
        }
      }
    } catch {
      // Si el contenido guardado está corrupto, se ignora.
    }
  }, [worldId])

  useEffect(() => {
    localStorage.setItem(wizardStorageKey(worldId), JSON.stringify(wizard))
  }, [wizard, worldId])

  useEffect(() => {
    localStorage.setItem(wizardStepStorageKey(worldId), String(step))
  }, [step, worldId])

  function canContinueFromCurrentStep(): boolean {
    if (step === 0) return wizard.theme_and_mood.trim().length >= 10
    if (step === 1) return wizard.factions.every((f) => f.name.trim() && f.objective.trim())
    if (step === 2)
      return wizard.characters.every((c) => c.name.trim() && c.faction_name.trim() && c.role.trim() && c.motivation.trim())
    if (step === 3) return wizard.cities.every((c) => c.name.trim() && c.theme.trim())
    return false
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

  function onResetWizard() {
    setWizard(createEmptyWizard())
    setStep(0)
    localStorage.removeItem(wizardStorageKey(worldId))
    localStorage.removeItem(wizardStepStorageKey(worldId))
    setError(null)
  }

  async function onGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const updated = await api.generateWorldForExistingWorld(worldId, wizard)
      localStorage.removeItem(wizardStorageKey(worldId))
      localStorage.removeItem(wizardStepStorageKey(worldId))
      onWorldGenerated(updated)
    } catch (e) {
      setError(formatError(e))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 12 }}>
      {error && <div style={{ color: 'salmon', marginBottom: 8 }}>{error}</div>}
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
            <button
              onClick={() => setWizard((w) => ({ ...w, factions: [...w.factions, { name: '', objective: '' }] }))}
              disabled={generating}
            >
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
              disabled={generating}
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
            <button
              onClick={() => setWizard((w) => ({ ...w, cities: [...w.cities, { name: '', theme: '', relations: [] }] }))}
              disabled={generating}
            >
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
  )
}

