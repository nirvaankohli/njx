from __future__ import annotations

import hashlib
from typing import Any

from app.security.canonical_json import canonical_json_bytes


def sha256_hex(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def canonical_hash(obj: Any) -> str:
    return sha256_hex(canonical_json_bytes(obj))

