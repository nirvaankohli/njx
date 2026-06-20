from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.models.dto import DocumentRegistrationRequest, DocumentRegistrationResponse, EventAppendResponse, SignatureHistoryEvent
from app.services.document_service import append_history_event, register_document


router = APIRouter(tags=["documents"])


@router.post("/documents", response_model=DocumentRegistrationResponse)
def create_document(request: DocumentRegistrationRequest, db: Session = Depends(get_db)) -> DocumentRegistrationResponse:
    return register_document(db, request)


@router.post("/documents/{document_id}/events", response_model=EventAppendResponse)
def add_event(document_id: str, event: SignatureHistoryEvent, db: Session = Depends(get_db)) -> EventAppendResponse:
    return append_history_event(db, document_id, event)

