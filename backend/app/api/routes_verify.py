from __future__ import annotations

import hashlib

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.models.dto import UsageContext, VerifyRequest, VerifyResult
from app.services.embedded_document_service import extract_encrypted_passport
from app.services.verification_service import verify_passport, verify_registered_fingerprint


router = APIRouter(tags=["verify"])
MAX_UPLOAD_BYTES = 25 * 1024 * 1024


@router.post("/verify", response_model=VerifyResult)
def verify(request: VerifyRequest, db: Session = Depends(get_db)) -> VerifyResult:
    return verify_passport(db, request)


@router.post("/verify/file", response_model=VerifyResult)
async def verify_file(
    request: Request,
    operation: str = Query(default="authenticity_check"),
    app: str | None = Query(default="docshield_web"),
    db: Session = Depends(get_db),
) -> VerifyResult:
    """Hash an uploaded file and verify its registry-backed Ed25519 signatures."""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 25 MB upload limit")

    hasher = hashlib.sha256()
    content = bytearray()
    bytes_read = 0
    async for chunk in request.stream():
        bytes_read += len(chunk)
        if bytes_read > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="File exceeds the 25 MB upload limit")
        hasher.update(chunk)
        content.extend(chunk)
    if bytes_read == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    embedded = extract_encrypted_passport(bytes(content))
    if embedded is not None:
        _, embedded_request = embedded
        embedded_request.usage_context = UsageContext(operation=operation, app=app)
        return verify_passport(db, embedded_request)

    fingerprint = f"sha256:{hasher.hexdigest()}"
    return verify_registered_fingerprint(
        db,
        fingerprint=fingerprint,
        usage_context=UsageContext(operation=operation, app=app),
    )
