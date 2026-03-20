export type UUID = string

export type World = {
  id: UUID
  owner_id: UUID
  name: string
  pitch: string | null
  tone: string | null
  themes: Record<string, unknown> | null
  content_draft: string | null
  content_final: string | null
  status: string
  created_at: string
  updated_at: string
}

export type Campaign = {
  id: UUID
  owner_id: UUID
  world_id: UUID | null
  name: string
  system: string
  tone: string | null
  starting_level: number | null
  goals: string | null
  brief_draft: Record<string, unknown> | null
  brief_final: Record<string, unknown> | null
  brief_status: string
  story_draft: string | null
  story_final: string | null
  outline_draft: string | null
  outline_final: string | null
  outline_status: string
  created_at: string
  updated_at: string
}

export type Session = {
  id: UUID
  campaign_id: UUID
  session_number: number
  title: string
  summary: string | null
  status: string
  notes: string | null
  content_draft: string | null
  content_final: string | null
  approval_status: string
  played: boolean
  created_at: string
  updated_at: string
}

export type PlayerProfile = {
  id?: string
  name: string
  summary: string
  basic_sheet?: Record<string, unknown> | string | null
}

export type SessionUpdate = Partial<{
  session_number: number
  title: string
  summary: string | null
  status: string
  notes: string | null
  content_draft: string | null
  content_final: string | null
  approval_status: string
  played: boolean
}>

export type WorldCreate = { name?: string }
export type WorldUpdate = Partial<Pick<World, 'name' | 'pitch' | 'tone' | 'themes' | 'content_draft'>>
export type WorldWizardFactionInput = {
  name: string
  objective: string
}

export type WorldWizardCharacterInput = {
  name: string
  faction_name: string
  role: string
  motivation: string
}

export type WorldWizardCityInput = {
  name: string
  theme: string
  relations: string[]
}

export type WorldGenerate = {
  theme_and_mood: string
  factions: WorldWizardFactionInput[]
  characters: WorldWizardCharacterInput[]
  cities: WorldWizardCityInput[]
}
export type WorldUsage = { campaign_count: number }
export type WorldWizardAutogenerateRequest = { step: 0 | 1 | 2 | 3; wizard: WorldGenerate }
export type WorldWizardAutogenerateResponse = {
  step: number
  patch: Partial<Pick<WorldGenerate, 'theme_and_mood' | 'factions' | 'characters' | 'cities'>>
}

export type CampaignUpdate = {
  name?: string
  system?: string
  tone?: string | null
  starting_level?: number | null
  goals?: string | null
  world_id?: UUID | null
}

export type CampaignCreate = {
  name: string
  system?: string
  tone?: string | null
  starting_level?: number | null
  goals?: string | null
}

export type CampaignBrief = {
  kind: string
  tone?: string | null
  themes?: string[]
  starting_level?: number | null
  inspirations?: string[]
  constraints?: Record<string, unknown> | null
}

export type CampaignWizardDraft = {
  kind: string
  tone: string | null
  themes: string[]
  starting_level: number | null
  inspirations: string[]
  constraints: Record<string, unknown> | null
}

export type CampaignWizardAutogenerateRequest = { step: 0 | 1 | 2 | 3; wizard: CampaignWizardDraft }
export type CampaignWizardAutogenerateResponse = {
  step: number
  patch: Partial<CampaignWizardDraft>
}

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      ...init,
    })
  } catch (e) {
    throw new ApiError(
      'No se pudo conectar con el backend (¿está levantado?).',
      0,
      e instanceof Error ? e.message : e,
    )
  }
  if (!res.ok) {
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      body = await res.text().catch(() => null)
    }
    throw new ApiError(`API ${res.status} ${res.statusText}`, res.status, body)
  }
  return (await res.json()) as T
}

export const api = {
  // Campaigns
  listCampaigns: (limit = 50, offset = 0) =>
    request<Campaign[]>(`/api/campaigns?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`),
  createCampaign: (payload: CampaignCreate) => request<Campaign>(`/api/campaigns`, { method: 'POST', body: JSON.stringify(payload) }),
  getCampaign: (id: UUID) => request<Campaign>(`/api/campaigns/${id}`),
  patchCampaign: (id: UUID, payload: CampaignUpdate) =>
    request<Campaign>(`/api/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  setBrief: (id: UUID, payload: CampaignBrief) =>
    request<Campaign>(`/api/campaigns/${id}/brief`, { method: 'POST', body: JSON.stringify(payload) }),
  autogenerateCampaignWizardStep: (payload: CampaignWizardAutogenerateRequest) =>
    request<CampaignWizardAutogenerateResponse>(`/api/campaigns:wizard/autogenerate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  approveBrief: (id: UUID) => request<Campaign>(`/api/campaigns/${id}/brief/approve`, { method: 'POST', body: '{}' }),
  reopenCampaign: (id: UUID) => request<Campaign>(`/api/campaigns/${id}/reopen`, { method: 'POST', body: '{}' }),
  patchCampaignStoryDraft: (id: UUID, story_draft: string) =>
    request<Campaign>(`/api/campaigns/${id}/story`, {
      method: 'PATCH',
      body: JSON.stringify({ story_draft }),
    }),
  resetCampaignStoryDraft: (id: UUID) =>
    request<Campaign>(`/api/campaigns/${id}/story/reset`, {
      method: 'POST',
      body: '{}',
    }),
  generateWorldForCampaign: (id: UUID) =>
    request<Campaign>(`/api/campaigns/${id}/world:generate`, { method: 'POST', body: '{}' }),
  deleteCampaign: (id: UUID) => request<{ ok: boolean }>(`/api/campaigns/${id}`, { method: 'DELETE' }),
  listSessionsForCampaign: (campaignId: UUID, limit = 50, offset = 0) =>
    request<Session[]>(
      `/api/campaigns/${campaignId}/sessions?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`,
    ),
  getSession: (sessionId: UUID) => request<Session>(`/api/sessions/${sessionId}`),
  patchSession: (sessionId: UUID, payload: SessionUpdate) =>
    request<Session>(`/api/sessions/${sessionId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteSession: (sessionId: UUID) => request<{ ok: boolean }>(`/api/sessions/${sessionId}`, { method: 'DELETE' }),
  extendSession: (sessionId: UUID) => request<Session>(`/api/sessions/${sessionId}/extend`, { method: 'POST', body: '{}' }),
  generateSessionsForCampaign: (campaignId: UUID, sessionCount: number) =>
    request<Session[]>(
      `/api/campaigns/${campaignId}/sessions:generate?session_count=${encodeURIComponent(sessionCount)}`,
      { method: 'POST', body: '{}' },
    ),
  generatePlayersForCampaign: (campaignId: UUID, playerCount: number) =>
    request<PlayerProfile[]>(
      `/api/campaigns/${campaignId}/players:generate?player_count=${encodeURIComponent(playerCount)}`,
      { method: 'POST', body: '{}' },
    ),
  listPlayersForCampaign: (campaignId: UUID) =>
    request<PlayerProfile[]>(`/api/campaigns/${campaignId}/players`),
  deletePlayerForCampaign: (campaignId: UUID, playerId: string) =>
    request<PlayerProfile[]>(`/api/campaigns/${campaignId}/players/${encodeURIComponent(playerId)}`, { method: 'DELETE' }),

  // Worlds
  listWorlds: (limit = 50, offset = 0) =>
    request<World[]>(`/api/worlds?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`),
  getWorld: (id: UUID) => request<World>(`/api/worlds/${id}`),
  createWorld: (payload: WorldCreate) => request<World>(`/api/worlds`, { method: 'POST', body: JSON.stringify(payload) }),
  generateWorld: (payload: WorldGenerate) =>
    request<World>(`/api/worlds:generate`, { method: 'POST', body: JSON.stringify(payload) }),
  generateWorldForExistingWorld: (id: UUID, payload: WorldGenerate) =>
    request<World>(`/api/worlds/${id}/generate`, { method: 'POST', body: JSON.stringify(payload) }),
  autogenerateWorldWizardStep: (payload: WorldWizardAutogenerateRequest) =>
    request<WorldWizardAutogenerateResponse>(`/api/worlds:wizard/autogenerate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getWorldUsage: (id: UUID) => request<WorldUsage>(`/api/worlds/${id}/usage`),
  listCampaignsForWorld: (id: UUID, limit = 50, offset = 0) =>
    request<Campaign[]>(`/api/worlds/${id}/campaigns?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`),
  patchWorld: (id: UUID, payload: WorldUpdate) =>
    request<World>(`/api/worlds/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  approveWorld: (id: UUID) => request<World>(`/api/worlds/${id}/approve`, { method: 'POST', body: '{}' }),
  reopenWorld: (id: UUID) => request<World>(`/api/worlds/${id}/reopen`, { method: 'POST', body: '{}' }),
  deleteWorld: (id: UUID) => request<{ ok: boolean }>(`/api/worlds/${id}`, { method: 'DELETE' }),
}

