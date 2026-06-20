from __future__ import annotations

import base64
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from app.models.dto import ManifestClaims, SignatureHistoryEvent
from app.security.canonical_json import canonical_json_bytes
from app.security.hashes import canonical_hash
from app.security.hashes import sha256_hex


def make_keypair() -> tuple[str, Ed25519PrivateKey]:
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
    return base64.b64encode(public_key).decode("ascii"), private_key


def sign_dict(payload: dict[str, Any], private_key: Ed25519PrivateKey) -> str:
    signature = private_key.sign(canonical_json_bytes(payload))
    return "ed25519:" + base64.b64encode(signature).decode("ascii")


def signed_manifest_payload(manifest: ManifestClaims, private_key: Ed25519PrivateKey) -> dict[str, Any]:
    payload = manifest.model_dump(mode="json")
    return {
        "manifest": payload,
        "manifest_signature": sign_dict(payload, private_key),
        "signature_algorithm": "Ed25519",
    }


def signed_event_payload(event: SignatureHistoryEvent, private_key: Ed25519PrivateKey) -> dict[str, Any]:
    payload = event.model_dump(mode="json")
    payload.pop("signature", None)
    payload["signature"] = sign_dict(payload, private_key)
    return payload


def utc_ts(value: str) -> str:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def manifest_hash_for(manifest: ManifestClaims) -> str:
    return canonical_hash(manifest.model_dump(mode="json"))


def file_hash_for(path: Path) -> str:
    return sha256_hex(path.read_bytes())
