from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.models.dto import AccessEvent, AccessEventFeedResponse, AccessEventResponse
from app.services.telemetry_service import build_access_events_feed, record_access_event


router = APIRouter(tags=["telemetry"])


@router.get("/access-events", response_model=AccessEventFeedResponse)
def access_events_feed(
    tenant_id: str = Query(...),
    limit: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
) -> AccessEventFeedResponse:
    return build_access_events_feed(db, tenant_id, limit=limit)


@router.post("/access-events", response_model=AccessEventResponse)
def access_events(event: AccessEvent, db: Session = Depends(get_db)) -> AccessEventResponse:
    return record_access_event(db, event)
