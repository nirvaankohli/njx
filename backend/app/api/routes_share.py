from __future__ import annotations

from urllib.parse import quote

from fastapi import APIRouter, Depends, Header, Request, Response
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.models.dto import ShareAnalyticsResponse, ShareDocumentResponse, ShareLinkCreateRequest, ShareLinkResponse
from app.services.share_service import (
    authorize_share,
    create_share_link,
    describe_share,
    record_share_access,
    resolve_share_link,
    share_analytics,
    store_document_content,
)
from app.services.request_context import detect_browser, detect_client_ip, detect_country


router = APIRouter(tags=["secure-sharing"])
MAX_UPLOAD_BYTES = 25 * 1024 * 1024


@router.put("/documents/{document_id}/content", status_code=204)
async def upload_content(
    document_id: str,
    request: Request,
    x_file_name: str = Header(...),
    db: Session = Depends(get_db),
) -> Response:
    content = await request.body()
    if not content:
        return Response(status_code=400, content="Document content is empty")
    if len(content) > MAX_UPLOAD_BYTES:
        return Response(status_code=413, content="File exceeds the 25 MB upload limit")
    store_document_content(
        db,
        document_id=document_id,
        content=content,
        file_name=x_file_name,
        content_type=request.headers.get("content-type", "application/octet-stream"),
    )
    return Response(status_code=204)


@router.post("/documents/{document_id}/share-links", response_model=ShareLinkResponse)
def create_link(document_id: str, payload: ShareLinkCreateRequest, db: Session = Depends(get_db)) -> ShareLinkResponse:
    return create_share_link(db, document_id, payload)


@router.get("/documents/{document_id}/share-analytics", response_model=ShareAnalyticsResponse)
def analytics(document_id: str, db: Session = Depends(get_db)) -> ShareAnalyticsResponse:
    return share_analytics(db, document_id)


@router.get("/shares/{token}", response_model=ShareDocumentResponse)
def shared_document(token: str, request: Request, db: Session = Depends(get_db)) -> ShareDocumentResponse:
    link, _, _ = resolve_share_link(db, token)
    record_share_access(
        db,
        link=link,
        action="open",
        country=detect_country(request.headers),
        browser=detect_browser(request.headers.get("user-agent")),
        client_ip=detect_client_ip(request.headers, request.client.host if request.client else None),
        user_agent=request.headers.get("user-agent"),
    )
    return describe_share(db, token)


@router.get("/shares/{token}/download")
def download_shared_document(
    token: str,
    request: Request,
    x_share_password_hash: str | None = Header(default=None),
    x_tenant_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Response:
    link, _, content = resolve_share_link(db, token)
    authorize_share(link, password_hash=x_share_password_hash, tenant_id=x_tenant_id)
    record_share_access(
        db,
        link=link,
        action="download",
        country=detect_country(request.headers),
        browser=detect_browser(request.headers.get("user-agent")),
        client_ip=detect_client_ip(request.headers, request.client.host if request.client else None),
        user_agent=request.headers.get("user-agent"),
    )
    return Response(
        content=content.content,
        media_type=content.content_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(content.file_name)}"},
    )
