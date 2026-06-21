from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.db import DocumentORM, SignatureHistoryEventORM
from app.models.dto import SignatureHistoryEvent, SignedManifest, VerifyRequest
from app.security.hashes import sha256_hex
from app.services.errors import DocShieldError, NotFoundError


TRAILER_MAGIC = b"DOCSHIELD-ENCRYPTED-V1"
TRAILER_LENGTH_BYTES = 8
NONCE_BYTES = 12
AAD = b"docshield-embedded-document-v1"
DEFAULT_DEV_SECRET = "docshield-local-development-only"


def _encryption_key() -> bytes:
    secret = os.getenv("DOCSHIELD_EMBEDDING_SECRET", DEFAULT_DEV_SECRET)
    return hashlib.sha256(secret.encode("utf-8")).digest()


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _history_for_document(session: Session, document_id: str) -> list[SignatureHistoryEvent]:
    rows = session.scalars(
        select(SignatureHistoryEventORM)
        .where(SignatureHistoryEventORM.document_id == document_id)
        .order_by(SignatureHistoryEventORM.timestamp, SignatureHistoryEventORM.created_at)
    ).all()
    return [
        SignatureHistoryEvent(
            event_id=row.event_id,
            document_id=row.document_id,
            event=row.event,
            actor_org=row.actor_org,
            actor_key_id=row.actor_key_id,
            timestamp=_as_utc(row.timestamp),
            previous_event_hash=row.previous_event_hash,
            manifest_hash=row.manifest_hash,
            payload=row.payload,
            signature=row.signature,
        )
        for row in rows
    ]


def embed_encrypted_passport(session: Session, document_id: str, original: bytes) -> bytes:
    """Append an authenticated encrypted passport without changing the file's extension."""
    document = session.get(DocumentORM, document_id)
    if document is None:
        raise NotFoundError(f"Document {document_id} not found")
    if sha256_hex(original) != document.content_fingerprint:
        raise DocShieldError("Uploaded bytes do not match the signed content fingerprint", status_code=409)

    passport = {
        "document_id": document.document_id,
        "original_fingerprint": document.content_fingerprint,
        "signed_manifest": {
            "manifest": document.manifest,
            "manifest_signature": document.manifest_signature,
            "signature_algorithm": document.signature_algorithm,
        },
        "history": [event.model_dump(mode="json") for event in _history_for_document(session, document_id)],
    }
    plaintext = json.dumps(passport, separators=(",", ":"), sort_keys=True).encode("utf-8")
    nonce = os.urandom(NONCE_BYTES)
    encrypted = nonce + AESGCM(_encryption_key()).encrypt(nonce, plaintext, AAD)
    return original + encrypted + len(encrypted).to_bytes(TRAILER_LENGTH_BYTES, "big") + TRAILER_MAGIC


def extract_encrypted_passport(content: bytes) -> tuple[bytes, VerifyRequest] | None:
    """Return preserved source bytes and their signed passport when a trailer is present."""
    footer_size = TRAILER_LENGTH_BYTES + len(TRAILER_MAGIC)
    if len(content) < footer_size or not content.endswith(TRAILER_MAGIC):
        return None

    length_end = len(content) - len(TRAILER_MAGIC)
    encrypted_length = int.from_bytes(content[length_end - TRAILER_LENGTH_BYTES:length_end], "big")
    encrypted_start = length_end - TRAILER_LENGTH_BYTES - encrypted_length
    if encrypted_start < 0 or encrypted_length <= NONCE_BYTES:
        raise DocShieldError("Embedded DocShield passport is malformed", status_code=400)

    encrypted = content[encrypted_start:length_end - TRAILER_LENGTH_BYTES]
    nonce, ciphertext = encrypted[:NONCE_BYTES], encrypted[NONCE_BYTES:]
    try:
        plaintext = AESGCM(_encryption_key()).decrypt(nonce, ciphertext, AAD)
        passport = json.loads(plaintext)
        request = VerifyRequest(
            document_id=passport["document_id"],
            signed_manifest=SignedManifest.model_validate(passport["signed_manifest"]),
            history=[SignatureHistoryEvent.model_validate(event) for event in passport["history"]],
            computed_content_fingerprint=sha256_hex(content[:encrypted_start]),
        )
    except (InvalidTag, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise DocShieldError("Embedded DocShield passport is invalid or has been altered", status_code=400) from exc
    return content[:encrypted_start], request
