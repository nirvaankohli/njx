from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.models.dto import DocumentDetail, DocumentRegistrationRequest, DocumentRegistrationResponse, DocumentSummary, EventAppendResponse, SignatureHistoryEvent
from app.services.document_service import append_history_event, delete_document, get_document, list_documents, register_document


router = APIRouter(tags=["documents"])


@router.post("/documents", response_model=DocumentRegistrationResponse)
def create_document(request: DocumentRegistrationRequest, db: Session = Depends(get_db)) -> DocumentRegistrationResponse:
    return register_document(db, request)


@router.get("/documents", response_model=list[DocumentSummary])
def documents(
    tenant_id: str = Query(...),
    status_filter: Literal["active", "revoked"] | None = Query(default=None, alias="status"),
    query: str | None = Query(default=None, max_length=200),
    db: Session = Depends(get_db),
) -> list[DocumentSummary]:
    return list_documents(db, tenant_id, status=status_filter, query=query)


@router.get("/documents/{document_id}", response_model=DocumentDetail)
def document(document_id: str, tenant_id: str = Query(...), db: Session = Depends(get_db)) -> DocumentDetail:
    return get_document(db, document_id, tenant_id)


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_document(document_id: str, tenant_id: str = Query(...), db: Session = Depends(get_db)) -> Response:
    delete_document(db, document_id, tenant_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/documents/{document_id}/events", response_model=EventAppendResponse)
def add_event(document_id: str, event: SignatureHistoryEvent, db: Session = Depends(get_db)) -> EventAppendResponse:
    return append_history_event(db, document_id, event)
