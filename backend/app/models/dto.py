from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Tenant(BaseModel):
    tenant_id: str
    org_name: str
    domains: list[str] = Field(default_factory=list)
    admin_emails: list[str] = Field(default_factory=list)
    status: Literal["active", "disabled"] = "active"


class PolicyTemplate(BaseModel):
    policy_id: str
    name: str
    policy: dict = Field(default_factory=dict)


class PublicKeyRecord(BaseModel):
    key_id: str
    algorithm: Literal["Ed25519"] = "Ed25519"
    public_key_b64: str
    status: Literal["active", "revoked"] = "active"
    created_at: datetime | None = None
    revoked_at: datetime | None = None


class ManifestClaims(BaseModel):
    schema_version: str = "1.0"
    tenant_id: str
    document_id: str
    issuer_key_id: str
    content_fingerprint: str
    policy: dict = Field(default_factory=dict)
    embedded_ai_tags: list[str] = Field(default_factory=list)
    created_at: datetime


class SignedManifest(BaseModel):
    manifest: ManifestClaims
    manifest_signature: str
    signature_algorithm: Literal["Ed25519"] = "Ed25519"


class SignatureHistoryEvent(BaseModel):
    event_id: str
    document_id: str
    event: Literal[
        "issued",
        "sent",
        "received",
        "confirmed_received",
        "approved",
        "reissued",
        "revoked",
    ]
    actor_org: str
    actor_key_id: str
    timestamp: datetime
    previous_event_hash: str | None = None
    manifest_hash: str
    payload: dict = Field(default_factory=dict)
    signature: str


class AccessEvent(BaseModel):
    event_id: str
    tenant_id: str
    document_id: str
    link_id: str | None = None
    timestamp: datetime
    action: Literal["open", "download", "token_failed", "verify_attempt", "ai_upload_blocked"]
    ip_hash: str | None = None
    user_agent_hash: str | None = None
    country: str | None = None
    result: Literal["allowed", "blocked", "failed"] = "allowed"
    reason: str | None = None


class UsageContext(BaseModel):
    operation: str
    app: str | None = None


class PolicyDecision(BaseModel):
    operation: str
    allowed: bool
    reason: str | None = None


class VerifyRequest(BaseModel):
    document_id: str
    signed_manifest: SignedManifest
    history: list[SignatureHistoryEvent] = Field(default_factory=list)
    computed_content_fingerprint: str
    usage_context: UsageContext = Field(default_factory=lambda: UsageContext(operation="unknown"))


class VerifyResult(BaseModel):
    status: Literal[
        "valid",
        "tampered",
        "revoked",
        "metadata_stripped",
        "unverifiable_rebuilt_copy",
        "unknown_document",
        "invalid_signature",
    ]
    document_id: str
    issuer_key_id: str | None = None
    fingerprint_match: bool
    manifest_signature_valid: bool
    signature_chain_valid: bool
    revoked: bool
    policy_decision: PolicyDecision
    reasons: list[str] = Field(default_factory=list)


class TenantSetupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenant: Tenant
    policy_templates: list[PolicyTemplate] = Field(default_factory=list)
    public_keys: list[PublicKeyRecord] = Field(default_factory=list)


class SetupResponse(BaseModel):
    tenant_id: str
    status: Literal["active", "disabled"]
    registered_policy_templates: int
    registered_public_keys: int


class DocumentRegistrationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    signed_manifest: SignedManifest
    initial_history: list[SignatureHistoryEvent] = Field(default_factory=list)


class DocumentRegistrationResponse(BaseModel):
    document_id: str
    manifest_hash: str
    status: Literal["registered"]
    history_tip: str


class EventAppendResponse(BaseModel):
    document_id: str
    event_id: str
    accepted: bool
    history_tip: str


class AccessEventResponse(BaseModel):
    accepted: bool
    event_id: str
    risk_recomputed: bool


class AccessEventFeedItem(BaseModel):
    event_id: str
    tenant_id: str
    document_id: str
    link_id: str | None = None
    timestamp: datetime
    action: Literal["open", "download", "token_failed", "verify_attempt", "ai_upload_blocked"]
    ip_hash: str | None = None
    user_agent_hash: str | None = None
    country: str | None = None
    result: Literal["allowed", "blocked", "failed"] = "allowed"
    reason: str | None = None
    risk_score: int
    risk_reasons: list[str] = Field(default_factory=list)
    severity: Literal["low", "medium", "high"]
    suspicious: bool


class AccessEventFeedResponse(BaseModel):
    tenant_id: str
    total_events: int
    suspicious_events: int
    events: list[AccessEventFeedItem] = Field(default_factory=list)

class ShareLinkCreateRequest(BaseModel):
    access_method: Literal["link", "password", "organization"] = "link"
    password_hash: str | None = None
    expires_in_hours: int | None = Field(default=168, ge=1, le=24 * 365)


class ShareLinkResponse(BaseModel):
    link_id: str
    document_id: str
    token: str
    access_method: str
    expires_at: datetime | None = None


class ShareDocumentResponse(BaseModel):
    link_id: str
    document_id: str
    tenant_id: str
    file_name: str
    content_type: str
    size_bytes: int
    content_fingerprint: str
    issuer_key_id: str
    access_method: str
    password_required: bool
    expires_at: datetime | None = None


class ShareAnalyticsResponse(BaseModel):
    document_id: str
    opens: int
    downloads: int
    download_rate_per_hour: float
    countries: dict[str, int] = Field(default_factory=dict)


class AlertItem(BaseModel):
    document_id: str
    severity: Literal["low", "medium", "high"]
    reason_codes: list[str] = Field(default_factory=list)
    score: int


class ActivityItem(BaseModel):
    document_id: str
    timestamp: datetime
    action: str
    country: str | None = None


class DashboardResponse(BaseModel):
    tenant_id: str
    documents: int
    access_events: int
    alerts: list[AlertItem] = Field(default_factory=list)
    recent_activity: list[ActivityItem] = Field(default_factory=list)


class RevocationSummary(BaseModel):
    document_revoked: bool
    revoked_keys: list[str] = Field(default_factory=list)


class VerificationSummary(BaseModel):
    last_status: str | None = None
    last_verified_at: datetime | None = None


class AuditExportResponse(BaseModel):
    tenant_id: str
    document_id: str
    manifest: dict
    manifest_hash: str
    history: list[dict] = Field(default_factory=list)
    revocation: RevocationSummary
    access_events: list[dict] = Field(default_factory=list)
    risk_signals: list[dict] = Field(default_factory=list)
    verification_summary: VerificationSummary
