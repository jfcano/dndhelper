from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    system: str = Field(default="5e", min_length=1, max_length=50)
    tone: str | None = Field(default=None, max_length=120)
    starting_level: int | None = None
    goals: str | None = None


class CampaignUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    system: str | None = Field(default=None, min_length=1, max_length=50)
    tone: str | None = Field(default=None, max_length=120)
    starting_level: int | None = None
    goals: str | None = None


class CampaignOut(BaseModel):
    id: UUID
    name: str
    system: str
    tone: str | None
    starting_level: int | None
    goals: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

