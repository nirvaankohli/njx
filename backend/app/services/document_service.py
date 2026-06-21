from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.models.db import (
    AccessEventORM,
    AnomalyModelStateORM,
    DocumentContentORM,
    DocumentORM,
    PublicKeyORM,
    ShareLinkORM,
    SignatureHistoryEventORM,
    TenantORM,
    VerificationLogORM,
)
from app.models.dto import (
    DocumentDetail,
    DocumentRegistrationRequest,
    DocumentRegistrationResponse,
    DocumentSummary,
    EventAppendResponse,
    SignatureHistoryEvent,
)
from app.services.blob_storage_service import delete_encrypted_blob
from app.services.audit_service import log_action
from app.services.errors import ConflictError, NotFoundError
from app.services.signing_service import HistoryChainResult, event_hash, get_public_key, manifest_hash, verify_event_signature, verify_manifest_signature


def _document_summary(session: Session, document: DocumentORM) -> DocumentSummary:
    content = session.get(DocumentContentORM, document.document_id)
    latest_link = session.scalar(
        select(ShareLinkORM)
        .where(ShareLinkORM.document_id == document.document_id, ShareLinkORM.status == "active")
        .order_by(ShareLinkORM.created_at.desc())
        .limit(1)
    )
    event_count = session.scalar(
        select(func.count()).select_from(SignatureHistoryEventORM).where(SignatureHistoryEventORM.document_id == document.document_id)
    )
    return DocumentSummary(
        document_id=document.document_id,
        tenant_id=document.tenant_id,
        issuer_key_id=document.issuer_key_id,
        content_fingerprint=document.content_fingerprint,
        policy=document.policy,
        embedded_ai_tags=document.embedded_ai_tags,
        created_at=document.created_at,
        status=document.status,
        file_name=content.file_name if content else None,
        content_type=content.content_type if content else None,
        size_bytes=content.size_bytes if content else None,
        access_method=latest_link.access_method if latest_link else None,
        event_count=event_count or 0,
    )


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def list_documents(
    session: Session,
    tenant_id: str,
    *,
    status: str | None = None,
    query: str | None = None,
) -> list[DocumentSummary]:
    statement = select(DocumentORM).where(DocumentORM.tenant_id == tenant_id)
    if status:
        statement = statement.where(DocumentORM.status == status)
    if query:
        pattern = f"%{query.strip()}%"
        statement = statement.outerjoin(DocumentContentORM).where(
            or_(DocumentORM.document_id.ilike(pattern), DocumentContentORM.file_name.ilike(pattern))
        )
    documents = session.scalars(statement.order_by(DocumentORM.created_at.desc())).all()
    return [_document_summary(session, document) for document in documents]


def get_document(session: Session, document_id: str, tenant_id: str) -> DocumentDetail:
    document = session.get(DocumentORM, document_id)
    if document is None or document.tenant_id != tenant_id:
        raise NotFoundError(f"Document {document_id} not found")
    return DocumentDetail(
        **_document_summary(session, document).model_dump(),
        manifest=document.manifest,
        manifest_hash=document.manifest_hash,
        history_tip=document.history_tip,
        history=[
            SignatureHistoryEvent(
                event_id=event.event_id,
                document_id=event.document_id,
                event=event.event,
                actor_org=event.actor_org,
                actor_key_id=event.actor_key_id,
                timestamp=event.timestamp,
                previous_event_hash=event.previous_event_hash,
                manifest_hash=event.manifest_hash,
                payload=event.payload,
                signature=event.signature,
            )
            for event in document.events
        ],
        last_verified_status=document.last_verified_status,
        last_verified_at=document.last_verified_at,
    )


def delete_document(session: Session, document_id: str, tenant_id: str) -> None:
    document = session.get(DocumentORM, document_id)
    if document is None or document.tenant_id != tenant_id:
        raise NotFoundError(f"Document {document_id} not found")

    content = session.get(DocumentContentORM, document_id)
    log_action(
        session,
        action="document_deleted",
        tenant_id=tenant_id,
        document_id=document_id,
        details={"file_name": content.file_name if content else None},
    )
    if content is not None and content.storage_key:
        delete_encrypted_blob(content.storage_key)
    for model in (
        VerificationLogORM,
        AnomalyModelStateORM,
        AccessEventORM,
        SignatureHistoryEventORM,
        ShareLinkORM,
        DocumentContentORM,
    ):
        session.execute(delete(model).where(model.document_id == document_id))
    session.delete(document)
    session.commit()


def _validate_event_common(
    session: Session,
    *,
    document_id: str,
    event: SignatureHistoryEvent,
    expected_manifest_hash: str,
    expected_previous_event_hash: str | None,
    require_active_key: bool = True,
) -> tuple[HistoryChainResult, str, PublicKeyORM]:
    if event.document_id != document_id:
        raise ConflictError("Event document_id does not match path document_id")
    if event.manifest_hash != expected_manifest_hash:
        raise ConflictError("Event manifest hash does not match document manifest hash")
    key = get_public_key(session, event.actor_key_id)
    if key is None:
        raise NotFoundError(f"Public key {event.actor_key_id} not found")
    if require_active_key and key.status != "active":
        raise ConflictError(f"Public key {event.actor_key_id} is not active")
    if event.previous_event_hash != expected_previous_event_hash:
        raise ConflictError("Event previous_event_hash does not match current history tip")
    if not verify_event_signature(key.public_key_b64, event):
        raise ConflictError("Event signature is invalid")
    signed_hash = event_hash(event)
    return HistoryChainResult(valid=True, reasons=[]), signed_hash, key


def validate_history_chain(
    session: Session,
    *,
    document_id: str,
    expected_manifest_hash: str,
    history: list[SignatureHistoryEvent],
) -> str:
    if not history:
        raise ConflictError("initial_history must include at least one signed event")

    previous_hash: str | None = None
    history_tip: str | None = None
    for event in history:
        _, signed_hash, _ = _validate_event_common(
            session,
            document_id=document_id,
            event=event,
            expected_manifest_hash=expected_manifest_hash,
            expected_previous_event_hash=previous_hash,
        )
        history_tip = signed_hash
        previous_hash = signed_hash
    assert history_tip is not None
    return history_tip


def validate_and_store_history(
    session: Session,
    *,
    document_id: str,
    expected_manifest_hash: str,
    history: list[SignatureHistoryEvent],
    replace_existing: bool = False,
) -> str:
    if not history:
        raise ConflictError("initial_history must include at least one signed event")

    if replace_existing:
        session.execute(delete(SignatureHistoryEventORM).where(SignatureHistoryEventORM.document_id == document_id))

    previous_hash: str | None = None
    history_tip: str | None = None
    for event in history:
        _, signed_hash, _ = _validate_event_common(
            session,
            document_id=document_id,
            event=event,
            expected_manifest_hash=expected_manifest_hash,
            expected_previous_event_hash=previous_hash,
        )
        session.add(
            SignatureHistoryEventORM(
                event_id=event.event_id,
                document_id=document_id,
                event=event.event,
                actor_org=event.actor_org,
                actor_key_id=event.actor_key_id,
                timestamp=event.timestamp,
                previous_event_hash=event.previous_event_hash,
                manifest_hash=event.manifest_hash,
                payload=event.payload,
                signature=event.signature,
                event_hash=signed_hash,
            )
        )
        history_tip = signed_hash
    assert history_tip is not None
    return history_tip


def _history_matches_registration(session: Session, document_id: str, history: list[SignatureHistoryEvent]) -> bool:
    stored_history = session.scalars(
        select(SignatureHistoryEventORM)
        .where(SignatureHistoryEventORM.document_id == document_id)
        .order_by(SignatureHistoryEventORM.timestamp, SignatureHistoryEventORM.created_at)
    ).all()
    if len(stored_history) != len(history):
        return False

    for stored_event, incoming_event in zip(stored_history, history, strict=True):
        stored_model = SignatureHistoryEvent(
            event_id=stored_event.event_id,
            document_id=stored_event.document_id,
            event=stored_event.event,
            actor_org=stored_event.actor_org,
            actor_key_id=stored_event.actor_key_id,
            timestamp=_as_utc(stored_event.timestamp),
            previous_event_hash=stored_event.previous_event_hash,
            manifest_hash=stored_event.manifest_hash,
            payload=stored_event.payload,
            signature=stored_event.signature,
        )
        if stored_model.model_dump(mode="json") != incoming_event.model_dump(mode="json"):
            return False
    return True


def register_document(session: Session, request: DocumentRegistrationRequest) -> DocumentRegistrationResponse:
    manifest = request.signed_manifest.manifest
    tenant = session.get(TenantORM, manifest.tenant_id)
    if tenant is None:
        raise NotFoundError(f"Tenant {manifest.tenant_id} not found")

    key = get_public_key(session, manifest.issuer_key_id)
    if key is None:
        raise NotFoundError(f"Issuer key {manifest.issuer_key_id} not found")
    if key.status != "active":
        raise ConflictError(f"Issuer key {manifest.issuer_key_id} is not active")

    if not verify_manifest_signature(key.public_key_b64, request.signed_manifest):
        raise ConflictError("Manifest signature is invalid")

    computed_manifest_hash = manifest_hash(manifest)
    history_tip = validate_history_chain(
        session,
        document_id=manifest.document_id,
        expected_manifest_hash=computed_manifest_hash,
        history=request.initial_history,
    )

    existing = session.get(DocumentORM, manifest.document_id)
    if existing is not None:
        # Replayed browser submissions can legitimately resend the exact same signed payload.
        if _history_matches_registration(session, manifest.document_id, request.initial_history):
            if (
                existing.tenant_id == manifest.tenant_id
                and existing.issuer_key_id == manifest.issuer_key_id
                and existing.manifest_hash == computed_manifest_hash
                and existing.manifest == manifest.model_dump(mode="json")
                and existing.manifest_signature == request.signed_manifest.manifest_signature
                and existing.signature_algorithm == request.signed_manifest.signature_algorithm
                and existing.content_fingerprint == manifest.content_fingerprint
                and existing.policy == manifest.policy
                and existing.embedded_ai_tags == manifest.embedded_ai_tags
                and existing.history_tip == history_tip
            ):
                return DocumentRegistrationResponse(
                    document_id=manifest.document_id,
                    manifest_hash=computed_manifest_hash,
                    status="registered",
                    history_tip=history_tip,
                )
        raise ConflictError(f"Document {manifest.document_id} already exists")

    history_tip = validate_and_store_history(
        session,
        document_id=manifest.document_id,
        expected_manifest_hash=computed_manifest_hash,
        history=request.initial_history,
    )

    session.add(
        DocumentORM(
            document_id=manifest.document_id,
            tenant_id=manifest.tenant_id,
            issuer_key_id=manifest.issuer_key_id,
            manifest=manifest.model_dump(mode="json"),
            manifest_hash=computed_manifest_hash,
            manifest_signature=request.signed_manifest.manifest_signature,
            signature_algorithm=request.signed_manifest.signature_algorithm,
            content_fingerprint=manifest.content_fingerprint,
            policy=manifest.policy,
            embedded_ai_tags=manifest.embedded_ai_tags,
            created_at=manifest.created_at,
            history_tip=history_tip,
            status="active",
        )
    )
    log_action(
        session,
        action="document_registered",
        tenant_id=manifest.tenant_id,
        document_id=manifest.document_id,
        details={"manifest_hash": computed_manifest_hash, "history_tip": history_tip},
    )
    session.commit()
    return DocumentRegistrationResponse(
        document_id=manifest.document_id,
        manifest_hash=computed_manifest_hash,
        status="registered",
        history_tip=history_tip,
    )


def append_history_event(session: Session, document_id: str, event: SignatureHistoryEvent) -> EventAppendResponse:
    document = session.get(DocumentORM, document_id)
    if document is None:
        raise NotFoundError(f"Document {document_id} not found")
    if event.document_id != document_id:
        raise ConflictError("Event document_id does not match path document_id")

    key = get_public_key(session, event.actor_key_id)
    if key is None:
        raise NotFoundError(f"Public key {event.actor_key_id} not found")
    if key.status != "active":
        raise ConflictError(f"Public key {event.actor_key_id} is not active")
    if event.manifest_hash != document.manifest_hash:
        raise ConflictError("Event manifest hash does not match stored document manifest hash")
    if event.previous_event_hash != document.history_tip:
        raise ConflictError("Event previous_event_hash does not match current history tip")
    if not verify_event_signature(key.public_key_b64, event):
        raise ConflictError("Event signature is invalid")

    signed_hash = event_hash(event)
    session.add(
        SignatureHistoryEventORM(
            event_id=event.event_id,
            document_id=document_id,
            event=event.event,
            actor_org=event.actor_org,
            actor_key_id=event.actor_key_id,
            timestamp=event.timestamp,
            previous_event_hash=event.previous_event_hash,
            manifest_hash=event.manifest_hash,
            payload=event.payload,
            signature=event.signature,
            event_hash=signed_hash,
        )
    )
    document.history_tip = signed_hash
    if event.event == "revoked":
        document.status = "revoked"
        document.revoked_at = datetime.now(timezone.utc)
    log_action(
        session,
        action="history_event_appended",
        tenant_id=document.tenant_id,
        document_id=document_id,
        details={"event_id": event.event_id, "event": event.event, "history_tip": signed_hash},
    )
    session.commit()
    return EventAppendResponse(
        document_id=document_id,
        event_id=event.event_id,
        accepted=True,
        history_tip=signed_hash,
    )
