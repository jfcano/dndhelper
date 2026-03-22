import type { Campaign } from '../../lib/api'
import { IconButton } from '../../components/IconButton'
import { IconSparkles, IconTrash, IconUsers, IconX } from '../../components/icons'
import { renderStructuredSheet, type PlayerDerived } from './playerSheet'

export type CampaignJugadoresTabProps = {
  campaign: Campaign
  derivedPlayers: PlayerDerived[]
  playersLoading: boolean
  playersError: string | null
  createPlayersOpen: boolean
  setCreatePlayersOpen: (v: boolean) => void
  createPlayersCount: number
  setCreatePlayersCount: (v: number) => void
  setPlayersError: (v: string | null) => void
  selectedPlayerIndex: number
  setSelectedPlayerIndex: (v: number) => void
  selectedPlayer: PlayerDerived | null
  onCreateAndGeneratePlayers: () => void | Promise<void>
  setPlayerDeletePending: (v: { id: string; name: string } | null) => void
}

export function CampaignJugadoresTab(props: CampaignJugadoresTabProps) {
  const {
    campaign,
    derivedPlayers,
    playersLoading,
    playersError,
    createPlayersOpen,
    setCreatePlayersOpen,
    createPlayersCount,
    setCreatePlayersCount,
    setPlayersError,
    selectedPlayerIndex,
    setSelectedPlayerIndex,
    selectedPlayer,
    onCreateAndGeneratePlayers,
    setPlayerDeletePending,
  } = props

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12, marginTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <h3 style={{ marginTop: 0, fontSize: 24, textAlign: 'left' }}>Personajes jugadores</h3>
        <IconButton
          label="Crear personajes jugadores con IA"
          textShort="Jugadores"
          busy={playersLoading}
          busyLabel="Generando jugadores…"
          busyShort="…"
          disabled={campaign.brief_status !== 'approved'}
          className="btn-icon--inline"
          onClick={() => {
            setPlayersError(null)
            setCreatePlayersOpen(true)
          }}
        >
          <IconUsers />
        </IconButton>
      </div>
      {playersError && <div style={{ color: 'var(--danger)' }}>{playersError}</div>}
      {createPlayersOpen && (
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12, marginTop: 12 }}>
          <h4 style={{ margin: '0 0 8px 0' }}>Crear personajes jugadores</h4>
          <div style={{ display: 'grid', gap: 10 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ opacity: 0.75, fontSize: 12 }}>¿Cuántos jugadores crear? (1-8)</span>
              <input
                type="number"
                min={1}
                max={8}
                value={createPlayersCount}
                onChange={(e) => setCreatePlayersCount(Number(e.target.value))}
                style={{
                  padding: 8,
                  borderRadius: 10,
                  border: '1px solid var(--border-subtle)',
                  background: 'rgba(0,0,0,0.25)',
                  color: 'inherit',
                  width: 140,
                }}
                disabled={playersLoading}
              />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <IconButton
                label="Cancelar creación de jugadores"
                textShort="Cancelar"
                disabled={playersLoading}
                className="btn-icon--inline"
                onClick={() => setCreatePlayersOpen(false)}
              >
                <IconX />
              </IconButton>
              <IconButton
                label="Crear y generar personajes jugadores"
                textShort="Crear"
                busy={playersLoading}
                busyLabel="Creando jugadores…"
                busyShort="…"
                className="btn-icon--inline"
                onClick={() => void onCreateAndGeneratePlayers()}
              >
                <IconSparkles />
              </IconButton>
            </div>
          </div>
        </div>
      )}
      {derivedPlayers.length === 0 && !playersLoading && (
        <div>
          Aún no hay personajes jugadores. Deben generarse aparte y no se derivan del mundo ni de los personajes implicados.
        </div>
      )}
      {derivedPlayers.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--table-header-bg)' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: 10 }}>Jugador</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>Resumen</th>
                  <th style={{ textAlign: 'left', padding: 10 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {derivedPlayers.map((p, idx) => (
                  <tr
                    key={p.id}
                    style={{
                      borderTop: '1px solid var(--table-row-border)',
                      background: selectedPlayerIndex === idx ? 'var(--table-row-selected)' : undefined,
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedPlayerIndex(idx)}
                  >
                    <td style={{ padding: 10 }}>{p.name}</td>
                    <td style={{ padding: 10 }}>{p.summary || <span style={{ opacity: 0.75 }}>(vacío)</span>}</td>
                    <td style={{ padding: 10 }}>
                      <IconButton
                        label={`Borrar personaje jugador ${p.name}`}
                        textShort="Borrar"
                        className="btn-icon--inline"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPlayerDeletePending({ id: p.id, name: p.name })
                        }}
                      >
                        <IconTrash />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedPlayer ? (
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 22, textAlign: 'left' }}>{selectedPlayer.name}</h3>
                <div style={{ opacity: 0.75, fontSize: 12 }}>Vista de detalle</div>
              </div>
              <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                <div>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>Resumen del jugador</div>
                  <div>{selectedPlayer.summary || <span style={{ opacity: 0.75 }}>(vacío)</span>}</div>
                </div>
                <div>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>Ficha básica</div>
                  <div
                    style={{
                      marginTop: 6,
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 10,
                      padding: 10,
                      background: 'var(--panel-highlight)',
                      fontSize: 14,
                      lineHeight: 1.45,
                      textAlign: 'left',
                    }}
                  >
                    {renderStructuredSheet(selectedPlayer.basicSheet)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ opacity: 0.8 }}>(Selecciona un jugador para ver el detalle)</div>
          )}
        </div>
      )}
    </div>
  )
}
