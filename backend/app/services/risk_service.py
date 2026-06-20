from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import exp, sqrt

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.db import AccessEventORM, AnomalyModelStateORM, DocumentORM
from app.models.dto import AccessEvent
from app.services.errors import ConflictError, NotFoundError


@dataclass(frozen=True)
class FeatureSpec:
    name: str
    prior_mean: float
    prior_variance: float
    weight: float
    reason_high: str | None = None
    reason_low: str | None = None


FEATURE_SPECS: tuple[FeatureSpec, ...] = (
    FeatureSpec("download_count_24h", prior_mean=0.75, prior_variance=2.25, weight=1.35, reason_high="download_spike"),
    FeatureSpec("download_count_1h", prior_mean=0.15, prior_variance=1.0, weight=1.6, reason_high="burst_access"),
    FeatureSpec("blocked_count_24h", prior_mean=0.0, prior_variance=0.5, weight=1.0, reason_high="blocked_attempts"),
    FeatureSpec("distinct_countries_7d", prior_mean=1.0, prior_variance=0.75, weight=1.15, reason_high="new_geography"),
    FeatureSpec("distinct_clients_7d", prior_mean=1.0, prior_variance=0.75, weight=1.0, reason_high="multi_client_clusters"),
    FeatureSpec(
        "minutes_since_previous_event",
        prior_mean=240.0,
        prior_variance=14400.0,
        weight=0.7,
        reason_high="stale_activity",
        reason_low="burst_access",
    ),
    FeatureSpec("country_novelty", prior_mean=0.0, prior_variance=0.25, weight=1.0, reason_high="new_geography"),
)

FEATURE_MAP: dict[str, FeatureSpec] = {spec.name: spec for spec in FEATURE_SPECS}
FEATURE_STD_FLOOR = 0.35
SCORE_DECAY = 3.25
REASON_Z_THRESHOLD = 1.0


def _ensure_aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _window_events(events: list[AccessEventORM], cutoff: datetime) -> list[AccessEventORM]:
    return [event for event in events if _ensure_aware(event.timestamp) >= cutoff]


def _client_signature(event: AccessEventORM) -> tuple[str, str]:
    return (event.ip_hash or "", event.user_agent_hash or "")


def _build_feature_vector(events: list[AccessEventORM], current_event: AccessEvent) -> dict[str, float]:
    current_ts = _ensure_aware(current_event.timestamp)
    last_24h = current_ts - timedelta(hours=24)
    last_1h = current_ts - timedelta(hours=1)
    last_7d = current_ts - timedelta(days=7)

    recent_24h = _window_events(events, last_24h)
    recent_1h = _window_events(events, last_1h)
    recent_7d = _window_events(events, last_7d)
    previous_events = [event for event in events if event.event_id != current_event.event_id and _ensure_aware(event.timestamp) <= current_ts]

    prior_countries = {event.country for event in recent_7d if event.event_id != current_event.event_id and event.country}
    prior_ts = max((_ensure_aware(event.timestamp) for event in previous_events), default=None)

    downloads_24h = sum(1 for event in recent_24h if event.action == "download")
    downloads_1h = sum(1 for event in recent_1h if event.action == "download")
    blocked_24h = sum(1 for event in recent_24h if event.result == "blocked")
    distinct_countries_7d = len({event.country for event in recent_7d if event.country})
    distinct_clients_7d = len({_client_signature(event) for event in recent_7d if event.ip_hash or event.user_agent_hash})
    country_novelty = 1.0 if current_event.country and current_event.country not in prior_countries else 0.0
    minutes_since_previous_event = (
        max(0.0, (current_ts - prior_ts).total_seconds() / 60.0) if prior_ts is not None else FEATURE_MAP["minutes_since_previous_event"].prior_mean
    )

    return {
        "download_count_24h": float(downloads_24h),
        "download_count_1h": float(downloads_1h),
        "blocked_count_24h": float(blocked_24h),
        "distinct_countries_7d": float(distinct_countries_7d),
        "distinct_clients_7d": float(distinct_clients_7d),
        "minutes_since_previous_event": float(minutes_since_previous_event),
        "country_novelty": float(country_novelty),
    }


def _initial_state(document: DocumentORM) -> AnomalyModelStateORM:
    return AnomalyModelStateORM(
        document_id=document.document_id,
        tenant_id=document.tenant_id,
        sample_count=0,
        feature_means={spec.name: spec.prior_mean for spec in FEATURE_SPECS},
        feature_m2={spec.name: 0.0 for spec in FEATURE_SPECS},
        latest_feature_vector={},
        latest_score=0,
        latest_reasons=[],
        last_scored_at=None,
    )


def _get_or_create_state(session: Session, document: DocumentORM) -> AnomalyModelStateORM:
    state = session.get(AnomalyModelStateORM, document.document_id)
    if state is None:
        state = _initial_state(document)
        session.add(state)
        session.flush()
    else:
        for spec in FEATURE_SPECS:
            state.feature_means.setdefault(spec.name, spec.prior_mean)
            state.feature_m2.setdefault(spec.name, 0.0)
    return state


def _feature_variance(state: AnomalyModelStateORM, spec: FeatureSpec) -> float:
    if state.sample_count > 1:
        variance = float(state.feature_m2.get(spec.name, 0.0)) / float(state.sample_count - 1)
    else:
        variance = spec.prior_variance
    return max(variance, spec.prior_variance * 0.25, FEATURE_STD_FLOOR**2)


def _score_features(state: AnomalyModelStateORM, features: dict[str, float]) -> tuple[int, list[str]]:
    anomaly_mass = 0.0
    reason_candidates: list[tuple[float, str]] = []

    for spec in FEATURE_SPECS:
        value = float(features[spec.name])
        mean = float(state.feature_means.get(spec.name, spec.prior_mean))
        variance = _feature_variance(state, spec)
        std = sqrt(variance)
        z_score = (value - mean) / std

        if spec.reason_high is not None and z_score >= 0:
            reason = spec.reason_high
        elif spec.reason_low is not None and z_score < 0:
            reason = spec.reason_low
        else:
            reason = None

        contribution = spec.weight * max(abs(z_score) - 0.85, 0.0) ** 2
        anomaly_mass += contribution
        if reason is not None and abs(z_score) >= REASON_Z_THRESHOLD:
            reason_candidates.append((contribution, reason))

    score = min(100, round(100 * (1 - exp(-anomaly_mass / SCORE_DECAY))))
    reason_candidates.sort(key=lambda item: item[0], reverse=True)

    reasons: list[str] = []
    seen: set[str] = set()
    for _, reason in reason_candidates:
        if reason in seen:
            continue
        seen.add(reason)
        reasons.append(reason)
        if len(reasons) == 3:
            break

    if score > 0 and not reasons:
        reasons.append("model_deviation")

    return score, reasons


def _update_state(state: AnomalyModelStateORM, features: dict[str, float], score: int, reasons: list[str], timestamp: datetime) -> None:
    next_count = state.sample_count + 1
    for spec in FEATURE_SPECS:
        value = float(features[spec.name])
        mean = float(state.feature_means.get(spec.name, spec.prior_mean))
        m2 = float(state.feature_m2.get(spec.name, 0.0))
        delta = value - mean
        mean += delta / next_count
        delta2 = value - mean
        m2 += delta * delta2
        state.feature_means[spec.name] = mean
        state.feature_m2[spec.name] = m2

    state.sample_count = next_count
    state.latest_feature_vector = features
    state.latest_score = score
    state.latest_reasons = reasons
    state.last_scored_at = timestamp


def score_access_event(session: Session, event: AccessEvent) -> tuple[int, list[str]]:
    document = session.get(DocumentORM, event.document_id)
    if document is None:
        raise NotFoundError(f"Document {event.document_id} not found")
    if document.tenant_id != event.tenant_id:
        raise ConflictError(f"Tenant mismatch for document {event.document_id}")

    state = _get_or_create_state(session, document)
    events = session.scalars(
        select(AccessEventORM).where(
            AccessEventORM.tenant_id == event.tenant_id,
            AccessEventORM.document_id == event.document_id,
        )
    ).all()
    features = _build_feature_vector(events, event)
    score, reasons = _score_features(state, features)
    _update_state(state, features, score, reasons, _ensure_aware(event.timestamp))
    session.add(state)
    return score, reasons


def compute_risk_signals(session: Session, tenant_id: str, document_id: str) -> tuple[int, list[str]]:
    state = session.get(AnomalyModelStateORM, document_id)
    if state is None or state.tenant_id != tenant_id:
        return 0, []
    return state.latest_score, list(state.latest_reasons)


def severity_for_score(score: int) -> str:
    if score >= 80:
        return "high"
    if score >= 50:
        return "medium"
    return "low"
