from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.models.dto import ManifestClaims, SignatureHistoryEvent, SignedManifest
from app.models.db import PublicKeyORM
from app.security.canonical_json import canonical_json_bytes
from app.security.hashes import canonical_hash
from app.security.signatures import verify_ed25519


def manifest_body(manifest: ManifestClaims) -> dict[str, Any]:
    return manifest.model_dump(mode="json")


def manifest_signed_bytes(manifest: ManifestClaims) -> bytes:
    return canonical_json_bytes(manifest_body(manifest))


def manifest_hash(manifest: ManifestClaims) -> str:
    return canonical_hash(manifest_body(manifest))


def event_body(event: SignatureHistoryEvent) -> dict[str, Any]:
    body = event.model_dump(mode="json")
    body.pop("signature", None)
    return body


def event_signed_bytes(event: SignatureHistoryEvent) -> bytes:
    return canonical_json_bytes(event_body(event))


def event_hash(event: SignatureHistoryEvent) -> str:
    return canonical_hash(event.model_dump(mode="json"))


def verify_manifest_signature(public_key_b64: str, signed_manifest: SignedManifest) -> bool:
    return verify_ed25519(
        public_key_b64,
        manifest_signed_bytes(signed_manifest.manifest),
        signed_manifest.manifest_signature,
    )


def verify_event_signature(public_key_b64: str, event: SignatureHistoryEvent) -> bool:
    return verify_ed25519(public_key_b64, event_signed_bytes(event), event.signature)


def get_public_key(session: Session, key_id: str) -> PublicKeyORM | None:
    return session.get(PublicKeyORM, key_id)


@dataclass
class HistoryChainResult:
    valid: bool
    reasons: list[str]
    revoked_key_used: bool = False
    signature_valid: bool = True

