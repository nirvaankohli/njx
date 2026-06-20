from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.db import AccessEventORM


def _window_start(hours: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(hours=hours)


def compute_risk_signals(session: Session, tenant_id: str, document_id: str) -> tuple[int, list[str]]:
    now = datetime.now(timezone.utc)
    last_24h = now - timedelta(hours=24)
    last_1h = now - timedelta(hours=1)
    last_7d = now - timedelta(days=7)

    events = session.scalars(
        select(AccessEventORM).where(
            AccessEventORM.tenant_id == tenant_id,
            AccessEventORM.document_id == document_id,
        )
    ).all()

    recent = [event for event in events if event.timestamp >= last_24h]
    recent_downloads = [event for event in recent if event.action == "download"]
    very_recent_downloads = [event for event in events if event.timestamp >= last_1h and event.action == "download"]
    countries = [event.country for event in events if event.timestamp >= last_7d and event.country]
    country_counts = Counter(countries)

    score = 0
    reasons: list[str] = []

    if len(recent_downloads) >= 10:
        score += 50
        reasons.append("download_spike")
    if len(very_recent_downloads) >= 3:
        score += 20
        reasons.append("burst_access")
    if len(country_counts) >= 2:
        score += 20
        reasons.append("new_geography")
    if any(event.result == "blocked" for event in recent):
        score += 10
        reasons.append("blocked_attempts")

    return min(score, 100), reasons


def severity_for_score(score: int) -> str:
    if score >= 80:
        return "high"
    if score >= 50:
        return "medium"
    return "low"

