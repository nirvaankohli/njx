from __future__ import annotations

import base64

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey


def parse_ed25519_signature(signature: str) -> bytes:
    if not signature.startswith("ed25519:"):
        raise ValueError("Unsupported signature format")
    return base64.b64decode(signature.split(":", 1)[1])


def verify_ed25519(public_key_b64: str, signed_bytes: bytes, signature: str) -> bool:
    try:
        public_key = Ed25519PublicKey.from_public_bytes(base64.b64decode(public_key_b64))
        public_key.verify(parse_ed25519_signature(signature), signed_bytes)
        return True
    except Exception:
        return False

