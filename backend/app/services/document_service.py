from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models.db import DocumentORM, PublicKeyORM, SignatureHistoryEventORM, TenantORM
from app.models.dto import DocumentRegistrationRequest, DocumentRegistrationResponse, EventAppendResponse, SignatureHistoryEvent
from app.services.audit_service import log_action
from app.services.errors import ConflictError, NotFoundError
from app.services.signing_service import HistoryChainResult, event_hash, get_public_key, manifest_hash, verify_event_signature, verify_manifest_signature


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
        history_tip = signed_hash
        previous_hash = signed_hash
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
    assert history_tip is not None
    return history_tip


def register_document(session: Session, request: DocumentRegistrationRequest) -> DocumentRegistrationResponse:
    manifest = request.signed_manifest.manifest
    tenant = session.get(TenantORM, manifest.tenant_id)
    if tenant is None:
        raise NotFoundError(f"Tenant {manifest.tenant_id} not found")
    existing = session.get(DocumentORM, manifest.document_id)
    if existing is not None:
        raise ConflictError(f"Document {manifest.document_id} already exists")

    key = get_public_key(session, manifest.issuer_key_id)
    if key is None:
        raise NotFoundError(f"Issuer key {manifest.issuer_key_id} not found")
    if key.status != "active":
        raise ConflictError(f"Issuer key {manifest.issuer_key_id} is not active")

    if not verify_manifest_signature(key.public_key_b64, request.signed_manifest):
        raise ConflictError("Manifest signature is invalid")

    computed_manifest_hash = manifest_hash(manifest)
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
