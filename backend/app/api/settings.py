from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.config import get_settings
from backend.app.db import get_db
from backend.app.models import OwnerSettings
from backend.app.owner_context import get_owner_id
from backend.app.owner_settings_repo import get_owner_settings, upsert_openai_api_key
from backend.app.schemas import OwnerSettingsOpenAIUpdate, OwnerSettingsOut

router = APIRouter(prefix="/settings", tags=["settings"])


def _settings_out(db_row: OwnerSettings | None) -> OwnerSettingsOut:
    has_db = bool(db_row and db_row.openai_api_key and str(db_row.openai_api_key).strip())
    sk = get_settings().openai_api_key
    has_env = bool(sk and str(sk).strip())
    return OwnerSettingsOut(has_stored_openai_key=has_db, env_openai_key_configured=has_env)


@router.get("", response_model=OwnerSettingsOut)
def get_settings_status(db: Session = Depends(get_db)) -> OwnerSettingsOut:
    owner_id = get_owner_id()
    row = get_owner_settings(db, owner_id)
    return _settings_out(row)


@router.put("/openai", response_model=OwnerSettingsOut)
def put_openai_api_key(payload: OwnerSettingsOpenAIUpdate, db: Session = Depends(get_db)) -> OwnerSettingsOut:
    owner_id = get_owner_id()
    row = upsert_openai_api_key(db, owner_id, payload.openai_api_key.strip())
    return _settings_out(row)


@router.delete("/openai", response_model=OwnerSettingsOut)
def delete_openai_api_key(db: Session = Depends(get_db)) -> OwnerSettingsOut:
    owner_id = get_owner_id()
    row = upsert_openai_api_key(db, owner_id, None)
    return _settings_out(row)
