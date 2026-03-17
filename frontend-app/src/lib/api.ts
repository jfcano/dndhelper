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
  outline_draft: string | null
  outline_final: string | null
  outline_status: string
  created_at: string
  updated_at: string
}

export type WorldCreate = { name?: string }
export type WorldUpdate = Partial<Pick<World, 'name' | 'pitch' | 'tone' | 'themes' | 'content_draft'>>

export type CampaignUpdate = {
  name?: string
  system?: string
  tone?: string | null
  starting_level?: number | null
  goals?: string | null
  world_id?: UUID | null
}

class ApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
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
  getCampaign: (id: UUID) => request<Campaign>(`/api/campaigns/${id}`),
  patchCampaign: (id: UUID, payload: CampaignUpdate) =>
    request<Campaign>(`/api/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  // Worlds
  listWorlds: (limit = 50, offset = 0) =>
    request<World[]>(`/api/worlds?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`),
  getWorld: (id: UUID) => request<World>(`/api/worlds/${id}`),
  createWorld: (payload: WorldCreate) => request<World>(`/api/worlds`, { method: 'POST', body: JSON.stringify(payload) }),
  patchWorld: (id: UUID, payload: WorldUpdate) =>
    request<World>(`/api/worlds/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  approveWorld: (id: UUID) => request<World>(`/api/worlds/${id}/approve`, { method: 'POST', body: '{}' }),
}

