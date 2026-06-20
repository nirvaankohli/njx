from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.db import AccessEventORM, DocumentORM
from app.models.dto import AccessEvent, AccessEventResponse, ActivityItem, AlertItem, DashboardResponse, RevocationSummary, VerificationSummary
from app.services.audit_service import log_action
from app.services.errors import NotFoundError
from app.services.risk_service import compute_risk_signals, severity_for_score


def record_access_event(session: Session, event: AccessEvent) -> AccessEventResponse:
    document = session.get(DocumentORM, event.document_id)
    if document is None:
        raise NotFoundError(f"Document {event.document_id} not found")
    score, reasons = compute_risk_signals(session, event.tenant_id, event.document_id)
    access_event = AccessEventORM(
        event_id=event.event_id,
        tenant_id=event.tenant_id,
        document_id=event.document_id,
        link_id=event.link_id,
        timestamp=event.timestamp,
        action=event.action,
        ip_hash=event.ip_hash,
        user_agent_hash=event.user_agent_hash,
        country=event.country,
        result=event.result,
        reason=event.reason,
        risk_score=score,
        risk_reasons=reasons,
    )
    session.add(access_event)
    log_action(
        session,
        action="access_event",
        tenant_id=event.tenant_id,
        document_id=event.document_id,
        details={"event_id": event.event_id, "risk_score": score, "reasons": reasons},
    )
    session.flush()
    return AccessEventResponse(accepted=True, event_id=event.event_id, risk_recomputed=True)


def build_dashboard(session: Session, tenant_id: str, document_id: str | None = None, from_: datetime | None = None, to: datetime | None = None) -> DashboardResponse:
    documents_query = select(DocumentORM).where(DocumentORM.tenant_id == tenant_id)
    access_query = select(AccessEventORM).where(AccessEventORM.tenant_id == tenant_id)
    if document_id:
        documents_query = documents_query.where(DocumentORM.document_id == document_id)
        access_query = access_query.where(AccessEventORM.document_id == document_id)
    if from_ is not None:
        access_query = access_query.where(AccessEventORM.timestamp >= from_)
    if to is not None:
        access_query = access_query.where(AccessEventORM.timestamp <= to)

    documents = session.scalars(documents_query).all()
    access_events = session.scalars(access_query).all()

    alerts: list[AlertItem] = []
    seen_alert_documents: set[str] = set()
    for doc in documents:
        score, reasons = compute_risk_signals(session, tenant_id, doc.document_id)
        if score >= 50:
            alerts.append(
                AlertItem(
                    document_id=doc.document_id,
                    severity=severity_for_score(score),
                    reason_codes=reasons,
                    score=score,
                )
            )
            seen_alert_documents.add(doc.document_id)

    recent_activity = [
        ActivityItem(
            document_id=event.document_id,
            timestamp=event.timestamp,
            action=event.action,
            country=event.country,
        )
        for event in sorted(access_events, key=lambda item: item.timestamp, reverse=True)[:20]
    ]

    return DashboardResponse(
        tenant_id=tenant_id,
        documents=len(documents),
        access_events=len(access_events),
        alerts=alerts,
        recent_activity=recent_activity,
    )


def build_audit_export(session: Session, tenant_id: str, document_id: str) -> dict:
    document = session.get(DocumentORM, document_id)
    if document is None:
        raise NotFoundError(f"Document {document_id} not found")
    history = [
        {
            "event_id": event.event_id,
            "document_id": event.document_id,
            "event": event.event,
            "actor_org": event.actor_org,
            "actor_key_id": event.actor_key_id,
            "timestamp": event.timestamp,
            "previous_event_hash": event.previous_event_hash,
            "manifest_hash": event.manifest_hash,
            "payload": event.payload,
            "signature": event.signature,
            "event_hash": event.event_hash,
        }
        for event in document.events
    ]
    access_events = [
        {
            "event_id": event.event_id,
            "tenant_id": event.tenant_id,
            "document_id": event.document_id,
            "link_id": event.link_id,
            "timestamp": event.timestamp,
            "action": event.action,
            "ip_hash": event.ip_hash,
            "user_agent_hash": event.user_agent_hash,
            "country": event.country,
            "result": event.result,
            "reason": event.reason,
            "risk_score": event.risk_score,
            "risk_reasons": event.risk_reasons,
        }
        for event in document.access_events
    ]
    score, reasons = compute_risk_signals(session, tenant_id, document_id)
    return {
        "tenant_id": tenant_id,
        "document_id": document_id,
        "manifest": document.manifest,
        "manifest_hash": document.manifest_hash,
        "history": history,
        "revocation": RevocationSummary(
            document_revoked=document.status == "revoked",
            revoked_keys=[
                event.actor_key_id
                for event in document.events
                if session.get(DocumentORM, event.document_id) is not None
            ],
        ).model_dump(mode="json"),
        "access_events": access_events,
        "risk_signals": [{"score": score, "reasons": reasons}],
        "verification_summary": VerificationSummary(
            last_status=document.last_verified_status,
            last_verified_at=document.last_verified_at,
        ).model_dump(mode="json"),
    }

