from __future__ import annotations

from datetime import datetime
from uuid import UUID

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class WorldCreate(BaseModel):
    name: str = Field(default="Nuevo mundo", min_length=1)


class WorldUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    pitch: str | None = None
    tone: str | None = None
    themes: dict | None = None
    content_draft: str | None = None


class WorldWizardFactionInput(BaseModel):
    name: str = Field(min_length=1)
    objective: str = Field(min_length=1)


class WorldWizardCharacterInput(BaseModel):
    name: str = Field(min_length=1)
    faction_name: str = Field(min_length=1)
    role: str = Field(min_length=1)
    motivation: str = Field(min_length=1)
    gender: str = Field(
        default="",
        max_length=120,
        description="Género o presentación (opcional; mejora retratos).",
    )
    appearance: str = Field(
        default="",
        max_length=500,
        description="Rasgos físicos, edad aparente, vestimenta icónica (opcional).",
    )


class WorldWizardCityInput(BaseModel):
    name: str = Field(min_length=1)
    theme: str = Field(min_length=1)
    relations: list[str] = Field(default_factory=list, max_length=20)


class WorldGenerate(BaseModel):
    theme_and_mood: str = Field(min_length=10, description="Temática general, tono y ambiente.")
    factions: list[WorldWizardFactionInput] = Field(min_length=1, max_length=12)
    characters: list[WorldWizardCharacterInput] = Field(min_length=1, max_length=40)
    cities: list[WorldWizardCityInput] = Field(min_length=1, max_length=20)


class WorldWizardDraft(BaseModel):
    theme_and_mood: str = Field(default="")
    factions: list[dict] = Field(default_factory=list, max_length=12)
    characters: list[dict] = Field(default_factory=list, max_length=40)
    cities: list[dict] = Field(default_factory=list, max_length=20)


class WorldWizardAutogenerateRequest(BaseModel):
    step: int = Field(ge=0, le=3)
    wizard: WorldWizardDraft


class WorldVisualGenerateRequest(BaseModel):
    """Genera una sola imagen (mapa, emblema o retrato) bajo demanda."""

    target: Literal["world_map", "city_map", "faction_emblem", "character_portrait"]
    index: int = Field(default=0, ge=0, description="Índice en city_maps / faction_emblems / character_portraits (0 para world_map).")


class WorldOut(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    pitch: str | None
    tone: str | None
    themes: dict | None
    content_draft: str | None
    content_final: str | None
    visual_assets: dict | None = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CampaignBrief(BaseModel):
    kind: str = Field(min_length=1, description="Tipo de campaña (p. ej. sandbox, investigación, épica).")
    tone: str | None = None
    themes: list[str] = Field(default_factory=list)
    starting_level: int | None = Field(default=None, ge=1, le=20)
    inspirations: list[str] = Field(default_factory=list)
    constraints: dict | None = None


class CampaignWizardDraft(BaseModel):
    kind: str = Field(default="")
    tone: str | None = None
    themes: list[str] = Field(default_factory=list, max_length=20)
    starting_level: int | None = Field(default=None, ge=1, le=20)
    inspirations: list[str] = Field(default_factory=list, max_length=20)
    constraints: dict | None = None


class CampaignWizardAutogenerateRequest(BaseModel):
    step: int = Field(ge=0, le=3)
    wizard: CampaignWizardDraft


class CampaignCreate(BaseModel):
    name: str = Field(min_length=1)
    system: str = Field(default="5e", min_length=1, max_length=50)
    tone: str | None = None
    starting_level: int | None = None
    goals: str | None = None


class CampaignUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    system: str | None = Field(default=None, min_length=1, max_length=50)
    tone: str | None = None
    starting_level: int | None = None
    goals: str | None = None
    world_id: UUID | None = None


class CampaignOut(BaseModel):
    id: UUID
    owner_id: UUID
    world_id: UUID | None
    name: str
    system: str
    tone: str | None
    starting_level: int | None
    goals: str | None
    brief_draft: dict | None
    brief_final: dict | None
    brief_status: str
    story_draft: str | None
    story_final: str | None
    outline_draft: str | None
    outline_final: str | None
    outline_status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CampaignStoryUpdate(BaseModel):
    # Permite vaciar el resumen si se manda `null`.
    story_draft: str | None = None


class SessionCreate(BaseModel):
    session_number: int = Field(default=1, ge=1)
    title: str = Field(min_length=1)
    summary: str | None = None
    status: str = Field(default="planned", max_length=20)
    notes: str | None = None


class SessionUpdate(BaseModel):
    session_number: int | None = Field(default=None, ge=1)
    title: str | None = Field(default=None, min_length=1)
    summary: str | None = None
    status: str | None = Field(default=None, min_length=1, max_length=20)
    content_draft: str | None = None
    content_final: str | None = None


class SessionOut(BaseModel):
    id: UUID
    campaign_id: UUID
    session_number: int
    title: str
    summary: str | None
    status: str
    content_draft: str | None
    content_final: str | None
    approval_status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OwnerSettingsOut(BaseModel):
    """Estado de claves en Ajustes (nunca se devuelven secretos)."""

    has_stored_openai_key: bool


class OwnerSettingsOpenAIUpdate(BaseModel):
    openai_api_key: str = Field(
        min_length=8,
        description="Clave de API de OpenAI (sk-...).",
    )


class IngestJobOut(BaseModel):
    """Estado de un trabajo de indexación RAG (sin datos sensibles del PDF)."""

    id: UUID
    original_filename: str
    status: str
    progress_percent: int
    phase_label: str | None
    outcome: str | None
    message: str | None
    error_detail: str | None
    chunks_indexed: int | None
    pdf_sha256: str | None
    collection_name: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PdfEnqueueResponse(BaseModel):
    job_id: UUID
    status: Literal["queued"] = "queued"
    message: str
    original_filename: str


class UploadRagFileError(BaseModel):
    filename: str
    detail: str


class UploadRagBatchResponse(BaseModel):
    """Respuesta de subida de uno o varios manuales (PDF, TXT, DOCX)."""

    queued: list[PdfEnqueueResponse]
    errors: list[UploadRagFileError] = Field(default_factory=list)


class IngestJobDeleteResponse(BaseModel):
    """Resultado de cancelar o borrar un trabajo de ingesta."""

    action: Literal["deleted", "cancel_requested"]
    job_id: UUID


class RagClearRequest(BaseModel):
    """Vaciar colecciones vectoriales del usuario y borrar trabajos/ficheros de subida asociados."""

    targets: list[Literal["manuals", "campaign"]] = Field(
        ...,
        min_length=1,
        description='Uno o ambos: "manuals" (manuales/reglas) y/o "campaign" (referencias de campaña).',
    )
    target_owner_id: UUID | None = Field(
        default=None,
        description="Solo administradores: UUID del usuario cuyas colecciones se vacían.",
    )


class RagClearResponse(BaseModel):
    targets_cleared: list[str]
    ingest_jobs_removed: int
    manifest_ingest_keys_removed: int
    campaign_manifest_entries_removed: int
    collections_dropped: list[str]


class UserRegister(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username", mode="before")
    @classmethod
    def _strip_username(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v


class UserLogin(BaseModel):
    username: str = Field(min_length=1, max_length=32)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("username", mode="before")
    @classmethod
    def _strip_username(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v


class UserPublic(BaseModel):
    id: UUID
    username: str
    is_admin: bool = False

    model_config = ConfigDict(from_attributes=True)


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic

