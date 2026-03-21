export type UUID = string

/** Hueco de imagen: `planned_file` fijo; `file` se rellena tras generar con IA. */
export type WorldVisualSlot = {
  planned_file: string
  file?: string | null
  error?: string | null
  label?: string
  name?: string
  faction_name?: string
  /** Para retratos: se envían al prompt de imagen si existen. */
  gender?: string | null
  appearance?: string | null
  kind?: string
}

/** Plantilla + imágenes generadas bajo demanda (mapas, emblemas, retratos). */
export type WorldVisualAssets = {
  status?: string
  source?: string
  message?: string
  error?: string
  warnings?: string[]
  world_map?: (WorldVisualSlot & { label?: string }) | null
  city_maps?: WorldVisualSlot[]
  faction_emblems?: WorldVisualSlot[]
  character_portraits?: WorldVisualSlot[]
}

export type WorldVisualGeneratePayload = {
  target: 'world_map' | 'city_map' | 'faction_emblem' | 'character_portrait'
  index?: number
}

export type World = {
  id: UUID
  owner_id: UUID
  name: string
  pitch: string | null
  tone: string | null
  themes: Record<string, unknown> | null
  content_draft: string | null
  content_final: string | null
  visual_assets?: WorldVisualAssets | null
  status: string
  created_at: string
  updated_at: string
}

/**
 * URL de una imagen persistida del mundo (sirve el backend).
 * `cacheBuster` (p. ej. `world.updated_at`) evita que el navegador muestre la PNG antigua tras regenerar con la misma ruta.
 */
export function worldImageUrl(worldId: UUID, filename: string, cacheBuster?: string | null): string {
  const base = `/api/worlds/${worldId}/image/${encodeURIComponent(filename)}`
  if (cacheBuster == null || cacheBuster === '') return base
  const v = encodeURIComponent(cacheBuster)
  return `${base}?v=${v}`
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
  content_draft: string | null
  content_final: string | null
  approval_status: string
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
  content_draft: string | null
  content_final: string | null
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
  /** Opcional; mejora retratos con IA */
  gender?: string
  appearance?: string
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

export type RagRulesSource = {
  source: unknown
  page: unknown
}

export type RagRulesResponse = {
  answer: string
  sources: RagRulesSource[]
}

export type OwnerSettingsStatus = {
  has_stored_openai_key: boolean
  env_openai_key_configured: boolean
}

export type PdfEnqueueResponse = {
  job_id: string
  status: 'queued'
  message: string
  original_filename: string
}

export type IngestJobRow = {
  id: string
  original_filename: string
  status: string
  progress_percent: number
  phase_label: string | null
  outcome: string | null
  message: string | null
  error_detail: string | null
  chunks_indexed: number | null
  pdf_sha256: string | null
  collection_name: string | null
  created_at: string
  updated_at: string
}

export type IngestJobDeleteResult = {
  action: 'deleted' | 'cancel_requested'
  job_id: string
}

/** Sube un PDF para indexación RAG (multipart; no usar `request` JSON). Respuesta 202 Accepted. */
export async function uploadRulesPdf(file: File): Promise<PdfEnqueueResponse> {
  const formData = new FormData()
  formData.append('file', file)
  let res: Response
  try {
    res = await fetch('/api/upload_pdf', {
      method: 'POST',
      body: formData,
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
  return (await res.json()) as PdfEnqueueResponse
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
  queryRules: (question: string) =>
    request<RagRulesResponse>(`/api/query_rules`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),

  listRagIngestJobs: (limit = 50) =>
    request<IngestJobRow[]>(`/api/ingest_jobs?limit=${encodeURIComponent(limit)}`),

  deleteRagIngestJob: (jobId: string) =>
    request<IngestJobDeleteResult>(`/api/ingest_jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' }),

  getOwnerSettings: () => request<OwnerSettingsStatus>('/api/settings'),

  putOwnerOpenaiKey: (openai_api_key: string) =>
    request<OwnerSettingsStatus>('/api/settings/openai', {
      method: 'PUT',
      body: JSON.stringify({ openai_api_key }),
    }),

  deleteOwnerOpenaiKey: () =>
    request<OwnerSettingsStatus>('/api/settings/openai', {
      method: 'DELETE',
    }),

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
  deleteCampaign: (id: UUID, options?: { cascade?: boolean }) => {
    const q = options?.cascade ? '?cascade=true' : ''
    return request<{ ok: boolean }>(`/api/campaigns/${id}${q}`, { method: 'DELETE' })
  },
  listSessionsForCampaign: (campaignId: UUID, limit = 50, offset = 0) =>
    request<Session[]>(
      `/api/campaigns/${campaignId}/sessions?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`,
    ),
  /** Todas las sesiones del propietario (todas las campañas). `/all-sessions` evita colisión con `/sessions/{uuid}`. */
  listSessions: (limit = 50, offset = 0) =>
    request<Session[]>(
      `/api/all-sessions?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`,
    ),
  getSession: (sessionId: UUID) => request<Session>(`/api/sessions/${sessionId}`),
  patchSession: (sessionId: UUID, payload: SessionUpdate) =>
    request<Session>(`/api/sessions/${sessionId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  approveSession: (sessionId: UUID) =>
    request<Session>(`/api/sessions/${sessionId}/approve`, { method: 'POST', body: '{}' }),
  /**
   * Vuelve a borrador una sesión aprobada.
   * Incluye trazas en consola (`[dndhelper session reopen]`) para depurar proxy/404/CORS.
   */
  reopenSession: async (sessionId: UUID) => {
    const path = `/api/sessions/${sessionId}/reopen`
    const tag = '[dndhelper session reopen]'
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0
    const snap = (extra?: Record<string, unknown>) => ({
      sessionId,
      path,
      absoluteUrl:
        typeof window !== 'undefined' ? new URL(path, window.location.origin).href : path,
      pageUrl: typeof window !== 'undefined' ? window.location.href : null,
      elapsedMs: typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : null,
      ...extra,
    })

    console.info(`${tag} → fetch start`, snap())

    let res: Response
    try {
      res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
    } catch (e) {
      console.error(`${tag} → fetch lanzó excepción (red/CORS/servidor caído)`, snap({ error: String(e) }))
      throw new ApiError(
        'No se pudo conectar con el backend (¿está levantado?).',
        0,
        e instanceof Error ? e.message : e,
      )
    }

    const rawText = await res.text()
    let parsedBody: unknown = rawText
    try {
      parsedBody = rawText ? JSON.parse(rawText) : null
    } catch {
      /* cuerpo no JSON */
    }

    console.info(`${tag} → respuesta HTTP`, snap({ status: res.status, statusText: res.statusText, ok: res.ok, body: parsedBody }))

    if (!res.ok) {
      console.error(`${tag} → error API`, snap({ status: res.status, body: parsedBody }))
      throw new ApiError(`API ${res.status} ${res.statusText}`, res.status, parsedBody)
    }

    return parsedBody as Session
  },
  deleteSession: (sessionId: UUID) => request<{ ok: boolean }>(`/api/sessions/${sessionId}`, { method: 'DELETE' }),
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
  generateWorldVisual: (id: UUID, payload: WorldVisualGeneratePayload) =>
    request<World>(`/api/worlds/${id}/visual:generate`, {
      method: 'POST',
      body: JSON.stringify({
        target: payload.target,
        index: payload.index ?? 0,
      }),
    }),
  patchWorld: (id: UUID, payload: WorldUpdate) =>
    request<World>(`/api/worlds/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  approveWorld: (id: UUID) => request<World>(`/api/worlds/${id}/approve`, { method: 'POST', body: '{}' }),
  reopenWorld: (id: UUID) => request<World>(`/api/worlds/${id}/reopen`, { method: 'POST', body: '{}' }),
  deleteWorld: (id: UUID, options?: { cascade?: boolean }) => {
    const q = options?.cascade ? '?cascade=true' : ''
    return request<{ ok: boolean }>(`/api/worlds/${id}${q}`, { method: 'DELETE' })
  },
}

