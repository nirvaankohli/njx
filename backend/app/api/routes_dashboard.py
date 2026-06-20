from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.models.dto import AuditExportResponse, DashboardResponse
from app.services.telemetry_service import build_audit_export, build_dashboard


router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(
    tenant_id: str = Query(...),
    document_id: str | None = Query(default=None),
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
) -> DashboardResponse:
    return build_dashboard(db, tenant_id, document_id=document_id, from_=from_, to=to)


@router.get("/audit-export", response_model=AuditExportResponse)
def audit_export(
    tenant_id: str = Query(...),
    document_id: str = Query(...),
    db: Session = Depends(get_db),
) -> AuditExportResponse:
    return AuditExportResponse(**build_audit_export(db, tenant_id, document_id))

