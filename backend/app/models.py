from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class World(Base):
    __tablename__ = "worlds"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)

    name: Mapped[str] = mapped_column(Text, nullable=False, default="Nuevo mundo", server_default="Nuevo mundo")
    pitch: Mapped[str | None] = mapped_column(Text, nullable=True)
    tone: Mapped[str | None] = mapped_column(Text, nullable=True)
    themes: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    content_draft: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_final: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Mapas, emblemas y retratos generados (JSON: rutas relativas, estado, errores).
    visual_assets: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", server_default="draft")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    world_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("worlds.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    system: Mapped[str] = mapped_column(String(50), nullable=False, default="5e")
    tone: Mapped[str | None] = mapped_column(Text, nullable=True)
    starting_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    goals: Mapped[str | None] = mapped_column(Text, nullable=True)

    brief_draft: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    brief_final: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    brief_status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", server_default="draft")

    # Texto narrativo generado a partir del wizard (RAG+LLM).
    # Se genera al guardar el brief y se valida/aprueba en un segundo paso.
    story_draft: Mapped[str | None] = mapped_column(Text, nullable=True)
    story_final: Mapped[str | None] = mapped_column(Text, nullable=True)

    outline_draft: Mapped[str | None] = mapped_column(Text, nullable=True)
    outline_final: Mapped[str | None] = mapped_column(Text, nullable=True)
    outline_status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", server_default="draft")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    session_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="planned")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_draft: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_final: Mapped[str | None] = mapped_column(Text, nullable=True)
    approval_status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", server_default="draft")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

