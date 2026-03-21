import { useEffect, useMemo, useState } from 'react'
import type { UUID, World, WorldGenerate } from '../lib/api'
import { api } from '../lib/api'
import { IconButton } from './IconButton'
import {
  IconChevronLeft,
  IconChevronRight,
  IconMinus,
  IconPlus,
  IconRotateCcw,
  IconSparkles,
} from './icons'
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
    <div className="card-panel">
      {error && <div className="error-banner" style={{ marginBottom: 8 }}>{error}</div>}
      <h3 style={{ marginTop: 0 }}>Asistente de creación de mundo</h3>
      <div style={{ opacity: 0.8, fontSize: 13 }}>Paso {step + 1} de 4</div>

      {step === 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <div style={{ opacity: 0.8, fontSize: 13 }}>Temática general (tono y ambiente)</div>
            <IconButton
              label="Autogenerar temática con IA"
              textShort="IA"
              busy={autogeneratingStep === 0}
              busyLabel="Autogenerando…"
              busyShort="…"
              disabled={autogeneratingStep !== null || generating}
              className="btn-icon--inline"
              onClick={() => void onAutogenerateStep(0)}
            >
              <IconSparkles />
            </IconButton>
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
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-input)',
              color: 'var(--text-heading)',
            }}
          />
        </div>
      )}

      {step === 1 && (
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <div style={{ opacity: 0.8, fontSize: 13 }}>Facciones principales con objetivos</div>
            <IconButton
              label="Autogenerar facciones con IA"
              textShort="IA"
              busy={autogeneratingStep === 1}
              busyLabel="Autogenerando…"
              busyShort="…"
              disabled={autogeneratingStep !== null || generating}
              className="btn-icon--inline"
              onClick={() => void onAutogenerateStep(1)}
            >
              <IconSparkles />
            </IconButton>
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
              <IconButton
                label="Quitar facción"
                textShort="Quitar"
                className="btn-icon--inline"
                disabled={wizard.factions.length <= 1}
                onClick={() =>
                  setWizard((w) => ({
                    ...w,
                    factions: w.factions.length > 1 ? w.factions.filter((_, idx) => idx !== i) : w.factions,
                  }))
                }
              >
                <IconMinus />
              </IconButton>
            </div>
          ))}
          <div>
            <IconButton
              label="Añadir facción"
              textShort="Añadir"
              disabled={generating}
              className="btn-icon--inline"
              onClick={() => setWizard((w) => ({ ...w, factions: [...w.factions, { name: '', objective: '' }] }))}
            >
              <IconPlus />
            </IconButton>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <div style={{ opacity: 0.8, fontSize: 13 }}>Personajes importantes dentro de cada facción</div>
            <IconButton
              label="Autogenerar personajes con IA"
              textShort="IA"
              busy={autogeneratingStep === 2}
              busyLabel="Autogenerando…"
              busyShort="…"
              disabled={autogeneratingStep !== null || generating}
              className="btn-icon--inline"
              onClick={() => void onAutogenerateStep(2)}
            >
              <IconSparkles />
            </IconButton>
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
              <IconButton
                label="Quitar personaje"
                textShort="Quitar"
                className="btn-icon--inline"
                disabled={wizard.characters.length <= 1}
                onClick={() =>
                  setWizard((w) => ({
                    ...w,
                    characters: w.characters.length > 1 ? w.characters.filter((_, idx) => idx !== i) : w.characters,
                  }))
                }
              >
                <IconMinus />
              </IconButton>
            </div>
          ))}
          <div>
            <IconButton
              label="Añadir personaje"
              textShort="Añadir"
              disabled={generating}
              className="btn-icon--inline"
              onClick={() =>
                setWizard((w) => ({
                  ...w,
                  characters: [...w.characters, { name: '', faction_name: '', role: '', motivation: '' }],
                }))
              }
            >
              <IconPlus />
            </IconButton>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <div style={{ opacity: 0.8, fontSize: 13 }}>Ciudades importantes con temática y relaciones</div>
            <IconButton
              label="Autogenerar ciudades con IA"
              textShort="IA"
              busy={autogeneratingStep === 3}
              busyLabel="Autogenerando…"
              busyShort="…"
              disabled={autogeneratingStep !== null || generating}
              className="btn-icon--inline"
              onClick={() => void onAutogenerateStep(3)}
            >
              <IconSparkles />
            </IconButton>
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
              <IconButton
                label="Quitar ciudad"
                textShort="Quitar"
                className="btn-icon--inline"
                disabled={wizard.cities.length <= 1}
                onClick={() =>
                  setWizard((w) => ({
                    ...w,
                    cities: w.cities.length > 1 ? w.cities.filter((_, idx) => idx !== i) : w.cities,
                  }))
                }
              >
                <IconMinus />
              </IconButton>
            </div>
          ))}
          <div>
            <IconButton
              label="Añadir ciudad"
              textShort="Añadir"
              disabled={generating}
              className="btn-icon--inline"
              onClick={() => setWizard((w) => ({ ...w, cities: [...w.cities, { name: '', theme: '', relations: [] }] }))}
            >
              <IconPlus />
            </IconButton>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <IconButton
            label="Paso anterior"
            textShort="Atrás"
            disabled={step === 0 || generating}
            className="btn-icon--inline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <IconChevronLeft />
          </IconButton>
          <IconButton
            label="Reiniciar asistente de mundo"
            textShort="Reiniciar"
            disabled={generating}
            className="btn-icon--inline"
            onClick={onResetWizard}
          >
            <IconRotateCcw />
          </IconButton>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {step < 3 ? (
            <IconButton
              label="Siguiente paso"
              textShort="Siguiente"
              disabled={!canContinueFromCurrentStep() || generating}
              className="btn-icon--inline"
              onClick={() => setStep((s) => Math.min(3, s + 1))}
            >
              <IconChevronRight />
            </IconButton>
          ) : (
            <IconButton
              label="Generar mundo a partir del asistente"
              textShort="Generar"
              busy={generating}
              busyLabel="Generando mundo…"
              busyShort="…"
              disabled={generating || !canContinueFromCurrentStep()}
              className="btn-icon--inline"
              onClick={() => void onGenerate()}
            >
              <IconSparkles />
            </IconButton>
          )}
        </div>
      </div>
    </div>
  )
}

