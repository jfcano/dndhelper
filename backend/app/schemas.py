from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


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


class WorldOut(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    pitch: str | None
    tone: str | None
    themes: dict | None
    content_draft: str | None
    content_final: str | None
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
    outline_draft: str | None
    outline_final: str | None
    outline_status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ArcCreate(BaseModel):
    title: str = Field(min_length=1)
    summary: str | None = None
    order_index: int = 0


class ArcUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1)
    summary: str | None = None
    order_index: int | None = None
    approval_status: str | None = Field(default=None, min_length=1, max_length=20)


class ArcOut(BaseModel):
    id: UUID
    campaign_id: UUID
    title: str
    summary: str | None
    order_index: int
    approval_status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


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
    notes: str | None = None
    content_draft: str | None = None
    content_final: str | None = None
    approval_status: str | None = Field(default=None, min_length=1, max_length=20)


class SessionOut(BaseModel):
    id: UUID
    campaign_id: UUID
    arc_id: UUID
    session_number: int
    title: str
    summary: str | None
    status: str
    notes: str | None
    content_draft: str | None
    content_final: str | None
    approval_status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

