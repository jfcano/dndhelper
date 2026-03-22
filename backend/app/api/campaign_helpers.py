"""Helpers compartidos del router de campañas (jugadores persistidos, contexto, mundo)."""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from sqlalchemy import select

from backend.app.models import Campaign, World
from backend.app.owner_context import get_owner_id, is_admin

_PLAYERS_KEY = "__generated_players__"


def _ctx() -> tuple[UUID, bool]:
    return get_owner_id(), is_admin()


def _world_row_stmt(owner_id: UUID, world_id: UUID, adm: bool):
    stmt = select(World).where(World.id == world_id)
    if not adm:
        stmt = stmt.where(World.owner_id == owner_id)
    return stmt


def _get_persisted_players(campaign: Campaign) -> list[dict]:
    sources = [campaign.brief_draft, campaign.brief_final]
    for src in sources:
        if not isinstance(src, dict):
            continue
        players = src.get(_PLAYERS_KEY)
        if isinstance(players, list):
            return [p for p in players if isinstance(p, dict)]
    return []


def _set_persisted_players(campaign: Campaign, players: list[dict]) -> None:
    # Persistimos en brief_draft y, si existe, también en brief_final para campañas aprobadas.
    draft = dict(campaign.brief_draft) if isinstance(campaign.brief_draft, dict) else {}
    draft[_PLAYERS_KEY] = players
    campaign.brief_draft = draft

    if isinstance(campaign.brief_final, dict):
        final = dict(campaign.brief_final)
        final[_PLAYERS_KEY] = players
        campaign.brief_final = final


def _coerce_session_summary_for_db(raw: Any) -> str | None:
    """Normaliza el resumen de sesión devuelto por el LLM para guardarlo en BD (texto o JSON serializado)."""
    if raw is None:
        return None
    if isinstance(raw, str):
        t = raw.replace("\r\n", "\n").strip()
        return t if t else None
    if isinstance(raw, (dict, list)):
        try:
            t = json.dumps(raw, ensure_ascii=False)
            return t.strip() if t.strip() else None
        except (TypeError, ValueError):
            t = str(raw).strip()
            return t if t else None
    t = str(raw).strip()
    return t if t else None
