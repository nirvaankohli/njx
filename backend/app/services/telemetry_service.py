from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.db import AccessEventORM, DocumentORM, PublicKeyORM
from app.models.dto import (
    AccessEvent,
    AccessEventFeedItem,
    AccessEventFeedResponse,
    AccessEventResponse,
    ActivityItem,
    AlertItem,
    DashboardResponse,
    RevocationSummary,
    VerificationSummary,
)
from app.services.audit_service import log_action
from app.services.errors import NotFoundError
from app.services.risk_service import compute_risk_signals, score_access_event, severity_for_score


def record_access_event(session: Session, event: AccessEvent) -> AccessEventResponse:
    document = session.get(DocumentORM, event.document_id)
    if document is None:
        raise NotFoundError(f"Document {event.document_id} not found")
    access_event = AccessEventORM(
        event_id=event.event_id,
        tenant_id=event.tenant_id,
        document_id=event.document_id,
        link_id=event.link_id,
        timestamp=event.timestamp,
        action=event.action,
        ip_hash=event.ip_hash,
        user_agent_hash=event.user_agent_hash,
        browser=event.browser,
        country=event.country,
        result=event.result,
        reason=event.reason,
        risk_score=0,
        risk_reasons=[],
    )
    session.add(access_event)
    session.flush()
    score, reasons = score_access_event(session, event)
    access_event.risk_score = score
    access_event.risk_reasons = reasons
    log_action(
        session,
        action="access_event",
        tenant_id=event.tenant_id,
        document_id=event.document_id,
        details={"event_id": event.event_id, "risk_score": score, "reasons": reasons},
    )
    session.commit()
    return AccessEventResponse(accepted=True, event_id=event.event_id, risk_recomputed=True)


def build_access_events_feed(session: Session, tenant_id: str, limit: int = 25) -> AccessEventFeedResponse:
    base_query = select(AccessEventORM).where(AccessEventORM.tenant_id == tenant_id)
    events_query = base_query.order_by(AccessEventORM.timestamp.desc(), AccessEventORM.id.desc()).limit(limit)
    total_events = session.scalar(select(func.count()).select_from(AccessEventORM).where(AccessEventORM.tenant_id == tenant_id)) or 0
    suspicious_events = (
        session.scalar(
            select(func.count()).select_from(AccessEventORM).where(
                AccessEventORM.tenant_id == tenant_id,
                AccessEventORM.risk_score >= 50,
            )
        )
        or 0
    )
    sliced_events = session.scalars(events_query).all()

    feed_items = [
        AccessEventFeedItem(
            event_id=event.event_id,
            tenant_id=event.tenant_id,
            document_id=event.document_id,
            link_id=event.link_id,
            timestamp=event.timestamp,
            action=event.action,
            ip_hash=event.ip_hash,
            user_agent_hash=event.user_agent_hash,
            browser=event.browser,
            country=event.country,
            result=event.result,
            reason=event.reason,
            risk_score=event.risk_score,
            risk_reasons=list(event.risk_reasons),
            severity=severity_for_score(event.risk_score),
            suspicious=event.risk_score >= 50,
        )
        for event in sliced_events
    ]

    return AccessEventFeedResponse(
        tenant_id=tenant_id,
        total_events=total_events,
        suspicious_events=suspicious_events,
        events=feed_items,
    )


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
    revoked_keys = set()
    issuer_key = session.get(PublicKeyORM, document.issuer_key_id)
    if issuer_key is not None and issuer_key.status == "revoked":
        revoked_keys.add(issuer_key.key_id)
    for event in document.events:
        key = session.get(PublicKeyORM, event.actor_key_id)
        if key is not None and key.status == "revoked":
            revoked_keys.add(key.key_id)
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
            "browser": event.browser,
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
            revoked_keys=sorted(revoked_keys),
        ).model_dump(mode="json"),
        "access_events": access_events,
        "risk_signals": [{"score": score, "reasons": reasons}],
        "verification_summary": VerificationSummary(
            last_status=document.last_verified_status,
            last_verified_at=document.last_verified_at,
        ).model_dump(mode="json"),
    }
