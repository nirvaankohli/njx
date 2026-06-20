from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.models.dto import SetupResponse, TenantSetupRequest
from app.services.setup_service import setup_tenant


router = APIRouter(tags=["setup"])


@router.post("/setup", response_model=SetupResponse)
def setup(request: TenantSetupRequest, db: Session = Depends(get_db)) -> SetupResponse:
    return setup_tenant(db, request)

