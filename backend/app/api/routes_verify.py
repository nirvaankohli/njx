from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.models.dto import VerifyRequest, VerifyResult
from app.services.verification_service import verify_passport


router = APIRouter(tags=["verify"])


@router.post("/verify", response_model=VerifyResult)
def verify(request: VerifyRequest, db: Session = Depends(get_db)) -> VerifyResult:
    return verify_passport(db, request)

