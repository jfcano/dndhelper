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


class ArcCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    summary: str | None = None
    order_index: int = 0


class ArcUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    summary: str | None = None
    order_index: int | None = None


class ArcOut(BaseModel):
    id: UUID
    campaign_id: UUID
    title: str
    summary: str | None
    order_index: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SessionCreate(BaseModel):
    session_number: int = Field(default=1, ge=1)
    title: str = Field(min_length=1, max_length=200)
    summary: str | None = None
    status: str = Field(default="planned", max_length=20)
    notes: str | None = None


class SessionUpdate(BaseModel):
    session_number: int | None = Field(default=None, ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    summary: str | None = None
    status: str | None = Field(default=None, min_length=1, max_length=20)
    notes: str | None = None


class SessionOut(BaseModel):
    id: UUID
    campaign_id: UUID
    arc_id: UUID
    session_number: int
    title: str
    summary: str | None
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

