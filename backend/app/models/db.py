from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, LargeBinary, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TenantORM(Base):
    __tablename__ = "tenants"

    tenant_id: Mapped[str] = mapped_column(String, primary_key=True)
    org_name: Mapped[str] = mapped_column(String, nullable=False)
    domains: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    admin_emails: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    status: Mapped[str] = mapped_column(String, default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    policy_templates: Mapped[list["PolicyTemplateORM"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    public_keys: Mapped[list["PublicKeyORM"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    documents: Mapped[list["DocumentORM"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")


class PolicyTemplateORM(Base):
    __tablename__ = "policy_templates"
    __table_args__ = (UniqueConstraint("tenant_id", "policy_id", name="uq_policy_template_tenant_policy"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.tenant_id"), nullable=False)
    policy_id: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    policy: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    tenant: Mapped[TenantORM] = relationship(back_populates="policy_templates")


class PublicKeyORM(Base):
    __tablename__ = "public_keys"

    key_id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.tenant_id"), nullable=False)
    algorithm: Mapped[str] = mapped_column(String, default="Ed25519", nullable=False)
    public_key_b64: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String, default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    tenant: Mapped[TenantORM] = relationship(back_populates="public_keys")


class DocumentORM(Base):
    __tablename__ = "documents"

    document_id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.tenant_id"), nullable=False)
    issuer_key_id: Mapped[str] = mapped_column(ForeignKey("public_keys.key_id"), nullable=False)
    manifest: Mapped[dict] = mapped_column(JSON, nullable=False)
    manifest_hash: Mapped[str] = mapped_column(String, nullable=False)
    manifest_signature: Mapped[str] = mapped_column(Text, nullable=False)
    signature_algorithm: Mapped[str] = mapped_column(String, default="Ed25519", nullable=False)
    content_fingerprint: Mapped[str] = mapped_column(String, nullable=False)
    policy: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    embedded_ai_tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    history_tip: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="active", nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_verified_status: Mapped[str | None] = mapped_column(String, nullable=True)
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_verification_reasons: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    tenant: Mapped[TenantORM] = relationship(back_populates="documents")
    events: Mapped[list["SignatureHistoryEventORM"]] = relationship(back_populates="document", cascade="all, delete-orphan", order_by="SignatureHistoryEventORM.timestamp")
    access_events: Mapped[list["AccessEventORM"]] = relationship(back_populates="document", cascade="all, delete-orphan", order_by="AccessEventORM.timestamp")
    verification_logs: Mapped[list["VerificationLogORM"]] = relationship(back_populates="document", cascade="all, delete-orphan", order_by="VerificationLogORM.verified_at")
    anomaly_state: Mapped["AnomalyModelStateORM"] = relationship(back_populates="document", cascade="all, delete-orphan", uselist=False)


class DocumentContentORM(Base):
    __tablename__ = "document_contents"

    document_id: Mapped[str] = mapped_column(ForeignKey("documents.document_id"), primary_key=True)
    file_name: Mapped[str] = mapped_column(String, nullable=False)
    content_type: Mapped[str] = mapped_column(String, nullable=False)
    storage_key: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    encrypted_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class ShareLinkORM(Base):
    __tablename__ = "share_links"

    link_id: Mapped[str] = mapped_column(String, primary_key=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.document_id"), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.tenant_id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    access_method: Mapped[str] = mapped_column(String, default="link", nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SignatureHistoryEventORM(Base):
    __tablename__ = "signature_history_events"

    event_id: Mapped[str] = mapped_column(String, primary_key=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.document_id"), nullable=False)
    event: Mapped[str] = mapped_column(String, nullable=False)
    actor_org: Mapped[str] = mapped_column(String, nullable=False)
    actor_key_id: Mapped[str] = mapped_column(ForeignKey("public_keys.key_id"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    previous_event_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    manifest_hash: Mapped[str] = mapped_column(String, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    signature: Mapped[str] = mapped_column(Text, nullable=False)
    event_hash: Mapped[str] = mapped_column(String, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    document: Mapped[DocumentORM] = relationship(back_populates="events")


class AccessEventORM(Base):
    __tablename__ = "access_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.tenant_id"), nullable=False)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.document_id"), nullable=False)
    link_id: Mapped[str | None] = mapped_column(String, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String, nullable=True)
    ip_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    user_agent_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    browser: Mapped[str | None] = mapped_column(String, nullable=True)
    country: Mapped[str | None] = mapped_column(String, nullable=True)
    result: Mapped[str] = mapped_column(String, default="allowed", nullable=False)
    reason: Mapped[str | None] = mapped_column(String, nullable=True)
    risk_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    risk_reasons: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    document: Mapped[DocumentORM] = relationship(back_populates="access_events")


class AnomalyModelStateORM(Base):
    __tablename__ = "anomaly_model_states"

    document_id: Mapped[str] = mapped_column(ForeignKey("documents.document_id"), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.tenant_id"), nullable=False)
    sample_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    feature_means: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    feature_m2: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    model_state_blob: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    latest_feature_vector: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    latest_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    latest_reasons: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    last_scored_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    document: Mapped[DocumentORM] = relationship(back_populates="anomaly_state")


class VerificationLogORM(Base):
    __tablename__ = "verification_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.document_id"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    fingerprint_match: Mapped[bool] = mapped_column(nullable=False, default=False)
    manifest_signature_valid: Mapped[bool] = mapped_column(nullable=False, default=False)
    signature_chain_valid: Mapped[bool] = mapped_column(nullable=False, default=False)
    revoked: Mapped[bool] = mapped_column(nullable=False, default=False)
    reasons: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    usage_context: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    document: Mapped[DocumentORM] = relationship(back_populates="verification_logs")


class AuditLogORM(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    document_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    action: Mapped[str] = mapped_column(String, nullable=False)
    details: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
