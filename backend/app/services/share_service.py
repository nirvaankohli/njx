from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.db import AccessEventORM, DocumentContentORM, DocumentORM, ShareLinkORM
from app.models.dto import ShareAnalyticsResponse, ShareDocumentResponse, ShareLinkCreateRequest, ShareLinkResponse
from app.security.hashes import sha256_hex
from app.services.embedded_document_service import embed_encrypted_passport
from app.services.errors import ConflictError, DocShieldError, NotFoundError


def store_document_content(
    session: Session,
    *,
    document_id: str,
    content: bytes,
    file_name: str,
    content_type: str,
) -> None:
    document = session.get(DocumentORM, document_id)
    if document is None:
        raise NotFoundError(f"Document {document_id} not found")
    protected_content = embed_encrypted_passport(session, document_id, content)
    row = session.get(DocumentContentORM, document_id)
    if row is None:
        row = DocumentContentORM(document_id=document_id, file_name=file_name, content_type=content_type, content=protected_content, size_bytes=len(protected_content))
    else:
        row.file_name = file_name
        row.content_type = content_type
        row.content = protected_content
        row.size_bytes = len(protected_content)
    session.add(row)
    session.commit()


def create_share_link(session: Session, document_id: str, request: ShareLinkCreateRequest) -> ShareLinkResponse:
    document = session.get(DocumentORM, document_id)
    if document is None:
        raise NotFoundError(f"Document {document_id} not found")
    if session.get(DocumentContentORM, document_id) is None:
        raise ConflictError("Upload the signed document content before creating a share link")
    if request.access_method == "password" and not request.password_hash:
        raise ConflictError("A password hash is required for password-protected links")

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=request.expires_in_hours) if request.expires_in_hours else None
    link = ShareLinkORM(
        link_id=f"lnk_{secrets.token_hex(8)}",
        document_id=document_id,
        tenant_id=document.tenant_id,
        token_hash=sha256_hex(token.encode()),
        access_method=request.access_method,
        password_hash=request.password_hash,
        expires_at=expires_at,
    )
    session.add(link)
    session.commit()
    return ShareLinkResponse(
        link_id=link.link_id,
        document_id=document_id,
        token=token,
        access_method=link.access_method,
        expires_at=expires_at,
    )


def resolve_share_link(session: Session, token: str) -> tuple[ShareLinkORM, DocumentORM, DocumentContentORM]:
    link = session.scalar(select(ShareLinkORM).where(ShareLinkORM.token_hash == sha256_hex(token.encode())))
    if link is None or link.status != "active":
        raise NotFoundError("Secure link not found")
    expires_at = link.expires_at
    if expires_at and (expires_at.replace(tzinfo=timezone.utc) if expires_at.tzinfo is None else expires_at) <= datetime.now(timezone.utc):
        raise DocShieldError("Secure link has expired", status_code=410)
    document = session.get(DocumentORM, link.document_id)
    content = session.get(DocumentContentORM, link.document_id)
    if document is None or content is None:
        raise NotFoundError("Shared document is unavailable")
    return link, document, content


def describe_share(session: Session, token: str) -> ShareDocumentResponse:
    link, document, content = resolve_share_link(session, token)
    return ShareDocumentResponse(
        link_id=link.link_id,
        document_id=document.document_id,
        file_name=content.file_name,
        content_type=content.content_type,
        size_bytes=content.size_bytes,
        content_fingerprint=document.content_fingerprint,
        issuer_key_id=document.issuer_key_id,
        access_method=link.access_method,
        password_required=link.access_method == "password",
        expires_at=link.expires_at,
    )


def authorize_share(link: ShareLinkORM, *, password_hash: str | None, tenant_id: str | None) -> None:
    if link.access_method == "password" and (not password_hash or not secrets.compare_digest(password_hash, link.password_hash or "")):
        raise DocShieldError("Invalid share password", status_code=403)
    if link.access_method == "organization" and tenant_id != link.tenant_id:
        raise DocShieldError("Organization access required", status_code=403)


def record_share_access(
    session: Session,
    *,
    link: ShareLinkORM,
    action: str,
    country: str | None,
    browser: str,
    client_ip: str | None,
    user_agent: str | None,
) -> None:
    session.add(AccessEventORM(
        event_id=f"acc_{secrets.token_hex(12)}",
        tenant_id=link.tenant_id,
        document_id=link.document_id,
        link_id=link.link_id,
        timestamp=datetime.now(timezone.utc),
        action=action,
        ip_hash=sha256_hex((client_ip or "unknown").encode()),
        user_agent_hash=sha256_hex((user_agent or "unknown").encode()),
        browser=browser,
        country=country,
        result="allowed",
        risk_score=0,
        risk_reasons=[],
    ))
    session.commit()


def share_analytics(session: Session, document_id: str) -> ShareAnalyticsResponse:
    if session.get(DocumentORM, document_id) is None:
        raise NotFoundError(f"Document {document_id} not found")
    events = session.scalars(select(AccessEventORM).where(AccessEventORM.document_id == document_id)).all()
    countries: dict[str, int] = {}
    download_timestamps = []
    download_count = 0
    for event in events:
        country = event.country or "unknown"
        countries[country] = countries.get(country, 0) + 1
        if event.action == "download":
            download_timestamps.append(event.timestamp)
            download_count += 1

    if len(download_timestamps) > 1:
        first_download = min(download_timestamps)
        last_download = max(download_timestamps)
        span_hours = max((last_download - first_download).total_seconds() / 3600.0, 1.0)
    else:
        span_hours = 1.0

    return ShareAnalyticsResponse(
        document_id=document_id,
        opens=sum(event.action == "open" for event in events),
        downloads=download_count,
        download_rate_per_hour=(download_count / span_hours) if events else 0.0,
        countries=countries,
    )
