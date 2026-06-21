#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import os
import shutil
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from random import Random

ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from sqlalchemy import delete

from app.db.session import Base, SessionLocal, engine
from app.services.blob_storage_service import store_encrypted_blob
from app.services.embedded_document_service import embed_encrypted_passport
from app.services.frontend_state_service import reset_frontend_state, SEEDED_COMPANY_NAME, SEEDED_EMAIL
from app.models.db import (
    AccessEventORM,
    AnomalyModelStateORM,
    AuditLogORM,
    DocumentContentORM,
    DocumentORM,
    PolicyTemplateORM,
    PublicKeyORM,
    ShareLinkORM,
    SignatureHistoryEventORM,
    TenantORM,
    VerificationLogORM,
)
from app.models.dto import ManifestClaims, PolicyTemplate, PublicKeyRecord, SignatureHistoryEvent, Tenant, TenantSetupRequest
from app.security.canonical_json import canonical_json_bytes
from app.security.hashes import canonical_hash, sha256_hex
from app.services.setup_service import setup_tenant


COMPANY_PROFILES = [
    ("Acme Pharma", ["acme.com", "acmepharma.com"]),
    ("Globex Biologics", ["globexbio.com", "globexbiologics.com"]),
    ("Northstar Therapeutics", ["northstarthera.com"]),
    ("Helix Health", ["helixhealth.com", "helix.health"]),
    ("Orion MedTech", ["orionmedtech.com"]),
    ("Valence Labs", ["valencelabs.com"]),
    ("Vertex Clinical", ["vertexclinical.com"]),
]

FILE_TYPES = [
    ("clinical-study-report.pdf", "application/pdf"),
    ("safety-update.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ("trial-summary.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ("partner-brief.txt", "text/plain"),
    ("submission-pack.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
]

DOMESTIC_COUNTRIES = ["US", "CA"]
FOREIGN_COUNTRIES = ["GB", "DE", "FR", "IN", "JP", "BR", "AU", "NL"]
HIGH_RISK_COUNTRY = "PH"
BROWSERS = ["Chrome", "Safari", "Edge", "Firefox", "Brave"]
NORMAL_ACTIONS = ["open", "download", "verify_attempt"]
TAG_POOL = [
    "NO_EXTERNAL_AI",
    "CONFIDENTIAL",
    "EXPORT_RESTRICTED",
    "INTERNAL_ONLY",
    "PHARMA_SOP",
]


@dataclass(slots=True)
class KeyMaterial:
    key_id: str
    public_key_b64: str
    private_key: Ed25519PrivateKey


@dataclass(slots=True)
class TenantSeedContext:
    tenant: TenantORM
    private_keys: dict[str, Ed25519PrivateKey]
    key_materials: dict[str, KeyMaterial]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed the DocShield database with large volumes of realistic fake data.")
    parser.add_argument("--reset", action="store_true", help="Drop and recreate all tables before seeding.")
    parser.add_argument("--judge", action="store_true", help="Seed the judge-ready Nirvaan Kohli / BediServices account and tenant_acme data.")
    parser.add_argument("--seed", type=int, default=7, help="Random seed for reproducible output.")
    parser.add_argument("--run-id", default=None, help="Suffix for generated IDs. Defaults to a random short value.")
    parser.add_argument("--prefix", default="seed", help="Prefix used for generated tenant and document IDs.")
    parser.add_argument("--tenants", type=int, default=5, help="Number of tenants to create.")
    parser.add_argument("--documents-per-tenant", type=int, default=40, help="Number of documents to create for each tenant.")
    parser.add_argument("--history-events-per-document", type=int, default=4, help="Signed history events to create for each document.")
    parser.add_argument("--access-events-per-document", type=int, default=24, help="Access events to create for each document.")
    parser.add_argument("--verification-logs-per-document", type=int, default=2, help="Verification logs to create for each document.")
    parser.add_argument("--share-links-per-document", type=int, default=1, help="Share links to create for each document.")
    parser.add_argument("--content-base-bytes", type=int, default=2048, help="Baseline source file size in bytes before variation is added.")
    return parser.parse_args()


def ensure_tables(reset: bool) -> None:
    if reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def reset_blob_storage() -> None:
    storage_dir = Path(os.getenv("DOCSHIELD_BLOB_STORAGE_DIR", str(ROOT_DIR / "backend" / ".secure_blobs")))
    shutil.rmtree(storage_dir, ignore_errors=True)


def make_keypair() -> tuple[str, Ed25519PrivateKey]:
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
    return base64.b64encode(public_key).decode("ascii"), private_key


def sign_payload(payload: dict, private_key: Ed25519PrivateKey) -> str:
    signature = private_key.sign(canonical_json_bytes(payload))
    return "ed25519:" + base64.b64encode(signature).decode("ascii")


def signed_manifest(manifest: ManifestClaims, private_key: Ed25519PrivateKey) -> dict:
    payload = manifest.model_dump(mode="json")
    return {
        "manifest": payload,
        "manifest_signature": sign_payload(payload, private_key),
        "signature_algorithm": "Ed25519",
    }


def signed_event(event: SignatureHistoryEvent, private_key: Ed25519PrivateKey) -> SignatureHistoryEvent:
    payload = event.model_dump(mode="json")
    payload["signature"] = sign_payload({key: value for key, value in payload.items() if key != "signature"}, private_key)
    return SignatureHistoryEvent.model_validate(payload)


def slugify(value: str) -> str:
    return "".join(char.lower() if char.isalnum() else "-" for char in value).strip("-")


def choose_profile(index: int) -> tuple[str, list[str]]:
    if index < len(COMPANY_PROFILES):
        return COMPANY_PROFILES[index]
    return (f"Company {index + 1}", [f"company-{index + 1}.example"])


def build_policy_templates(prefix: str, index: int) -> list[PolicyTemplate]:
    return [
        PolicyTemplate(
            policy_id=f"{prefix}_policy_{index:02d}_locked_ai",
            name="Locked Down AI",
            policy={
                "external_ai_upload": "blocked",
                "secure_link_required": True,
                "forwarding": "blocked",
                "public_sharing": "blocked",
            },
        ),
        PolicyTemplate(
            policy_id=f"{prefix}_policy_{index:02d}_partner_share",
            name="Partner Share",
            policy={
                "external_ai_upload": "blocked",
                "secure_link_required": True,
                "forwarding": "review",
                "public_sharing": "blocked",
            },
        ),
        PolicyTemplate(
            policy_id=f"{prefix}_policy_{index:02d}_open_review",
            name="Open Review",
            policy={
                "external_ai_upload": "allowed",
                "secure_link_required": False,
                "forwarding": "review",
                "public_sharing": "review",
            },
        ),
    ]


def create_tenant_context(
    session,
    *,
    prefix: str,
    run_id: str,
    index: int,
    rng: Random,
    judge: bool = False,
) -> TenantSeedContext:
    org_name, domains = choose_profile(index)
    if judge:
        tenant_id = "tenant_acme"
        org_name = SEEDED_COMPANY_NAME
        domains = ["bediservices.com"]
    else:
        tenant_id = f"{prefix}_{run_id}_tenant_{index:02d}"

    key_materials: dict[str, KeyMaterial] = {}
    public_keys: list[PublicKeyRecord] = []
    private_keys: dict[str, Ed25519PrivateKey] = {}
    for role in ("primary", "review", "archive"):
        public_key_b64, private_key = make_keypair()
        key_id = f"key_acme_{role}" if judge else f"{tenant_id}_key_{role}"
        private_keys[key_id] = private_key
        key_materials[key_id] = KeyMaterial(key_id=key_id, public_key_b64=public_key_b64, private_key=private_key)
        public_keys.append(PublicKeyRecord(key_id=key_id, public_key_b64=public_key_b64, status="active"))

    setup_tenant(
        session,
        TenantSetupRequest(
            tenant=Tenant(
                tenant_id=tenant_id,
                org_name=org_name,
                domains=domains,
                admin_emails=[SEEDED_EMAIL if judge else f"admin@{domains[0]}"],
                status="active",
            ),
            policy_templates=build_policy_templates(prefix, index),
            public_keys=public_keys,
        ),
    )

    tenant = session.get(TenantORM, tenant_id)
    if tenant is None:
        raise RuntimeError(f"Tenant {tenant_id} failed to seed")
    return TenantSeedContext(tenant=tenant, private_keys=private_keys, key_materials=key_materials)


def build_content(rng: Random, base_size: int, label: str) -> bytes:
    size = base_size + rng.randint(0, max(256, base_size // 2))
    header = f"DocShield seed file: {label}\n".encode("utf-8")
    body = rng.randbytes(max(1, size - len(header)))
    return header + body


def build_document_policy(rng: Random, template: PolicyTemplate) -> dict:
    policy = dict(template.policy)
    if rng.random() < 0.3:
        policy["retention"] = f"{rng.randint(12, 72)} months"
    if rng.random() < 0.25:
        policy["watermark"] = "required"
    return policy


def choose_country(rng: Random, *, allow_foreign: bool = True) -> str:
    if not allow_foreign or rng.random() < 0.84:
        return rng.choice(DOMESTIC_COUNTRIES)
    return rng.choice(FOREIGN_COUNTRIES)


def build_history_chain(
    *,
    tenant: TenantSeedContext,
    document_id: str,
    manifest_hash: str,
    created_at: datetime,
    event_count: int,
    rng: Random,
    primary_key_id: str,
) -> tuple[list[SignatureHistoryEventORM], str, datetime, bool]:
    event_types = ["issued", "sent", "received", "confirmed_received", "approved", "reissued"]
    active_keys = list(tenant.private_keys.keys())
    history_rows: list[SignatureHistoryEventORM] = []
    previous_hash: str | None = None
    timestamp = created_at
    revoked = False
    final_hash = ""

    for index in range(max(1, event_count)):
        if index == 0:
            event_type = "issued"
            actor_org = tenant.tenant.org_name
            actor_key_id = primary_key_id
        elif index == event_count - 1 and rng.random() < 0.18:
            event_type = "revoked"
            actor_org = f"{tenant.tenant.org_name} Compliance"
            actor_key_id = primary_key_id.replace("primary", "review")
            revoked = True
        else:
            event_type = event_types[min(index, len(event_types) - 1)]
            actor_org = f"{tenant.tenant.org_name} Ops"
            actor_key_id = rng.choice(active_keys)

        event = SignatureHistoryEvent(
            event_id=f"{document_id}_evt_{index:02d}",
            document_id=document_id,
            event=event_type,
            actor_org=actor_org,
            actor_key_id=actor_key_id,
            timestamp=timestamp,
            previous_event_hash=previous_hash,
            manifest_hash=manifest_hash,
            payload={
                "sequence": index,
                "channel": rng.choice(["email", "portal", "edi", "api"]),
                "note": f"{event_type.replace('_', ' ').title()} for {document_id}",
            },
            signature="",
        )
        signed = signed_event(event, tenant.private_keys[actor_key_id])
        event_hash = canonical_hash(signed.model_dump(mode="json"))
        history_rows.append(
            SignatureHistoryEventORM(
                event_id=signed.event_id,
                document_id=signed.document_id,
                event=signed.event,
                actor_org=signed.actor_org,
                actor_key_id=signed.actor_key_id,
                timestamp=signed.timestamp,
                previous_event_hash=signed.previous_event_hash,
                manifest_hash=signed.manifest_hash,
                payload=signed.payload,
                signature=signed.signature,
                event_hash=event_hash,
            )
        )
        previous_hash = event_hash
        final_hash = event_hash
        timestamp += timedelta(hours=rng.randint(4, 32))

    return history_rows, final_hash, timestamp, revoked


def build_access_events(
    *,
    rng: Random,
    tenant_id: str,
    document_id: str,
    share_link_id: str | None,
    base_time: datetime,
    count: int,
    suspicious: bool,
) -> tuple[list[AccessEventORM], int, list[str], dict]:
    events: list[AccessEventORM] = []
    latest_score = 0
    latest_reasons: list[str] = []
    latest_vector = {
        "download_count_24h": 0.0,
        "download_count_1h": 0.0,
        "download_rate_15m": 0.0,
        "blocked_count_24h": 0.0,
        "distinct_countries_7d": 0.0,
        "distinct_clients_7d": 0.0,
        "minutes_since_previous_event": 240.0,
        "country_novelty": 0.0,
    }

    cursor = base_time
    for index in range(count):
        cursor += timedelta(hours=rng.randint(1, 12), minutes=rng.randint(0, 59))
        timestamp = cursor
        if suspicious and index >= max(0, count - 3):
            action = "download"
            result = "blocked" if index == count - 1 else "allowed"
            score = 84 if index == count - 1 else 92
            reasons = ["download_rate_spike", "new_geography"]
            if index == count - 1:
                reasons.append("blocked_attempts")
            country = HIGH_RISK_COUNTRY
            browser = "Chrome"
        else:
            action = rng.choices(NORMAL_ACTIONS, weights=(0.45, 0.25, 0.30), k=1)[0]
            result = "allowed"
            country = choose_country(rng)
            browser = rng.choice(BROWSERS)
            if action == "download":
                score = 18 + (index % 7)
                reasons = ["model_deviation"] if score > 0 else []
            elif action == "verify_attempt":
                score = 18 + (index % 9)
                reasons = ["stale_activity"] if index % 3 == 0 else []
            else:
                score = 9 + (index % 7)
                reasons = []

        ip_address = f"10.{(index % 200) + 1}.{rng.randint(0, 255)}.{rng.randint(1, 254)}"
        user_agent = f"{browser}/seed-{rng.randint(1, 8)}"
        event = AccessEventORM(
            event_id=f"{document_id}_acc_{index:03d}",
            tenant_id=tenant_id,
            document_id=document_id,
            link_id=share_link_id if index % 2 == 0 else None,
            timestamp=timestamp,
            action=action,
            ip_address=ip_address,
            ip_hash=sha256_hex(ip_address.encode("utf-8")),
            user_agent_hash=sha256_hex(user_agent.encode("utf-8")),
            browser=browser,
            country=country,
            result=result,
            reason="seeded high-risk activity" if score >= 50 else None,
            risk_score=score,
            risk_reasons=reasons,
        )
        events.append(event)
        latest_score = score
        latest_reasons = reasons
        latest_vector["download_count_24h"] += 1.0 if action == "download" else 0.0
        latest_vector["download_count_1h"] += 1.0 if action == "download" and index >= count - 3 else 0.0
        latest_vector["download_rate_15m"] = max(0.0, latest_vector["download_rate_15m"] + (1.0 if action == "download" else 0.0))
        latest_vector["blocked_count_24h"] += 1.0 if result == "blocked" else 0.0
        latest_vector["distinct_countries_7d"] = float(len({event.country for event in events if event.country} | ({country} if country else set())))
        latest_vector["distinct_clients_7d"] = float(index + 1)
        if index > 0:
            latest_vector["minutes_since_previous_event"] = max(0.0, (timestamp - events[index - 1].timestamp).total_seconds() / 60.0)
        latest_vector["country_novelty"] = 1.0 if suspicious and index == count - 1 else 0.0

    return events, latest_score, latest_reasons, latest_vector


def build_verification_logs(
    *,
    document_id: str,
    latest_timestamp: datetime,
    count: int,
    revoked: bool,
    suspicious: bool,
) -> tuple[list[VerificationLogORM], str, datetime, list[str]]:
    logs: list[VerificationLogORM] = []
    status = "revoked" if revoked else ("tampered" if suspicious else "valid")
    reasons = (
        ["issuer_key_revoked", "document_revoked"]
        if revoked
        else (["manifest_signature_valid", "history_chain_valid", "content_fingerprint_mismatch"] if suspicious else ["manifest_signature_valid", "history_chain_valid"])
    )
    last_verified_at = latest_timestamp + timedelta(hours=6)
    for index in range(count):
        verified_at = last_verified_at + timedelta(days=index)
        log_status = status if index == count - 1 else ("valid" if not revoked else "revoked")
        log_reasons = reasons if index == count - 1 else ["manifest_signature_valid", "history_chain_valid"]
        logs.append(
            VerificationLogORM(
                document_id=document_id,
                status=log_status,
                verified_at=verified_at,
                fingerprint_match=not suspicious and not revoked,
                manifest_signature_valid=not revoked,
                signature_chain_valid=not revoked,
                revoked=revoked,
                reasons=log_reasons,
                usage_context={
                    "operation": "authenticity_check",
                    "app": "docshield_seed",
                },
            )
        )
    return logs, status, last_verified_at + timedelta(days=count - 1), reasons


def create_document_rows(
    *,
    session,
    tenant: TenantSeedContext,
    prefix: str,
    run_id: str,
    tenant_index: int,
    document_count: int,
    history_events_per_document: int,
    access_events_per_document: int,
    verification_logs_per_document: int,
    share_links_per_document: int,
    content_base_bytes: int,
    rng: Random,
    judge: bool = False,
) -> dict[str, int]:
    document_count = max(1, document_count)
    history_events_per_document = max(1, history_events_per_document)
    access_events_per_document = max(1, access_events_per_document)
    verification_logs_per_document = max(1, verification_logs_per_document)
    share_links_per_document = max(1, share_links_per_document)
    counts = {"documents": 0, "history_events": 0, "access_events": 0, "verification_logs": 0, "share_links": 0, "audit_logs": 0, "contents": 0}
    policy_templates = [template for template in build_policy_templates(prefix, tenant_index)]
    primary_key_id = "key_acme_primary" if judge else f"{tenant.tenant.tenant_id}_key_primary"
    for doc_index in range(document_count):
        file_name, content_type = FILE_TYPES[doc_index % len(FILE_TYPES)]
        document_suffix = f"{tenant_index:02d}_{doc_index:04d}"
        if judge and doc_index < 2:
            document_id = "doc_7f92ab31" if doc_index == 0 else "doc_3aa11c08"
        else:
            document_id = f"{prefix}_{run_id}_doc_{document_suffix}"
        file_name = f"{slugify(document_id)}-{file_name}"
        created_at = datetime.now(timezone.utc) - timedelta(days=rng.randint(0, 120), hours=rng.randint(0, 23))
        content = build_content(rng, content_base_bytes, document_id)
        content_fingerprint = sha256_hex(content)
        template = rng.choice(policy_templates)
        policy = build_document_policy(rng, template)
        tags = [rng.choice(TAG_POOL)]
        if rng.random() < 0.5:
            tags.append(rng.choice([tag for tag in TAG_POOL if tag not in tags]))
        manifest = ManifestClaims(
            tenant_id=tenant.tenant.tenant_id,
            document_id=document_id,
            issuer_key_id=primary_key_id,
            content_fingerprint=content_fingerprint,
            policy=policy,
            embedded_ai_tags=tags,
            created_at=created_at,
        )
        manifest_hash = canonical_hash(manifest.model_dump(mode="json"))
        manifest_signature = sign_payload(manifest.model_dump(mode="json"), tenant.private_keys[primary_key_id])
        signed_manifest = {
            "manifest": manifest.model_dump(mode="json"),
            "manifest_signature": manifest_signature,
            "signature_algorithm": "Ed25519",
        }

        history_rows, history_tip, next_timestamp, revoked = build_history_chain(
            tenant=tenant,
            document_id=document_id,
            manifest_hash=manifest_hash,
            created_at=created_at,
            event_count=history_events_per_document,
            rng=rng,
            primary_key_id=primary_key_id,
        )

        document = DocumentORM(
            document_id=document_id,
            tenant_id=tenant.tenant.tenant_id,
            issuer_key_id=primary_key_id,
            manifest=signed_manifest["manifest"],
            manifest_hash=manifest_hash,
            manifest_signature=manifest_signature,
            signature_algorithm="Ed25519",
            content_fingerprint=content_fingerprint,
            policy=policy,
            embedded_ai_tags=tags,
            created_at=created_at,
            history_tip=history_tip,
            status="revoked" if revoked else "active",
            revoked_at=next_timestamp if revoked else None,
            last_verified_status=None,
            last_verified_at=None,
            last_verification_reasons=[],
        )

        session.add(document)
        session.add_all(history_rows)
        session.flush()

        storage_key = f"{document_id}.blob"
        protected_content = embed_encrypted_passport(session, document_id, content)
        store_encrypted_blob(storage_key, protected_content)
        document_content = DocumentContentORM(
            document_id=document_id,
            file_name=file_name,
            content_type=content_type,
            size_bytes=len(content),
            storage_key=storage_key,
            encrypted_size_bytes=len(protected_content),
        )

        link_rows: list[ShareLinkORM] = []
        primary_link_id: str | None = None
        for link_index in range(share_links_per_document):
            link_id = f"lnk_{run_id}_{tenant_index:02d}_{doc_index:04d}_{link_index:02d}"
            token = f"{tenant.tenant.tenant_id}:{document_id}:{link_index}:{rng.random():.12f}"
            access_method = rng.choice(["link", "password", "organization"])
            password_hash = sha256_hex(f"pw-{token}".encode("utf-8")) if access_method == "password" else None
            expires_at = datetime.now(timezone.utc) + timedelta(hours=rng.randint(6, 240))
            link_rows.append(
                ShareLinkORM(
                    link_id=link_id,
                    document_id=document_id,
                    tenant_id=tenant.tenant.tenant_id,
                    token_hash=sha256_hex(token.encode("utf-8")),
                    access_method=access_method,
                    password_hash=password_hash,
                    status="active",
                    created_at=created_at + timedelta(hours=1 + link_index),
                    expires_at=expires_at,
                )
            )
            if primary_link_id is None:
                primary_link_id = link_id

        suspicious = tenant_index == 0 and doc_index == 0
        access_rows, latest_score, latest_reasons, latest_vector = build_access_events(
            rng=rng,
            tenant_id=tenant.tenant.tenant_id,
            document_id=document_id,
            share_link_id=primary_link_id,
            base_time=created_at + timedelta(hours=2),
            count=access_events_per_document,
            suspicious=suspicious,
        )

        verification_rows, last_status, last_verified_at, verification_reasons = build_verification_logs(
            document_id=document_id,
            latest_timestamp=max(row.timestamp for row in access_rows) if access_rows else created_at,
            count=verification_logs_per_document,
            revoked=revoked,
            suspicious=suspicious,
        )

        anomaly_state = AnomalyModelStateORM(
            document_id=document_id,
            tenant_id=tenant.tenant.tenant_id,
            sample_count=len(access_rows),
            feature_means=latest_vector,
            feature_m2={name: round(value * 0.5, 3) for name, value in latest_vector.items()},
            model_state_blob=None,
            latest_feature_vector=latest_vector,
            latest_score=latest_score,
            latest_reasons=latest_reasons,
            last_scored_at=max(row.timestamp for row in access_rows) if access_rows else created_at,
        )

        audit_rows = [
            AuditLogORM(
                tenant_id=tenant.tenant.tenant_id,
                document_id=document_id,
                action="document_registered",
                details={
                    "manifest_hash": manifest_hash,
                    "history_tip": history_tip,
                    "content_fingerprint": content_fingerprint,
                    "file_name": file_name,
                },
            ),
            AuditLogORM(
                tenant_id=tenant.tenant.tenant_id,
                document_id=document_id,
                action="document_content_seeded",
                details={
                    "size_bytes": len(content),
                    "encrypted_size_bytes": len(protected_content),
                    "content_type": content_type,
                    "storage_key": storage_key,
                    "share_links": len(link_rows),
                },
            ),
        ]
        audit_rows.extend(
            AuditLogORM(
                tenant_id=tenant.tenant.tenant_id,
                document_id=document_id,
                action="verify",
                details={"status": row.status, "reasons": row.reasons},
            )
            for row in verification_rows
        )

        document.last_verified_status = last_status
        document.last_verified_at = last_verified_at
        document.last_verification_reasons = verification_reasons

        session.add(document_content)
        session.add(anomaly_state)
        session.add_all(access_rows)
        session.add_all(verification_rows)
        session.add_all(link_rows)
        session.add_all(audit_rows)

        counts["documents"] += 1
        counts["contents"] += 1
        counts["history_events"] += len(history_rows)
        counts["access_events"] += len(access_rows)
        counts["verification_logs"] += len(verification_rows)
        counts["share_links"] += len(link_rows)
        counts["audit_logs"] += len(audit_rows)

    session.commit()
    return counts


def remove_existing_seed_rows(session) -> None:
    for model in (
        AuditLogORM,
        VerificationLogORM,
        AnomalyModelStateORM,
        AccessEventORM,
        ShareLinkORM,
        DocumentContentORM,
        SignatureHistoryEventORM,
        DocumentORM,
        PolicyTemplateORM,
        PublicKeyORM,
        TenantORM,
    ):
        session.execute(delete(model))
    session.commit()


def main() -> int:
    args = parse_args()
    rng = Random(args.seed)
    run_id = args.run_id or f"{rng.getrandbits(24):06x}"
    if args.judge:
        args.tenants = 1
        args.prefix = "tenant_acme"

    ensure_tables(args.reset)
    session = SessionLocal()
    total_counts = {"tenants": 0, "documents": 0, "history_events": 0, "access_events": 0, "verification_logs": 0, "share_links": 0, "audit_logs": 0, "contents": 0}
    try:
        if args.reset:
            remove_existing_seed_rows(session)
            reset_blob_storage()
            reset_frontend_state()

        for tenant_index in range(args.tenants):
            tenant_ctx = create_tenant_context(
                session,
                prefix=args.prefix,
                run_id=run_id,
                index=tenant_index,
                rng=rng,
                judge=args.judge,
            )
            counts = create_document_rows(
                session=session,
                tenant=tenant_ctx,
                prefix=args.prefix,
                run_id=run_id,
                tenant_index=tenant_index,
                document_count=args.documents_per_tenant,
                history_events_per_document=args.history_events_per_document,
                access_events_per_document=args.access_events_per_document,
                verification_logs_per_document=args.verification_logs_per_document,
                share_links_per_document=args.share_links_per_document,
                content_base_bytes=args.content_base_bytes,
                rng=rng,
                judge=args.judge,
            )
            total_counts["tenants"] += 1
            for key, value in counts.items():
                total_counts[key] += value
            print(
                f"seeded tenant={tenant_ctx.tenant.tenant_id} documents={counts['documents']} "
                f"access_events={counts['access_events']} links={counts['share_links']}"
            )

        print(
            "complete "
            + " ".join(
                f"{key}={value}"
                for key, value in total_counts.items()
            )
        )
        return 0
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
