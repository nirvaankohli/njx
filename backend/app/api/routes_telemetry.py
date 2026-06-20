from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.models.dto import AccessEvent, AccessEventResponse
from app.services.telemetry_service import record_access_event


router = APIRouter(tags=["telemetry"])


@router.post("/access-events", response_model=AccessEventResponse)
def access_events(event: AccessEvent, db: Session = Depends(get_db)) -> AccessEventResponse:
    return record_access_event(db, event)

