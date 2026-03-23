export type UUID = string

export type UserPublic = {
  id: UUID
  username: string
  is_admin?: boolean
}

export type AuthTokenResponse = {
  access_token: string
  token_type: string
  user: UserPublic
}

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

/** Ámbito de la consulta en `/api/query_rules`. */
export type QueryScope = 'rules' | 'campaigns_general' | 'campaign'

export type OwnerSettingsStatus = {
  has_stored_openai_key: boolean
}

export type PdfEnqueueResponse = {
  job_id: string
  status: 'queued'
  message: string
  original_filename: string
}

export type UploadRagFileError = {
  filename: string
  detail: string
}

export type UploadRagBatchResponse = {
  queued: PdfEnqueueResponse[]
  errors: UploadRagFileError[]
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

export type RagClearTarget = 'manuals' | 'campaign'

export type RagClearResponse = {
  targets_cleared: string[]
  ingest_jobs_removed: number
  manifest_ingest_keys_removed: number
  campaign_manifest_entries_removed: number
  collections_dropped: string[]
}

/** Destino de la subida: manuales/reglas o referencias de campaña (mismas colecciones que en Consultas). */
export type RagUploadTarget = 'manuals' | 'campaign'

export type SetupStatus = {
  needs_setup: boolean
  setup_available: boolean
}
